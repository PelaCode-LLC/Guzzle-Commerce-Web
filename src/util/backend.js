import { apiBaseUrl } from './api';
import { types as sdkTypes } from './sdkLoader';

// helpers to interact with our custom backend API
const backendBaseUrl = () => {
  const configured = process.env.REACT_APP_CUSTOM_BACKEND_URL;
  if (configured) {
    return configured.replace(/\/$/, '');
  }

  // Development fallback for local custom backend server.
  if (process.env.NODE_ENV === 'development') {
    return 'http://localhost:5000';
  }

  return apiBaseUrl();
};

const base = backendBaseUrl();
const { UUID, Money } = sdkTypes;

const handleResponse = async res => {
  const contentType = res.headers.get('Content-Type') || '';
  if (!res.ok) {
    let payload;
    if (contentType.includes('application/json')) {
      payload = await res.json();
    } else {
      payload = { error: await res.text() };
    }
    const message = payload?.error || payload?.message || res.statusText || 'Request failed';
    const err = {
      ...payload,
      message,
      status: res.status,
      statusText: res.statusText,
    };
    throw err;
  }
  if (contentType.includes('application/json')) {
    return res.json();
  }
  return res.text();
};

export const registerUser = async ({ email, password, firstName, lastName }) => {
  const res = await fetch(`${base}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, firstName, lastName }),
  });
  return handleResponse(res);
};

export const loginUser = async ({ email, password }) => {
  const res = await fetch(`${base}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  return handleResponse(res);
};

export const fetchMe = async token => {
  const res = await fetch(`${base}/api/users/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return handleResponse(res);
};

export const createListingBackend = async (token, data) => {
  const res = await fetch(`${base}/api/listings`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });
  return handleResponse(res);
};

export const updateListingBackend = async (token, listingId, data) => {
  const res = await fetch(`${base}/api/listings/${listingId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });
  return handleResponse(res);
};

export const deleteListingBackend = async (token, listingId) => {
  const res = await fetch(`${base}/api/listings/${listingId}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  return handleResponse(res);
};

// Listing/search helpers
export const searchListingsBackend = async params => {
  const query = new URLSearchParams();

  Object.entries(params || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      query.set(key, String(value));
    }
  });

  const url = `${base}/api/listings${query.toString() ? `?${query.toString()}` : ''}`;
  const res = await fetch(url, { method: 'GET' });
  return handleResponse(res);
};

export const fetchListingByIdBackend = async listingId => {
  const res = await fetch(`${base}/api/listings/${listingId}`, { method: 'GET' });
  return handleResponse(res);
};

const toHex = value => Number(value).toString(16).padStart(12, '0');

const imageVariantWidths = {
  'scaled-small': 400,
  'scaled-medium': 800,
  'scaled-large': 1200,
  'scaled-xlarge': 1600,
  'listing-card': 400,
  'listing-card-2x': 800,
  'listing-card-4x': 1600,
  'listing-card-6x': 2400,
  facebook: 1200,
  twitter: 800,
  'square-small': 40,
  'square-small2x': 80,
};

const createImageEntity = listing => {
  const imageUrl = listing?.imageUrl;

  if (!imageUrl) {
    return null;
  }

  const imageId = new UUID(toUuidFromBackendId(`9${listing.id || 1}`));
  const variants = Object.entries(imageVariantWidths).reduce((acc, [name, width]) => {
    acc[name] = {
      name,
      width,
      height: width,
      url: imageUrl,
    };
    return acc;
  }, {});

  return {
    id: imageId,
    type: 'image',
    attributes: {
      variants,
    },
  };
};

const createProfileImageEntity = (userId, avatarUrl) => {
  if (!avatarUrl) {
    return null;
  }

  const imageId = new UUID(toUuidFromBackendId(`8${userId || 1}`));
  const variants = {
    'square-small': {
      name: 'square-small',
      width: 40,
      height: 40,
      url: avatarUrl,
    },
    'square-small2x': {
      name: 'square-small2x',
      width: 80,
      height: 80,
      url: avatarUrl,
    },
    'square-xsmall': {
      name: 'square-xsmall',
      width: 40,
      height: 40,
      url: avatarUrl,
    },
    'square-xsmall2x': {
      name: 'square-xsmall2x',
      width: 80,
      height: 80,
      url: avatarUrl,
    },
  };

  return {
    id: imageId,
    type: 'image',
    attributes: {
      variants,
    },
  };
};

const fileToDataUrl = file =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Failed to read image file'));
    reader.readAsDataURL(file);
  });

export const uploadProfileImageBackend = async (file, userId) => {
  if (!file) {
    throw new Error('Missing image file');
  }

  const avatarUrl = await fileToDataUrl(file);
  const uploadedImage = createProfileImageEntity(userId, avatarUrl);

  return {
    avatarUrl,
    uploadedImage,
  };
};

export const updateCurrentUserProfileBackend = async (token, profileData) => {
  const res = await fetch(`${base}/api/users/me`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(profileData),
  });
  return handleResponse(res);
};

export const toUuidFromBackendId = value => {
  const numeric = Number(value);
  const safe = Number.isFinite(numeric) && numeric > 0 ? numeric : 1;
  return `00000000-0000-0000-0000-${toHex(safe)}`;
};

export const toBackendIdFromUuid = uuid => {
  const raw =
    typeof uuid === 'string'
      ? uuid
      : uuid?.uuid ||
        uuid?._uuid ||
        (typeof uuid?.toString === 'function' ? uuid.toString() : String(uuid || ''));
  const str = String(raw || '');
  const last = str.split('-').pop() || '1';
  const parsed = Number.parseInt(last, 16);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
};

const abbreviateName = name => {
  if (!name) {
    return 'U';
  }
  return name
    .split(' ')
    .map(part => part.charAt(0).toUpperCase())
    .join('')
    .slice(0, 2);
};

export const toSdkCurrentUser = user => {
  const firstName = user?.firstName || '';
  const lastName = user?.lastName || '';
  const fullName = `${firstName} ${lastName}`.trim();
  const displayName = fullName || user?.email || 'User';
  const avatarUrl = user?.avatarUrl || null;
  const profileImage = createProfileImageEntity(user?.id || 1, avatarUrl);

  return {
    id: new UUID(toUuidFromBackendId(user?.id || 1)),
    type: 'currentUser',
    attributes: {
      email: user?.email || '',
      emailVerified: true,
      state: 'active',
      profile: {
        firstName,
        lastName,
        bio: user?.bio || '',
        displayName,
        abbreviatedName: abbreviateName(displayName),
        publicData: {},
        protectedData: {},
        privateData: {},
      },
    },
    profileImage,
    effectivePermissionSet: {
      id: new UUID('00000000-0000-0000-0000-000000000001'),
      type: 'permissionSet',
      attributes: {
        postListings: 'permission/allow',
        initiateTransactions: 'permission/allow',
        read: 'permission/allow',
      },
    },
  };
};

const toSdkListing = listing => {
  const listingUuid = new UUID(toUuidFromBackendId(listing.id));
  const authorUuid = new UUID(toUuidFromBackendId(listing.userId || 1));
  const displayName = listing.authorName || `User ${listing.userId || ''}`.trim();
  const amount = Math.round(Number(listing.price || 0) * 100);
  const image = createImageEntity(listing);

  return {
    listing: {
      id: listingUuid,
      type: 'listing',
      attributes: {
        title: listing.title || '',
        description: listing.description || '',
        geolocation: null,
        price: new Money(amount, listing.currency || 'USD'),
        deleted: false,
        state: 'published',
        publicData: {
          listingType: 'default',
          transactionProcessAlias: 'default-purchase/release-1',
          unitType: 'item',
          cardStyle: 'default',
          pickupEnabled: false,
          shippingEnabled: false,
          priceVariationsEnabled: false,
          priceVariants: [],
        },
      },
      relationships: {
        author: {
          data: {
            id: authorUuid,
            type: 'user',
          },
        },
        images: {
          data: image
            ? [
                {
                  id: image.id,
                  type: 'image',
                },
              ]
            : [],
        },
      },
    },
    author: {
      id: authorUuid,
      type: 'user',
      attributes: {
        profile: {
          displayName,
          abbreviatedName: abbreviateName(displayName),
        },
      },
    },
    image,
  };
};

export const toSdkSearchResponse = (payload, page = 1, perPage = 24) => {
  const listings = Array.isArray(payload?.listings) ? payload.listings : [];
  const mapped = listings.map(toSdkListing);
  const totalItems = Number(payload?.total || listings.length || 0);

  return {
    data: {
      data: mapped.map(m => m.listing),
      included: mapped.flatMap(m => (m.image ? [m.author, m.image] : [m.author])),
      meta: {
        page,
        perPage,
        totalItems,
        totalPages: Math.max(1, Math.ceil(totalItems / perPage)),
      },
    },
  };
};

export const toSdkOwnListingsQueryResponse = (payload, page = 1, perPage = 42) => {
  const listings = Array.isArray(payload?.listings) ? payload.listings : [];
  const mapped = listings.map(listing => {
    const converted = toSdkOwnListingResponse(listing).data;
    const ownListing = converted.data;
    const included = converted.included || [];
    return { ownListing, included };
  });
  const totalItems = Number(payload?.total || listings.length || 0);

  return {
    data: {
      data: mapped.map(m => m.ownListing),
      included: mapped.flatMap(m => m.included),
      meta: {
        page,
        perPage,
        totalItems,
        totalPages: Math.max(1, Math.ceil(totalItems / perPage)),
      },
    },
  };
};

export const toSdkSingleListingResponse = listing => {
  const mapped = toSdkListing(listing || {});
  return {
    data: {
      data: mapped.listing,
      included: mapped.image ? [mapped.author, mapped.image] : [mapped.author],
    },
  };
};

const toListingStateFromBackendStatus = status => {
  if (status === 'draft') {
    return 'draft';
  }
  if (status === 'active') {
    return 'published';
  }
  return status || 'published';
};

export const toSdkOwnListingResponse = (listing, forcedState) => {
  const mapped = toSdkListing(listing || {});
  const ownListingState = forcedState || toListingStateFromBackendStatus(listing?.status);
  return {
    data: {
      data: {
        ...mapped.listing,
        type: 'ownListing',
        attributes: {
          ...mapped.listing.attributes,
          state: ownListingState,
        },
      },
      included: mapped.image ? [mapped.author, mapped.image] : [mapped.author],
    },
  };
};

