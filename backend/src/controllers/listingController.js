const pool = require('../config/database');
const Joi = require('joi');

const createListingSchema = Joi.object({
  title: Joi.string().max(255).required(),
  description: Joi.string(),
  category: Joi.string().max(100),
  price: Joi.number().positive().required(),
  currency: Joi.string().valid('USD', 'EUR', 'GBP').default('USD'),
  imageUrl: Joi.alternatives().try(
    Joi.string().uri(),
    Joi.string().pattern(/^data:image\/[a-zA-Z0-9.+-]+;base64,/)
  ),
});

const toAuthorName = row => {
  const firstName = row?.author_first_name || '';
  const lastName = row?.author_last_name || '';
  const fullName = `${firstName} ${lastName}`.trim();

  return fullName || row?.author_email || null;
};

const createListing = async (req, res) => {
  const { error, value } = createListingSchema.validate(req.body);
  if (error) {
    return res.status(400).json({ error: error.details[0].message });
  }

  const userId = req.userId;
  const { title, description, category, price, currency, imageUrl } = value;

  try {
    const result = await pool.query(
      `INSERT INTO listings (user_id, title, description, category, price, currency, image_url, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'active')
       RETURNING id, user_id, title, description, category, price, currency, image_url, status, created_at,
                 (SELECT first_name FROM users WHERE id = user_id) AS author_first_name,
                 (SELECT last_name FROM users WHERE id = user_id) AS author_last_name,
                 (SELECT email FROM users WHERE id = user_id) AS author_email`,
      [userId, title, description || null, category || null, price, currency, imageUrl || null]
    );

    const listing = result.rows[0];
    res.status(201).json({
      id: listing.id,
      userId: listing.user_id,
      title: listing.title,
      description: listing.description,
      category: listing.category,
      price: listing.price,
      currency: listing.currency,
      imageUrl: listing.image_url,
      authorName: toAuthorName(listing),
      status: listing.status,
      createdAt: listing.created_at,
    });
  } catch (error) {
    console.error('Create listing error:', error);
    res.status(500).json({ error: 'Failed to create listing' });
  }
};

const getListings = async (req, res) => {
  const { search, category, minPrice, maxPrice, limit = 20, offset = 0 } = req.query;

  try {
    let query = `SELECT l.id,
              l.user_id,
              l.title,
              l.description,
              l.category,
              l.price,
              l.currency,
              l.image_url,
              l.status,
              l.created_at,
              u.first_name AS author_first_name,
              u.last_name AS author_last_name,
              u.email AS author_email
           FROM listings l
           LEFT JOIN users u ON u.id = l.user_id
           WHERE l.status = $1`;
    const params = ['active'];

    if (search) {
      query += ` AND (title ILIKE $${params.length + 1} OR description ILIKE $${params.length + 1})`;
      params.push(`%${search}%`);
    }

    if (category) {
      query += ` AND category = $${params.length + 1}`;
      params.push(category);
    }

    if (minPrice) {
      query += ` AND price >= $${params.length + 1}`;
      params.push(minPrice);
    }

    if (maxPrice) {
      query += ` AND price <= $${params.length + 1}`;
      params.push(maxPrice);
    }

    query += ' ORDER BY created_at DESC LIMIT $' + (params.length + 1) + ' OFFSET $' + (params.length + 2);
    params.push(limit, offset);

    const result = await pool.query(query, params);

    // Get total count
    let countQuery = 'SELECT COUNT(*) FROM listings WHERE status = $1';
    const countParams = ['active'];

    if (search) {
      countQuery += ` AND (title ILIKE $${countParams.length + 1} OR description ILIKE $${countParams.length + 1})`;
      countParams.push(`%${search}%`);
    }

    if (category) {
      countQuery += ` AND category = $${countParams.length + 1}`;
      countParams.push(category);
    }

    if (minPrice) {
      countQuery += ` AND price >= $${countParams.length + 1}`;
      countParams.push(minPrice);
    }

    if (maxPrice) {
      countQuery += ` AND price <= $${countParams.length + 1}`;
      countParams.push(maxPrice);
    }

    const countResult = await pool.query(countQuery, countParams);
    const total = parseInt(countResult.rows[0].count);

    const listings = result.rows.map((l) => ({
      id: l.id,
      userId: l.user_id,
      title: l.title,
      description: l.description,
      category: l.category,
      price: l.price,
      currency: l.currency,
      imageUrl: l.image_url,
      authorName: toAuthorName(l),
      status: l.status,
      createdAt: l.created_at,
    }));

    res.json({
      listings,
      total,
      limit: parseInt(limit),
      offset: parseInt(offset),
    });
  } catch (error) {
    console.error('Get listings error:', error);
    res.status(500).json({ error: 'Failed to fetch listings' });
  }
};

const getListingById = async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(
      `SELECT l.id,
              l.user_id,
              l.title,
              l.description,
              l.category,
              l.price,
              l.currency,
              l.image_url,
              l.status,
              l.created_at,
              u.first_name AS author_first_name,
              u.last_name AS author_last_name,
              u.email AS author_email
       FROM listings l
       LEFT JOIN users u ON u.id = l.user_id
       WHERE l.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Listing not found' });
    }

    const listing = result.rows[0];
    res.json({
      id: listing.id,
      userId: listing.user_id,
      title: listing.title,
      description: listing.description,
      category: listing.category,
      price: listing.price,
      currency: listing.currency,
      imageUrl: listing.image_url,
      authorName: toAuthorName(listing),
      status: listing.status,
      createdAt: listing.created_at,
    });
  } catch (error) {
    console.error('Get listing error:', error);
    res.status(500).json({ error: 'Failed to fetch listing' });
  }
};

const updateListing = async (req, res) => {
  const userId = req.userId;
  const { id } = req.params;
  const { title, description, category, price, currency, imageUrl, status } = req.body;

  try {
    // Check ownership
    const ownership = await pool.query('SELECT user_id FROM listings WHERE id = $1', [id]);
    if (ownership.rows.length === 0) {
      return res.status(404).json({ error: 'Listing not found' });
    }

    if (ownership.rows[0].user_id !== userId) {
      return res.status(403).json({ error: 'Not authorized to update this listing' });
    }

    const result = await pool.query(
      `UPDATE listings
       SET title = COALESCE($1, title),
           description = COALESCE($2, description),
           category = COALESCE($3, category),
           price = COALESCE($4, price),
           currency = COALESCE($5, currency),
           image_url = COALESCE($6, image_url),
           status = COALESCE($7, status),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $8
       RETURNING id, user_id, title, description, category, price, currency, image_url, status, created_at,
                 (SELECT first_name FROM users WHERE id = user_id) AS author_first_name,
                 (SELECT last_name FROM users WHERE id = user_id) AS author_last_name,
                 (SELECT email FROM users WHERE id = user_id) AS author_email`,
      [title, description, category, price, currency, imageUrl, status, id]
    );

    const listing = result.rows[0];
    res.json({
      id: listing.id,
      userId: listing.user_id,
      title: listing.title,
      description: listing.description,
      category: listing.category,
      price: listing.price,
      currency: listing.currency,
      imageUrl: listing.image_url,
      authorName: toAuthorName(listing),
      status: listing.status,
      createdAt: listing.created_at,
    });
  } catch (error) {
    console.error('Update listing error:', error);
    res.status(500).json({ error: 'Failed to update listing' });
  }
};

const deleteListing = async (req, res) => {
  const userId = req.userId;
  const { id } = req.params;

  try {
    // Check ownership
    const ownership = await pool.query('SELECT user_id FROM listings WHERE id = $1', [id]);
    if (ownership.rows.length === 0) {
      return res.status(404).json({ error: 'Listing not found' });
    }

    if (ownership.rows[0].user_id !== userId) {
      return res.status(403).json({ error: 'Not authorized to delete this listing' });
    }

    await pool.query('DELETE FROM listings WHERE id = $1', [id]);
    res.json({ message: 'Listing deleted successfully' });
  } catch (error) {
    console.error('Delete listing error:', error);
    res.status(500).json({ error: 'Failed to delete listing' });
  }
};

module.exports = {
  createListing,
  getListings,
  getListingById,
  updateListing,
  deleteListing,
};
