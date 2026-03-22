require('dotenv').config();
const { Pool } = require('pg');

const parseBoolean = (value, defaultValue = false) => {
  if (value === undefined) {
    return defaultValue;
  }

  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
};

const isProduction = process.env.NODE_ENV === 'production';
const useConnectionString = Boolean(process.env.DATABASE_URL);
const sslEnabled = isProduction && process.env.DATABASE_SSL_MODE !== 'disable';
const rejectUnauthorized = parseBoolean(process.env.DB_SSL_REJECT_UNAUTHORIZED, false);

const pgConfig = useConnectionString
  ? {
      connectionString: process.env.DATABASE_URL,
    }
  : {
      host: process.env.DB_HOST || 'localhost',
      port: Number(process.env.DB_PORT || 5432),
      database: process.env.DB_NAME || 'marketplace',
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
    };

if (sslEnabled) {
  pgConfig.ssl = { rejectUnauthorized };
}

const safeLogConfig = {
  ...pgConfig,
  password: pgConfig.password ? '***' : undefined,
  connectionString: pgConfig.connectionString ? '***' : undefined,
};

console.log('📦 PG config:', safeLogConfig);
const pool = new Pool(pgConfig);

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
});

module.exports = pool;
