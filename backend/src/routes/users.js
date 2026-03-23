const express = require('express');
const path = require('path');
const multer = require('multer');
const pool = require('../config/database');
const authMiddleware = require('../middleware/auth');
const { getUserProfile, getCurrentUser, updateUserProfile } = require('../controllers/userController');
const { uploadFile, deleteFile, keyFromUrl } = require('../services/storage');

const router = express.Router();

// Use memory storage so the buffer can be forwarded to R2 (or saved to disk
// via the storage service) without writing a temp file.
const uploadAvatar = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  },
});

// GET /api/users/me - Get current user profile
router.get('/me', authMiddleware, getCurrentUser);

// GET /api/users/:id - Get user profile by ID
router.get('/:id', getUserProfile);

// PUT /api/users/me - Update current user profile
router.put('/me', authMiddleware, updateUserProfile);

// POST /api/users/me/avatar - Upload and persist profile picture
router.post('/me/avatar', authMiddleware, (req, res, next) => {
  uploadAvatar.single('image')(req, res, err => {
    if (err) {
      return res.status(400).json({ error: err.message });
    }
    next();
  });
}, async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No image file provided' });
  }

  try {
    // Delete previous avatar from storage if one exists
    const existing = await pool.query('SELECT avatar_url FROM users WHERE id = $1', [req.userId]);
    const oldUrl = existing.rows[0]?.avatar_url;
    if (oldUrl) {
      const oldKey = keyFromUrl(oldUrl);
      if (oldKey) {
        await deleteFile(oldKey).catch(() => {}); // best-effort
      }
    }

    const ext = path.extname(req.file.originalname) || '.jpg';
    const key = `avatars/avatar-${req.userId}-${Date.now()}${ext}`;
    const avatarUrl = await uploadFile({
      buffer: req.file.buffer,
      key,
      mimeType: req.file.mimetype,
    });

    await pool.query(
      'UPDATE users SET avatar_url = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [avatarUrl, req.userId]
    );
    res.json({ avatarUrl });
  } catch (err) {
    console.error('Avatar upload error:', err);
    res.status(500).json({ error: 'Failed to save avatar' });
  }
});

module.exports = router;
