// =========================================
// SmartPOS - API Client
// Thin fetch() wrapper that talks to the Express backend.
// =========================================

// IMPORTANT: this defaults to the backend's own address (port 5000).
// This matters because the frontend can be opened in more than one way:
//   1. Via the backend itself: http://localhost:5000            -> same origin either way
//   2. Via a separate static server / VS Code "Live Server": http://127.0.0.1:5500
//   3. Directly as a file:// path
// In cases 2 and 3, a *relative* '/api' path would incorrectly try to reach
// whatever is serving the frontend (which doesn't understand POST/PUT/DELETE
// and returns 405 Method Not Allowed) instead of the real Node API.
// Pointing directly at the backend's own host/port avoids that entirely.
// If you deploy the API somewhere else, override it before this script loads:
//   <script>window.SMARTPOS_API_BASE_URL = 'https://your-api-domain.com/api';</script>
const API_BASE_URL = window.SMARTPOS_API_BASE_URL || 'http://localhost:5000/api';

const TOKEN_KEY = 'smartpos_token';
const USER_KEY = 'smartpos_user';
const BUSINESS_KEY = 'smartpos_business';

const Auth = {
  getToken() {
    return localStorage.getItem(TOKEN_KEY);
  },
  getUser() {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  },
  getBusiness() {
    const raw = localStorage.getItem(BUSINESS_KEY);
    return raw ? JSON.parse(raw) : null;
  },
  setSession({ token, user, business }) {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    localStorage.setItem(BUSINESS_KEY, JSON.stringify(business));
  },
  clearSession() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(BUSINESS_KEY);
  },
  isLoggedIn() {
    return !!this.getToken();
  },
};

/**
 * Core request helper. Automatically attaches the JWT (if present) and
 * parses JSON. Throws an Error with the server's message on failure.
 */
async function apiRequest(path, { method = 'GET', body, auth = true } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (auth && Auth.getToken()) {
    headers.Authorization = `Bearer ${Auth.getToken()}`;
  }

  let response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (networkErr) {
    throw new Error('Could not reach the server. Is the backend running?');
  }

  let data = null;
  try {
    data = await response.json();
  } catch (e) {
    // no JSON body
  }

  if (!response.ok) {
    if (response.status === 401 && auth) {
      // Token expired / invalid - force logout
      Auth.clearSession();
    }
    if (response.status === 402 && typeof window.onSubscriptionExpired === 'function') {
      // Only dashboard.html defines this hook (see js/app.js). It shows a
      // renewal modal instead of leaving the person stuck on a bare error.
      window.onSubscriptionExpired();
    }
    throw new Error((data && data.message) || `Request failed (${response.status})`);
  }

  return data;
}

// Convenience wrapper grouped by resource
const Api = {
  auth: {
    registerBusiness: (payload) => apiRequest('/auth/register-business', { method: 'POST', body: payload, auth: false }),
    login: (payload) => apiRequest('/auth/login', { method: 'POST', body: payload, auth: false }),
    me: () => apiRequest('/auth/me'),
    changePassword: (payload) => apiRequest('/auth/change-password', { method: 'PUT', body: payload }),
  },
  users: {
    list: () => apiRequest('/users'),
    create: (payload) => apiRequest('/users', { method: 'POST', body: payload }),
    update: (id, payload) => apiRequest(`/users/${id}`, { method: 'PUT', body: payload }),
    resetPassword: (id, newPassword) => apiRequest(`/users/${id}/reset-password`, { method: 'PUT', body: { newPassword } }),
    remove: (id) => apiRequest(`/users/${id}`, { method: 'DELETE' }),
  },
  categories: {
    list: () => apiRequest('/categories'),
    create: (payload) => apiRequest('/categories', { method: 'POST', body: payload }),
    update: (id, payload) => apiRequest(`/categories/${id}`, { method: 'PUT', body: payload }),
    remove: (id) => apiRequest(`/categories/${id}`, { method: 'DELETE' }),
  },
  products: {
    list: (query = '') => apiRequest(`/products${query}`),
    create: (payload) => apiRequest('/products', { method: 'POST', body: payload }),
    update: (id, payload) => apiRequest(`/products/${id}`, { method: 'PUT', body: payload }),
    remove: (id) => apiRequest(`/products/${id}`, { method: 'DELETE' }),
  },
  customers: {
    list: (query = '') => apiRequest(`/customers${query}`),
    create: (payload) => apiRequest('/customers', { method: 'POST', body: payload }),
    update: (id, payload) => apiRequest(`/customers/${id}`, { method: 'PUT', body: payload }),
    remove: (id) => apiRequest(`/customers/${id}`, { method: 'DELETE' }),
  },
  suppliers: {
    list: () => apiRequest('/suppliers'),
    create: (payload) => apiRequest('/suppliers', { method: 'POST', body: payload }),
    update: (id, payload) => apiRequest(`/suppliers/${id}`, { method: 'PUT', body: payload }),
    remove: (id) => apiRequest(`/suppliers/${id}`, { method: 'DELETE' }),
  },
  sales: {
    create: (payload) => apiRequest('/sales', { method: 'POST', body: payload }),
    list: (query = '') => apiRequest(`/sales${query}`),
    get: (id) => apiRequest(`/sales/${id}`),
  },
  inventory: {
    overview: () => apiRequest('/inventory'),
    movements: () => apiRequest('/inventory/movements'),
    adjust: (payload) => apiRequest('/inventory/adjust', { method: 'POST', body: payload }),
  },
  dashboard: {
    stats: () => apiRequest('/dashboard'),
  },
  business: {
    get: () => apiRequest('/business'),
    update: (payload) => apiRequest('/business', { method: 'PUT', body: payload }),
  },
  payments: {
    getPlans: () => apiRequest('/payments/plans', { auth: false }),
    checkout: (payload) => apiRequest('/payments/checkout', { method: 'POST', body: payload, auth: false }),
    renew: (payload) => apiRequest('/payments/renew', { method: 'POST', body: payload }),
  },
};
