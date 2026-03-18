const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const pool = require('../config/database');
const authMiddleware = require('../middleware/auth');
const { getUserProfile, getCurrentUser, updateUserProfile } = require('../controllers/userController');

const router = express.Router();

// Ensure avatar uploads directory exists
const avatarsDir = path.join(__dirname, '../../uploads/avatars');
if (!fs.existsSync(avatarsDir)) {
  fs.mkdirSync(avatarsDir, { recursive: true });
}

const avatarStorage = multer.diskStorage({
  destination: avatarsDir,
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, `avatar-${req.userId}-${Date.now()}${ext}`);
  },
});

const uploadAvatar = multer({
  storage: avatarStorage,
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

  const avatarUrl = `/uploads/avatars/${req.file.filename}`;

  try {
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
