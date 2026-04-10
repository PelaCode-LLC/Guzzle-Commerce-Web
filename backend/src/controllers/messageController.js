const Joi = require('joi');
const pool = require('../config/database');

const listSchema = Joi.object({
  limit: Joi.number().integer().min(1).max(100).default(20),
  offset: Joi.number().integer().min(0).default(0),
  transactionId: Joi.number().integer().positive(),
  listingId: Joi.number().integer().positive(),
});

const sendMessageSchema = Joi.object({
  recipientId: Joi.number().integer().positive().required(),
  content: Joi.string().trim().min(1).max(5000).required(),
  transactionId: Joi.number().integer().positive().allow(null),
  listingId: Joi.number().integer().positive().allow(null),
});

const toPublicUser = row => ({
  id: row.id,
  firstName: row.first_name,
  lastName: row.last_name,
  avatarUrl: row.avatar_url,
});

const toConversationKey = (scopeType, scopeId, otherUserId) => {
  if (scopeType === 'listing') {
    return `listing:${scopeId}:${otherUserId}`;
  }

  if (scopeType === 'transaction') {
    return `transaction:${scopeId}:${otherUserId}`;
  }

  return `direct:${otherUserId}`;
};

const getInbox = async (req, res) => {
  const userId = req.userId;
  const { error, value } = listSchema.validate(req.query);
  if (error) {
    return res.status(400).json({ error: error.details[0].message });
  }

  const { limit, offset } = value;

  try {
    const result = await pool.query(
      `WITH scoped_messages AS (
         SELECT
           m.id,
           m.sender_id,
           m.recipient_id,
           m.transaction_id,
           COALESCE(m.listing_id, tx.listing_id) AS listing_id,
           m.content,
           m.is_read,
           m.created_at,
           CASE
             WHEN m.sender_id = $1 THEN m.recipient_id
             ELSE m.sender_id
           END AS other_user_id,
           CASE
             WHEN m.transaction_id IS NOT NULL THEN 'transaction'
             WHEN COALESCE(m.listing_id, tx.listing_id) IS NOT NULL THEN 'listing'
             ELSE 'direct'
           END AS conversation_scope_type,
           CASE
             WHEN m.transaction_id IS NOT NULL THEN m.transaction_id
             WHEN COALESCE(m.listing_id, tx.listing_id) IS NOT NULL THEN COALESCE(m.listing_id, tx.listing_id)
             ELSE CASE WHEN m.sender_id = $1 THEN m.recipient_id ELSE m.sender_id END
           END AS conversation_scope_id
         FROM messages m
         LEFT JOIN transactions tx ON tx.id = m.transaction_id
         WHERE m.sender_id = $1 OR m.recipient_id = $1
       ),
       ranked_messages AS (
         SELECT
           sm.*,
           ROW_NUMBER() OVER (
             PARTITION BY sm.other_user_id, sm.conversation_scope_type, sm.conversation_scope_id
             ORDER BY sm.created_at DESC, sm.id DESC
           ) AS row_num
         FROM scoped_messages sm
       ),
       unread_counts AS (
         SELECT
           sm.other_user_id,
           sm.conversation_scope_type,
           sm.conversation_scope_id,
           COUNT(*)::INTEGER AS unread_count
         FROM scoped_messages sm
         WHERE sm.sender_id = sm.other_user_id
           AND sm.recipient_id = $1
           AND sm.is_read = FALSE
         GROUP BY sm.other_user_id, sm.conversation_scope_type, sm.conversation_scope_id
       )
       SELECT
         rm.id,
         rm.sender_id,
         rm.recipient_id,
         rm.transaction_id,
         rm.listing_id,
         rm.content,
         rm.is_read,
         rm.created_at,
         rm.other_user_id,
         rm.conversation_scope_type,
         rm.conversation_scope_id,
         u.first_name,
         u.last_name,
         u.avatar_url,
         COALESCE(uc.unread_count, 0) AS unread_count,
         l.title AS listing_title,
         l.image_url AS listing_image_url
       FROM ranked_messages rm
       JOIN users u ON u.id = rm.other_user_id
       LEFT JOIN unread_counts uc
         ON uc.other_user_id = rm.other_user_id
        AND uc.conversation_scope_type = rm.conversation_scope_type
        AND uc.conversation_scope_id = rm.conversation_scope_id
       LEFT JOIN listings l ON l.id = rm.listing_id
       WHERE rm.row_num = 1
       ORDER BY rm.created_at DESC, rm.id DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );

    const countResult = await pool.query(
      `SELECT COUNT(*)::INTEGER AS count
       FROM (
         SELECT
           CASE
             WHEN m.sender_id = $1 THEN m.recipient_id
             ELSE m.sender_id
           END AS other_user_id,
           CASE
             WHEN m.transaction_id IS NOT NULL THEN 'transaction'
             WHEN COALESCE(m.listing_id, tx.listing_id) IS NOT NULL THEN 'listing'
             ELSE 'direct'
           END AS conversation_scope_type,
           CASE
             WHEN m.transaction_id IS NOT NULL THEN m.transaction_id
             WHEN COALESCE(m.listing_id, tx.listing_id) IS NOT NULL THEN COALESCE(m.listing_id, tx.listing_id)
             ELSE CASE WHEN m.sender_id = $1 THEN m.recipient_id ELSE m.sender_id END
           END AS conversation_scope_id
         FROM messages m
         LEFT JOIN transactions tx ON tx.id = m.transaction_id
         WHERE m.sender_id = $1 OR m.recipient_id = $1
         GROUP BY other_user_id, conversation_scope_type, conversation_scope_id
       ) conversation_count`,
      [userId]
    );

    const conversations = result.rows.map(row => ({
      key: toConversationKey(
        row.conversation_scope_type,
        row.conversation_scope_id,
        row.other_user_id
      ),
      scopeType: row.conversation_scope_type,
      scopeId: row.conversation_scope_id,
      transactionId:
        row.conversation_scope_type === 'transaction' ? row.conversation_scope_id : null,
      lastMessage: {
        id: row.id,
        senderId: row.sender_id,
        recipientId: row.recipient_id,
        transactionId: row.transaction_id,
        listingId: row.listing_id,
        content: row.content,
        isRead: row.is_read,
        createdAt: row.created_at,
      },
      otherUser: {
        id: row.other_user_id,
        firstName: row.first_name,
        lastName: row.last_name,
        avatarUrl: row.avatar_url,
      },
      listing: row.listing_id
        ? {
            id: row.listing_id,
            title: row.listing_title,
            imageUrl: row.listing_image_url,
          }
        : null,
      unreadCount: row.unread_count,
    }));

    return res.json({
      conversations,
      total: countResult.rows[0].count,
      limit,
      offset,
    });
  } catch (dbError) {
    console.error('Get inbox error:', dbError);
    return res.status(500).json({ error: 'Failed to fetch inbox' });
  }
};

const getThread = async (req, res) => {
  const userId = req.userId;
  const otherUserId = Number(req.params.otherUserId);

  if (!Number.isFinite(otherUserId) || otherUserId <= 0) {
    return res.status(400).json({ error: 'Invalid otherUserId parameter' });
  }

  const { error, value } = listSchema.validate(req.query);
  if (error) {
    return res.status(400).json({ error: error.details[0].message });
  }

  const { limit, offset, transactionId, listingId } = value;
  const params = [userId, otherUserId];
  const scopeFilters = [];

  if (transactionId) {
    params.push(transactionId);
    scopeFilters.push(`m.transaction_id = $${params.length}`);
  }

  if (listingId) {
    params.push(listingId);
    scopeFilters.push(`COALESCE(m.listing_id, tx.listing_id) = $${params.length}`);
  }

  const scopeFilterSql = scopeFilters.length > 0 ? ` AND ${scopeFilters.join(' AND ')}` : '';

  params.push(limit, offset);
  const limitParam = `$${params.length - 1}`;
  const offsetParam = `$${params.length}`;

  try {
    const threadResult = await pool.query(
      `SELECT
         m.id,
         m.sender_id,
         m.recipient_id,
         m.transaction_id,
        COALESCE(m.listing_id, tx.listing_id) AS listing_id,
         m.content,
         m.is_read,
         m.created_at,
         sender.id AS sender_user_id,
         sender.first_name AS sender_first_name,
         sender.last_name AS sender_last_name,
         sender.avatar_url AS sender_avatar_url,
         recipient.id AS recipient_user_id,
         recipient.first_name AS recipient_first_name,
         recipient.last_name AS recipient_last_name,
         recipient.avatar_url AS recipient_avatar_url
       FROM messages m
       LEFT JOIN transactions tx ON tx.id = m.transaction_id
       JOIN users sender ON sender.id = m.sender_id
       JOIN users recipient ON recipient.id = m.recipient_id
       WHERE (
         (m.sender_id = $1 AND m.recipient_id = $2)
         OR (m.sender_id = $2 AND m.recipient_id = $1)
       )${scopeFilterSql}
       ORDER BY m.created_at DESC, m.id DESC
       LIMIT ${limitParam} OFFSET ${offsetParam}`,
      params
    );

    const countParams = [userId, otherUserId];
    const countScopeFilters = [];
    if (transactionId) {
      countParams.push(transactionId);
      countScopeFilters.push(`m.transaction_id = $${countParams.length}`);
    }
    if (listingId) {
      countParams.push(listingId);
      countScopeFilters.push(`COALESCE(m.listing_id, tx.listing_id) = $${countParams.length}`);
    }
    const countScopeSql = countScopeFilters.length > 0 ? ` AND ${countScopeFilters.join(' AND ')}` : '';

    const countResult = await pool.query(
      `SELECT COUNT(*)::INTEGER AS count
       FROM messages m
       LEFT JOIN transactions tx ON tx.id = m.transaction_id
       WHERE (
         (m.sender_id = $1 AND m.recipient_id = $2)
         OR (m.sender_id = $2 AND m.recipient_id = $1)
       )${countScopeSql}`,
      countParams
    );

    const markReadParams = [userId, otherUserId];
    const markReadScopeFilters = [];
    if (transactionId) {
      markReadParams.push(transactionId);
      markReadScopeFilters.push(`transaction_id = $${markReadParams.length}`);
    }
    if (listingId) {
      markReadParams.push(listingId);
      markReadScopeFilters.push(
        `COALESCE(listing_id, (SELECT listing_id FROM transactions WHERE id = transaction_id)) = $${markReadParams.length}`
      );
    }
    const markReadScopeSql = markReadScopeFilters.length > 0 ? ` AND ${markReadScopeFilters.join(' AND ')}` : '';

    await pool.query(
      `UPDATE messages
       SET is_read = TRUE
       WHERE recipient_id = $1
         AND sender_id = $2
         AND is_read = FALSE${markReadScopeSql}`,
      markReadParams
    );

    const messages = threadResult.rows
      .map(row => ({
        id: row.id,
        senderId: row.sender_id,
        recipientId: row.recipient_id,
        transactionId: row.transaction_id,
        listingId: row.listing_id,
        content: row.content,
        isRead: row.is_read,
        createdAt: row.created_at,
        sender: {
          id: row.sender_user_id,
          firstName: row.sender_first_name,
          lastName: row.sender_last_name,
          avatarUrl: row.sender_avatar_url,
        },
        recipient: {
          id: row.recipient_user_id,
          firstName: row.recipient_first_name,
          lastName: row.recipient_last_name,
          avatarUrl: row.recipient_avatar_url,
        },
      }))
      .reverse();

    return res.json({
      messages,
      total: countResult.rows[0].count,
      limit,
      offset,
    });
  } catch (dbError) {
    console.error('Get thread error:', dbError);
    return res.status(500).json({ error: 'Failed to fetch message thread' });
  }
};

const sendMessage = async (req, res) => {
  const senderId = req.userId;
  const { error, value } = sendMessageSchema.validate(req.body);
  if (error) {
    return res.status(400).json({ error: error.details[0].message });
  }

  const { recipientId, content, transactionId = null, listingId = null } = value;

  if (recipientId === senderId) {
    return res.status(400).json({ error: 'Cannot send a message to yourself' });
  }

  try {
    const requestedListingId = listingId;
    let effectiveListingId = listingId;

    const recipientResult = await pool.query(
      'SELECT id, first_name, last_name, avatar_url FROM users WHERE id = $1',
      [recipientId]
    );

    if (recipientResult.rows.length === 0) {
      return res.status(404).json({ error: 'Recipient not found' });
    }

    if (transactionId) {
      const transactionResult = await pool.query(
        `SELECT id, buyer_id, seller_id, listing_id
         FROM transactions
         WHERE id = $1`,
        [transactionId]
      );

      if (transactionResult.rows.length === 0) {
        return res.status(404).json({ error: 'Transaction not found' });
      }

      const tx = transactionResult.rows[0];
      const participants = [tx.buyer_id, tx.seller_id];
      const senderInTransaction = participants.includes(senderId);
      const recipientInTransaction = participants.includes(recipientId);

      if (!senderInTransaction || !recipientInTransaction) {
        return res.status(403).json({
          error: 'Sender and recipient must both belong to the referenced transaction',
        });
      }

      if (requestedListingId && requestedListingId !== tx.listing_id) {
        return res.status(400).json({
          error: 'Referenced listing does not match the transaction listing',
        });
      }

      effectiveListingId = effectiveListingId || tx.listing_id;
    }

    if (requestedListingId && !transactionId) {
      const listingResult = await pool.query(
        `SELECT id, user_id
         FROM listings
         WHERE id = $1`,
        [requestedListingId]
      );

      if (listingResult.rows.length === 0) {
        return res.status(404).json({ error: 'Listing not found' });
      }

      const listing = listingResult.rows[0];
      if (listing.user_id !== recipientId) {
        return res.status(403).json({
          error: 'Recipient must be the owner of the referenced listing',
        });
      }
    }

    const inserted = await pool.query(
      `INSERT INTO messages (sender_id, recipient_id, transaction_id, listing_id, content)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, sender_id, recipient_id, transaction_id, listing_id, content, is_read, created_at`,
      [senderId, recipientId, transactionId, effectiveListingId, content]
    );

    const senderResult = await pool.query(
      'SELECT id, first_name, last_name, avatar_url FROM users WHERE id = $1',
      [senderId]
    );

    const message = inserted.rows[0];

    return res.status(201).json({
      id: message.id,
      senderId: message.sender_id,
      recipientId: message.recipient_id,
      transactionId: message.transaction_id,
      listingId: message.listing_id,
      content: message.content,
      isRead: message.is_read,
      createdAt: message.created_at,
      sender: toPublicUser(senderResult.rows[0]),
      recipient: toPublicUser(recipientResult.rows[0]),
    });
  } catch (dbError) {
    console.error('Send message error:', dbError);
    return res.status(500).json({ error: 'Failed to send message' });
  }
};

const markMessageRead = async (req, res) => {
  const userId = req.userId;
  const messageId = Number(req.params.messageId);

  if (!Number.isFinite(messageId) || messageId <= 0) {
    return res.status(400).json({ error: 'Invalid messageId parameter' });
  }

  try {
    const result = await pool.query(
      `UPDATE messages
       SET is_read = TRUE
       WHERE id = $1 AND recipient_id = $2
       RETURNING id, sender_id, recipient_id, transaction_id, listing_id, content, is_read, created_at`,
      [messageId, userId]
    );

    if (result.rows.length === 0) {
      return res
        .status(404)
        .json({ error: 'Message not found or user is not authorized to modify it' });
    }

    const row = result.rows[0];
    return res.json({
      id: row.id,
      senderId: row.sender_id,
      recipientId: row.recipient_id,
      transactionId: row.transaction_id,
      listingId: row.listing_id,
      content: row.content,
      isRead: row.is_read,
      createdAt: row.created_at,
    });
  } catch (dbError) {
    console.error('Mark message read error:', dbError);
    return res.status(500).json({ error: 'Failed to mark message as read' });
  }
};

module.exports = {
  getInbox,
  getThread,
  sendMessage,
  markMessageRead,
};