const express = require('express');
const authMiddleware = require('../middleware/auth');
const {
  getInbox,
  getThread,
  sendMessage,
  markMessageRead,
} = require('../controllers/messageController');

const router = express.Router();

// GET /api/messages - list latest message per conversation for current user
router.get('/', authMiddleware, getInbox);

// GET /api/messages/thread/:otherUserId - list thread between current user and another user
router.get('/thread/:otherUserId', authMiddleware, getThread);

// POST /api/messages - send a message
router.post('/', authMiddleware, sendMessage);

// PATCH /api/messages/:messageId/read - mark a single message as read
router.patch('/:messageId/read', authMiddleware, markMessageRead);

module.exports = router;
