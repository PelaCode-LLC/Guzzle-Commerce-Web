require('dotenv').config();
const { Pool } = require('pg');

// build PG config manually to avoid connectionString parsing issues
const pgConfig = {
  host: 'localhost',
  port: 5432,
  database: 'marketplace',
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
};

// add credentials only if provided
if (process.env.DB_USER) {
  pgConfig.user = process.env.DB_USER;
}
if (process.env.DB_PASSWORD) {
  pgConfig.password = process.env.DB_PASSWORD;
}

// if DATABASE_URL is provided **and includes credentials**, let it override individual parts
if (process.env.DATABASE_URL) {
  // crude check: user:pass@ should appear after protocol
  const url = process.env.DATABASE_URL;
  const credentialsPresent = url.match(/^[^:]+:\/\/[^@]+@/);
  if (credentialsPresent) {
    Object.assign(pgConfig, { connectionString: url });
  } else {
    console.log('⚠️ DATABASE_URL has no credentials; using individual config values');
  }
}

console.log('📦 PG config:', pgConfig);
const pool = new Pool(pgConfig);

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
});

module.exports = pool;
