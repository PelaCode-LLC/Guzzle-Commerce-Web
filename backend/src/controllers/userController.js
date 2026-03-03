const pool = require('../config/database');

const getUserProfile = async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(
      `SELECT id, email, first_name, last_name, avatar_url, bio, phone, address, city, country, created_at
       FROM users WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = result.rows[0];
    res.json({
      id: user.id,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      avatarUrl: user.avatar_url,
      bio: user.bio,
      phone: user.phone,
      address: user.address,
      city: user.city,
      country: user.country,
      createdAt: user.created_at,
    });
  } catch (error) {
    console.error('Get user profile error:', error);
    res.status(500).json({ error: 'Failed to fetch user profile' });
  }
};

const getCurrentUser = async (req, res) => {
  const userId = req.userId;

  try {
    const result = await pool.query(
      `SELECT id, email, first_name, last_name, avatar_url, bio, phone, address, city, country, created_at
       FROM users WHERE id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = result.rows[0];
    res.json({
      id: user.id,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      avatarUrl: user.avatar_url,
      bio: user.bio,
      phone: user.phone,
      address: user.address,
      city: user.city,
      country: user.country,
      createdAt: user.created_at,
    });
  } catch (error) {
    console.error('Get current user error:', error);
    res.status(500).json({ error: 'Failed to fetch user profile' });
  }
};

const updateUserProfile = async (req, res) => {
  const userId = req.userId;
  const { firstName, lastName, bio, phone, address, city, country, avatarUrl } = req.body;

  try {
    const result = await pool.query(
      `UPDATE users
       SET first_name = COALESCE($1, first_name),
           last_name = COALESCE($2, last_name),
           bio = COALESCE($3, bio),
           phone = COALESCE($4, phone),
           address = COALESCE($5, address),
           city = COALESCE($6, city),
           country = COALESCE($7, country),
           avatar_url = COALESCE($8, avatar_url),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $9
       RETURNING id, email, first_name, last_name, avatar_url, bio, phone, address, city, country`,
      [firstName, lastName, bio, phone, address, city, country, avatarUrl, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = result.rows[0];
    res.json({
      message: 'Profile updated successfully',
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        avatarUrl: user.avatar_url,
        bio: user.bio,
        phone: user.phone,
        address: user.address,
        city: user.city,
        country: user.country,
      },
    });
  } catch (error) {
    console.error('Update user profile error:', error);
    res.status(500).json({ error: 'Failed to update user profile' });
  }
};

module.exports = {
  getUserProfile,
  getCurrentUser,
  updateUserProfile,
};
