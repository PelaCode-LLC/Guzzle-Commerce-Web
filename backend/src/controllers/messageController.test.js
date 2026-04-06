const pool = require('../config/database');
const {
  getInbox,
  getThread,
  sendMessage,
  markMessageRead,
} = require('./messageController');

// Mock database
jest.mock('../config/database', () => ({
  query: jest.fn(),
}));

describe('messageController', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('sendMessage', () => {
    it('rejects sending a message to yourself', async () => {
      const req = {
        userId: 42,
        body: {
          recipientId: 42,
          content: 'Hello',
          transactionId: null,
        },
      };

      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };

      await sendMessage(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.stringContaining('Cannot send a message to yourself'),
        })
      );
    });

    it('requires valid recipient and content', async () => {
      const req = {
        userId: 42,
        body: {
          recipientId: '',
          content: '',
        },
      };

      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };

      await sendMessage(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.any(String),
        })
      );
    });

    it('returns 404 when recipient user does not exist', async () => {
      pool.query.mockResolvedValueOnce({ rows: [] }); // recipient query returns no results

      const req = {
        userId: 42,
        body: {
          recipientId: 999,
          content: 'Hello',
          transactionId: null,
        },
      };

      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };

      await sendMessage(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.stringContaining('Recipient not found'),
        })
      );
    });
  });

  describe('markMessageRead', () => {
    it('rejects invalid messageId parameter', async () => {
      const req = {
        userId: 42,
        params: {
          messageId: 'invalid',
        },
      };

      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };

      await markMessageRead(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.stringContaining('Invalid messageId'),
        })
      );
    });

    it('returns 404 when message not found or user is not recipient', async () => {
      pool.query.mockResolvedValueOnce({ rows: [] }); // mark read query returns no results

      const req = {
        userId: 42,
        params: {
          messageId: 999,
        },
      };

      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };

      await markMessageRead(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.stringContaining('Message not found'),
        })
      );
    });
  });
});
