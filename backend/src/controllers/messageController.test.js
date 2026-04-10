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

  describe('getInbox', () => {
    it('returns separate listing-scoped conversations with listing metadata', async () => {
      pool.query
        .mockResolvedValueOnce({
          rows: [
            {
              id: 11,
              sender_id: 9,
              recipient_id: 42,
              transaction_id: null,
              listing_id: 77,
              content: 'Still available?',
              is_read: false,
              created_at: '2026-04-10T12:00:00.000Z',
              other_user_id: 9,
              conversation_scope_type: 'listing',
              conversation_scope_id: 77,
              first_name: 'John',
              last_name: 'Doe',
              avatar_url: null,
              unread_count: 1,
              listing_title: 'Truck',
              listing_image_url: 'https://example.com/truck.jpg',
            },
            {
              id: 12,
              sender_id: 9,
              recipient_id: 42,
              transaction_id: null,
              listing_id: 78,
              content: 'Can you ship the part?',
              is_read: false,
              created_at: '2026-04-10T12:01:00.000Z',
              other_user_id: 9,
              conversation_scope_type: 'listing',
              conversation_scope_id: 78,
              first_name: 'John',
              last_name: 'Doe',
              avatar_url: null,
              unread_count: 2,
              listing_title: 'Truck Part',
              listing_image_url: 'https://example.com/part.jpg',
            },
          ],
        })
        .mockResolvedValueOnce({ rows: [{ count: 2 }] });

      const req = {
        userId: 42,
        query: {},
      };
      const res = {
        json: jest.fn(),
        status: jest.fn().mockReturnThis(),
      };

      await getInbox(req, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          total: 2,
          conversations: expect.arrayContaining([
            expect.objectContaining({
              key: 'listing:77:9',
              listing: expect.objectContaining({ id: 77, title: 'Truck' }),
            }),
            expect.objectContaining({
              key: 'listing:78:9',
              listing: expect.objectContaining({ id: 78, title: 'Truck Part' }),
            }),
          ]),
        })
      );
    });
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

    it('rejects listing-scoped messages when the recipient does not own the listing', async () => {
      pool.query
        .mockResolvedValueOnce({ rows: [{ id: 9, first_name: 'John', last_name: 'Doe' }] })
        .mockResolvedValueOnce({ rows: [{ id: 77, user_id: 123 }] });

      const req = {
        userId: 42,
        body: {
          recipientId: 9,
          listingId: 77,
          content: 'Hello',
          transactionId: null,
        },
      };

      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };

      await sendMessage(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.stringContaining('Recipient must be the owner of the referenced listing'),
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
