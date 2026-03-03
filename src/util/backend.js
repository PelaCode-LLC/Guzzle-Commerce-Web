import { apiBaseUrl } from './api';

// helpers to interact with our custom backend API
const base = apiBaseUrl();

const handleResponse = async res => {
  const contentType = res.headers.get('Content-Type') || '';
  if (!res.ok) {
    let err;
    if (contentType.includes('application/json')) {
      err = await res.json();
    } else {
      err = { error: await res.text() };
    }
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

// More helper functions can be added as needed (transactions, messages, etc.)
