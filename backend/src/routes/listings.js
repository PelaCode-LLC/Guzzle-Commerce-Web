const express = require('express');
const authMiddleware = require('../middleware/auth');
const {
  createListing,
  getListings,
  getListingById,
  updateListing,
  deleteListing,
} = require('../controllers/listingController');

const router = express.Router();

// GET /api/listings - Get all listings with search/filter
router.get('/', getListings);

// GET /api/listings/:id - Get specific listing
router.get('/:id', getListingById);

// POST /api/listings - Create new listing
router.post('/', authMiddleware, createListing);

// PUT /api/listings/:id - Update listing
router.put('/:id', authMiddleware, updateListing);

// DELETE /api/listings/:id - Delete listing
router.delete('/:id', authMiddleware, deleteListing);

module.exports = router;
