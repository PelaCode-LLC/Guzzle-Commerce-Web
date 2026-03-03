const express = require('express');
const authMiddleware = require('../middleware/auth');
const { getUserProfile, getCurrentUser, updateUserProfile } = require('../controllers/userController');

const router = express.Router();

// GET /api/users/me - Get current user profile
router.get('/me', authMiddleware, getCurrentUser);

// GET /api/users/:id - Get user profile by ID
router.get('/:id', getUserProfile);

// PUT /api/users/me - Update current user profile
router.put('/me', authMiddleware, updateUserProfile);

module.exports = router;
