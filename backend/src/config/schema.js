const pool = require('../config/database');

const initializeDatabase = async () => {
  try {
    // Users table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        first_name VARCHAR(100),
        last_name VARCHAR(100),
        avatar_url TEXT,
        bio TEXT,
        phone VARCHAR(20),
        address TEXT,
        city VARCHAR(100),
        country VARCHAR(100),
        stripe_customer_id VARCHAR(255),
        is_verified BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Listings table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS listings (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        category VARCHAR(100),
        price DECIMAL(10, 2) NOT NULL,
        currency VARCHAR(3) DEFAULT 'USD',
        image_url TEXT,
        status VARCHAR(50) DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Listing images table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS listing_images (
        id SERIAL PRIMARY KEY,
        listing_id INTEGER NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
        image_url TEXT NOT NULL,
        alt_text VARCHAR(255),
        sort_order INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Transactions table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS transactions (
        id SERIAL PRIMARY KEY,
        listing_id INTEGER NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
        buyer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        seller_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        status VARCHAR(50) DEFAULT 'pending',
        quantity INTEGER DEFAULT 1,
        total_price DECIMAL(10, 2) NOT NULL,
        currency VARCHAR(3) DEFAULT 'USD',
        stripe_payment_id VARCHAR(255),
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Messages table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS messages (
        id SERIAL PRIMARY KEY,
        sender_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        recipient_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        transaction_id INTEGER REFERENCES transactions(id) ON DELETE SET NULL,
        listing_id INTEGER REFERENCES listings(id) ON DELETE SET NULL,
        content TEXT NOT NULL,
        is_read BOOLEAN DEFAULT FALSE,
        sender_deleted_at TIMESTAMP,
        recipient_deleted_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await pool.query(`
      ALTER TABLE messages
      ADD COLUMN IF NOT EXISTS listing_id INTEGER REFERENCES listings(id) ON DELETE SET NULL;
    `);

    await pool.query(`
      ALTER TABLE messages
      ADD COLUMN IF NOT EXISTS sender_deleted_at TIMESTAMP;
    `);

    await pool.query(`
      ALTER TABLE messages
      ADD COLUMN IF NOT EXISTS recipient_deleted_at TIMESTAMP;
    `);

    // Reviews table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS reviews (
        id SERIAL PRIMARY KEY,
        transaction_id INTEGER NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
        reviewer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        reviewed_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        rating INTEGER CHECK (rating >= 1 AND rating <= 5),
        comment TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create indexes for better query performance
    await pool.query('CREATE INDEX IF NOT EXISTS idx_listings_user_id ON listings(user_id);');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_transactions_buyer_id ON transactions(buyer_id);');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_transactions_seller_id ON transactions(seller_id);');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_messages_recipient_id ON messages(recipient_id);');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON messages(sender_id);');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_messages_listing_id ON messages(listing_id);');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_messages_transaction_id ON messages(transaction_id);');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_reviews_reviewed_user_id ON reviews(reviewed_user_id);');

    console.log('✅ Database initialized successfully');
  } catch (error) {
    console.error('❌ Database initialization error:', error);
    throw error;
  }
};

module.exports = initializeDatabase;
