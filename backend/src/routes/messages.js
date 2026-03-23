const express = require('express');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// Placeholder routes for messages
router.get('/', authMiddleware, (req, res) => {
  res.json({ message: 'Messages endpoint - coming soon' });
});

router.post('/', authMiddleware, (req, res) => {
  res.json({ message: 'Send message - coming soon' });
});

module.exports = router;
