jest.mock('../config/database', () => ({
  query: jest.fn(),
}));

const pool = require('../config/database');
const {
  getOwnListings,
  updateListing,
  deleteListing,
} = require('./listingController');

const createRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe('listing ownership safeguards', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('getOwnListings scopes query to authenticated user', async () => {
    const req = {
      userId: 42,
      query: {
        limit: 10,
        offset: 0,
      },
    };
    const res = createRes();

    pool.query
      .mockResolvedValueOnce({
        rows: [
          {
            id: 10,
            user_id: 42,
            title: 'My camera',
            description: 'Owned by me',
            category: 'Electronics',
            price: '99.00',
            currency: 'USD',
            image_url: null,
            status: 'active',
            created_at: new Date('2026-03-21T00:00:00.000Z'),
            author_first_name: 'Owner',
            author_last_name: 'User',
            author_email: 'owner@example.com',
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [{ count: '1' }] });

    await getOwnListings(req, res);

    expect(pool.query).toHaveBeenCalledTimes(2);

    const [listQuery, listParams] = pool.query.mock.calls[0];
    const [countQuery, countParams] = pool.query.mock.calls[1];

    expect(listQuery).toContain('l.user_id =');
    expect(countQuery).toContain('user_id =');
    expect(listParams).toEqual(expect.arrayContaining([42]));
    expect(countParams).toEqual(expect.arrayContaining([42]));

    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        total: 1,
        listings: [
          expect.objectContaining({
            userId: 42,
            title: 'My camera',
          }),
        ],
      })
    );
  });

  it('updateListing rejects non-owners with 403', async () => {
    const req = {
      userId: 7,
      params: { id: '123' },
      body: {
        title: 'Hacked title',
      },
    };
    const res = createRes();

    pool.query.mockResolvedValueOnce({ rows: [{ user_id: 99 }] });

    await updateListing(req, res);

    expect(pool.query).toHaveBeenCalledTimes(1);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: 'Not authorized to update this listing' });
  });

  it('deleteListing rejects non-owners with 403', async () => {
    const req = {
      userId: 7,
      params: { id: '123' },
    };
    const res = createRes();

    pool.query.mockResolvedValueOnce({ rows: [{ user_id: 99 }] });

    await deleteListing(req, res);

    expect(pool.query).toHaveBeenCalledTimes(1);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: 'Not authorized to delete this listing' });
  });
});
