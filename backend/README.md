# Guzzle Commerce Backend API

A complete backend API for a marketplace application built with Node.js, Express, and PostgreSQL.

## Features

- ✅ User authentication (register, login) with JWT
- ✅ User profile management
- ✅ Listings (CRUD operations with search/filtering)
- ✅ PostgreSQL database with proper schema
- 🚧 Transactions (in progress)
- 🚧 Messaging (in progress)
- 🚧 Stripe payment integration (in progress)
- 🚧 Reviews & ratings (in progress)

## Prerequisites

- Node.js 16+
- PostgreSQL 12+
- npm or yarn

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Database Setup

Create a PostgreSQL database:

```bash
createdb marketplace
```

### 3. Environment Variables

Copy `.env.example` to `.env` and update with your values:

```bash
cp .env.example .env
```

Edit `.env`:

```
DATABASE_URL=postgresql://user:password@localhost:5432/marketplace
PORT=5000
NODE_ENV=development
JWT_SECRET=your-super-secret-key-change-in-production
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
FRONTEND_URL=http://localhost:3000
```

### 4. Initialize Database

The database schema is automatically created on first server startup. To manually initialize:

```bash
node -e "const init = require('./src/config/schema'); init();"
```

## Running the Server

### Development (with hot reload)

```bash
npm run dev
```

The server will start at `http://localhost:5000` with nodemon watching for changes.

### Production

```bash
npm start
```

## API Endpoints

### Authentication

- `POST /api/auth/register` - Register a new user
- `POST /api/auth/login` - Login and get JWT token

### Users

- `GET /api/users/me` - Get current user profile (requires auth)
- `GET /api/users/:id` - Get user profile by ID
- `PUT /api/users/me` - Update current user profile (requires auth)

### Listings

- `GET /api/listings` - Get all listings (with search/filter options)
  - Query params: `search`, `category`, `minPrice`, `maxPrice`, `limit`, `offset`
- `GET /api/listings/:id` - Get specific listing
- `POST /api/listings` - Create new listing (requires auth)
- `PUT /api/listings/:id` - Update listing (requires auth)
- `DELETE /api/listings/:id` - Delete listing (requires auth)

### Health Check

- `GET /api/health` - API health status

## Example Requests

### Register

```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "secure123",
    "firstName": "John",
    "lastName": "Doe"
  }'
```

### Login

```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "secure123"
  }'
```

### Get Current User

```bash
curl -X GET http://localhost:5000/api/users/me \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Create Listing

```bash
curl -X POST http://localhost:5000/api/listings \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "title": "Vintage Camera",
    "description": "Beautiful 35mm camera in good condition",
    "category": "Electronics",
    "price": 150.00,
    "currency": "USD",
    "imageUrl": "https://example.com/image.jpg"
  }'
```

### Search Listings

```bash
curl "http://localhost:5000/api/listings?search=camera&category=Electronics&minPrice=50&maxPrice=200"
```

## Project Structure

```
backend/
├── src/
│   ├── config/          # Configuration files (database, schema)
│   ├── controllers/     # Request handlers
│   ├── middleware/      # Custom middleware (auth, error handling)
│   ├── routes/          # API routes
│   ├── services/        # Business logic (for future use)
│   ├── index.js         # Main server file
├── .env.example         # Environment variables template
├── package.json         # Dependencies
└── README.md           # This file
```

## Next Steps

1. **Transactions**: Build payment and transaction logic
2. **Messaging**: Add real-time messaging between users
3. **Reviews**: Implement user reviews and ratings
4. **File uploads**: Add image upload functionality
5. **Testing**: Write comprehensive test suite
6. **Stripe integration**: Complete payment processing
7. **Email notifications**: Add email service

## Security Considerations

- Always use HTTPS in production
- Keep JWT_SECRET secure and unique per environment
- Validate all user inputs with Joi schemas
- Use prepared statements (using parameterized queries) to prevent SQL injection
- Implement rate limiting for API endpoints
- Add CORS properly for your frontend domain

## Troubleshooting

### Connection refused error

Ensure PostgreSQL is running:

```bash
# macOS with Homebrew
brew services start postgresql

# Linux
sudo service postgresql start

# Windows
# Start PostgreSQL service via Services app
```

### JWT token errors

Make sure you're sending the token in the `Authorization` header as:

```
Authorization: Bearer YOUR_TOKEN_HERE
```

## License

MIT
