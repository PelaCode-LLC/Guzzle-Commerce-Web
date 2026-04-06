const Joi = require('joi');
const pool = require('../config/database');

const listSchema = Joi.object({
  limit: Joi.number().integer().min(1).max(100).default(20),
  offset: Joi.number().integer().min(0).default(0),
  transactionId: Joi.number().integer().positive(),
});

const sendMessageSchema = Joi.object({
  recipientId: Joi.number().integer().positive().required(),
  content: Joi.string().trim().min(1).max(5000).required(),
  transactionId: Joi.number().integer().positive().allow(null),
});

const toPublicUser = row => ({
  id: row.id,
  firstName: row.first_name,
  lastName: row.last_name,
  avatarUrl: row.avatar_url,
});

const getInbox = async (req, res) => {
  const userId = req.userId;
  const { error, value } = listSchema.validate(req.query);
  if (error) {
    return res.status(400).json({ error: error.details[0].message });
  }

  const { limit, offset } = value;

  try {
    const result = await pool.query(
      `WITH ranked_messages AS (
         SELECT
           m.id,
           m.sender_id,
           m.recipient_id,
           m.transaction_id,
           m.content,
           m.is_read,
           m.created_at,
           CASE
             WHEN m.sender_id = $1 THEN m.recipient_id
             ELSE m.sender_id
           END AS other_user_id,
           ROW_NUMBER() OVER (
             PARTITION BY CASE WHEN m.sender_id = $1 THEN m.recipient_id ELSE m.sender_id END
             ORDER BY m.created_at DESC, m.id DESC
           ) AS row_num
         FROM messages m
         WHERE m.sender_id = $1 OR m.recipient_id = $1
       )
       SELECT
         rm.id,
         rm.sender_id,
         rm.recipient_id,
         rm.transaction_id,
         rm.content,
         rm.is_read,
         rm.created_at,
         rm.other_user_id,
         u.first_name,
         u.last_name,
         u.avatar_url,
         (
           SELECT COUNT(*)::INTEGER
           FROM messages um
           WHERE um.sender_id = rm.other_user_id
             AND um.recipient_id = $1
             AND um.is_read = FALSE
         ) AS unread_count
       FROM ranked_messages rm
       JOIN users u ON u.id = rm.other_user_id
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
             WHEN sender_id = $1 THEN recipient_id
             ELSE sender_id
           END AS other_user_id
         FROM messages
         WHERE sender_id = $1 OR recipient_id = $1
         GROUP BY other_user_id
       ) conversation_count`,
      [userId]
    );

    const conversations = result.rows.map(row => ({
      lastMessage: {
        id: row.id,
        senderId: row.sender_id,
        recipientId: row.recipient_id,
        transactionId: row.transaction_id,
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

  const { limit, offset, transactionId } = value;
  const params = [userId, otherUserId];
  let txFilterSql = '';

  if (transactionId) {
    params.push(transactionId);
    txFilterSql = ` AND m.transaction_id = $${params.length}`;
  }

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
       JOIN users sender ON sender.id = m.sender_id
       JOIN users recipient ON recipient.id = m.recipient_id
       WHERE (
         (m.sender_id = $1 AND m.recipient_id = $2)
         OR (m.sender_id = $2 AND m.recipient_id = $1)
       )${txFilterSql}
       ORDER BY m.created_at DESC, m.id DESC
       LIMIT ${limitParam} OFFSET ${offsetParam}`,
      params
    );

    const countParams = [userId, otherUserId];
    let countTxFilterSql = '';
    if (transactionId) {
      countParams.push(transactionId);
      countTxFilterSql = ` AND m.transaction_id = $${countParams.length}`;
    }

    const countResult = await pool.query(
      `SELECT COUNT(*)::INTEGER AS count
       FROM messages m
       WHERE (
         (m.sender_id = $1 AND m.recipient_id = $2)
         OR (m.sender_id = $2 AND m.recipient_id = $1)
       )${countTxFilterSql}`,
      countParams
    );

    const markReadParams = [userId, otherUserId];
    let markReadTxFilterSql = '';
    if (transactionId) {
      markReadParams.push(transactionId);
      markReadTxFilterSql = ` AND transaction_id = $${markReadParams.length}`;
    }

    await pool.query(
      `UPDATE messages
       SET is_read = TRUE
       WHERE recipient_id = $1
         AND sender_id = $2
         AND is_read = FALSE${markReadTxFilterSql}`,
      markReadParams
    );

    const messages = threadResult.rows
      .map(row => ({
        id: row.id,
        senderId: row.sender_id,
        recipientId: row.recipient_id,
        transactionId: row.transaction_id,
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

  const { recipientId, content, transactionId = null } = value;

  if (recipientId === senderId) {
    return res.status(400).json({ error: 'Cannot send a message to yourself' });
  }

  try {
    const recipientResult = await pool.query(
      'SELECT id, first_name, last_name, avatar_url FROM users WHERE id = $1',
      [recipientId]
    );

    if (recipientResult.rows.length === 0) {
      return res.status(404).json({ error: 'Recipient not found' });
    }

    if (transactionId) {
      const transactionResult = await pool.query(
        `SELECT id, buyer_id, seller_id
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
    }

    const inserted = await pool.query(
      `INSERT INTO messages (sender_id, recipient_id, transaction_id, content)
       VALUES ($1, $2, $3, $4)
       RETURNING id, sender_id, recipient_id, transaction_id, content, is_read, created_at`,
      [senderId, recipientId, transactionId, content]
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
       RETURNING id, sender_id, recipient_id, transaction_id, content, is_read, created_at`,
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