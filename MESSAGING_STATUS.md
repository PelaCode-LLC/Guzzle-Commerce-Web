# Messaging Functionality - Implementation Status

## Overview

Messaging is now **ready for UI integration**. The backend API and frontend data layer are fully operational, with automatic fallback support that allows users to send messages during transactions either through your custom backend (when JWT is present) or through Sharetribe SDK messaging (when using Sharetribe auth).

## What's Implemented

### Backend (Node.js/Express)

**New file:** [`backend/src/controllers/messageController.js`](backend/src/controllers/messageController.js)
- `getInbox(req, res)` - List latest messages per conversation, grouped by sender/recipient
- `getThread(req, res)` - Full message thread between two users, with optional transaction filter
- `sendMessage(req, res)` - Send a message with recipient/content + optional transaction link
- `markMessageRead(req, res)` - Mark a single message as read (only by recipient)

**Updated file:** [`backend/src/routes/messages.js`](backend/src/routes/messages.js)
- Replaced placeholder endpoints with real message routes backed by the controller
- Fully integrated with authentication middleware

**Database:** Uses existing `messages` table in `backend/src/config/schema.js`
```
messages: sender_id, recipient_id, transaction_id, content, is_read, created_at
```

### Frontend (React/Redux)

**Updated file:** [`src/util/backend.js`](src/util/backend.js)
- `fetchInboxBackend(token, params)` - GET /api/messages
- `fetchMessageThreadBackend(token, { otherUserId, transactionId, limit, offset })` - GET /api/messages/thread/:otherUserId
- `sendMessageBackend(token, { recipientId, content, transactionId })` - POST /api/messages
- `markMessageReadBackend(token, messageId)` - PATCH /api/messages/:messageId/read

**Updated file:** [`src/containers/TransactionPage/TransactionPage.duck.js`](src/containers/TransactionPage/TransactionPage.duck.js)
- Added automatic JWT detection (`getStoredJwt()`)
- Added backend thread context extraction (`getBackendThreadContext()`)
- Added SDK→backend mapping utilities:
  - `toSdkMessageFromBackend()` - Maps backend messages to SDK message shape
  - `toSdkUserFromBackend()` - Maps backend users to SDK user shape
- Modified `fetchMessagesThunk` to use backend API if JWT is present, else falls back to SDK
- Modified `sendMessageThunk` to use backend API if JWT is present, else falls back to SDK

### How It Works

When a user with a local JWT token (custom backend auth) opens `TransactionPage`:

1. On render, `TransactionPage.duck.js` calls `loadData()` which dispatches `fetchMessagesThunk`
2. The thunk checks for a stored JWT token: `getStoredJwt()`
3. If JWT exists and valid transaction context found:
   - Extracts transaction buyer/seller IDs
   - Calls `fetchMessageThreadBackend()` with the other party's backend ID
   - Maps returned backend messages to SDK message format (for UI compatibility)
   - Stores in Redux state as usual
4. If no JWT or invalid context:
   - Falls back to traditional SDK messaging call
   - Works seamlessly for users on Sharetribe auth

**Same pattern applies to:** `sendMessageThunk` that was already there

### Testing

- ✅ Backend message controller tests: 5/5 passing
- ✅ Backend routes updated and tested with authentication
- ✅ Message validation: self-messaging blocked, recipient existence checked, transaction participant validation
- ✅ Frontend duck modifications don't break existing SDK flow

## What's Next (UI Integration)

To activate messaging in the UI, the following components are ready to connect:

### 1. **TransactionPage Activity Feed** (Already wired to accept messages)
   - Location: `src/containers/TransactionPage/ActivityFeed/ActivityFeed.js`
   - Renders `messages` prop directly from Redux state
   - Messages flow through automatically

### 2. **SendMessageForm** (Already exists)
   - Location: `src/containers/TransactionPage/SendMessageForm/SendMessageForm.js`
   - Calls `onSendMessage(txId, messageContent, config)` on submit
   - Automatically uses backend API if JWT is present

### 3. **InboxPage** (Ready for backend integration)
   - Location: `src/containers/InboxPage/InboxPage.duck.js`
   - Currently loads transactions via SDK
   - Can be extended to load message threads via `fetchInboxBackend(token, params)`

## Environment Setup

For local testing with backend messaging:

```bash
# Start backend server
npm --prefix backend run dev

# Backend will initialize database schema on first run
# Messages table is part of standard schema
```

Set environment variable to use custom backend:
```
REACT_APP_CUSTOM_BACKEND_URL=http://localhost:5000
```

Then login with a custom backend user (not Sharetribe SDK auth).

## Database Schema

Messages table (created automatically):
```sql
CREATE TABLE messages (
  id SERIAL PRIMARY KEY,
  sender_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recipient_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  transaction_id INTEGER REFERENCES transactions(id) ON DELETE SET NULL,
  content TEXT NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_messages_recipient_id ON messages(recipient_id);
```

## API Endpoints

All authenticated endpoints (require Bearer token in Authorization header):

```
GET    /api/messages                    - List inbox conversations
GET    /api/messages/thread/:otherUserId - Get thread with user
POST   /api/messages                    - Send a message
PATCH  /api/messages/:messageId/read    - Mark message as read
```

See `backend/README.md` for detailed endpoint documentation.

## Troubleshooting

**Q: Messages not appearing in TransactionPage?**  
A: Check browser console for JWT token presence. If no JWT, ensure you're logged in with custom backend auth. If JWT exists, verify:
- Backend server is running on correct port (default 5000)
- `REACT_APP_CUSTOM_BACKEND_URL` environment variable is set
- Backend database is initialized

**Q: Getting 401/403 on message requests?**  
A: Verify JWT token is valid and hasn't expired. Check backend auth middleware in `backend/src/middleware/auth.js`.

**Q: Messages appear but look wrong?**  
A: Frontend expects SDK message format. If using backend, the `toSdkMessageFromBackend()` utility handles mapping. Check Redux state in dev tools to verify structure.

## References

- **Decoupling Plan:** [SHARETRIBE_DECOUPLING_MATRIX.md](SHARETRIBE_DECOUPLING_MATRIX.md#messaging)
- **Backend API:** [backend/README.md](backend/README.md#messages)
- **Frontend Utils:** [src/util/backend.js](src/util/backend.js)
- **Messages Controller:** [backend/src/controllers/messageController.js](backend/src/controllers/messageController.js)

---

**Status:** ✅ Ready for UI testing and deployment  
**Last Updated:** April 6, 2026
