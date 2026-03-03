const express = require('express');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// Placeholder routes for transactions
router.get('/', authMiddleware, (req, res) => {
  res.json({ message: 'Transactions endpoint - coming soon' });
});

router.post('/', authMiddleware, (req, res) => {
  res.json({ message: 'Create transaction - coming soon' });
});

module.exports = router;
