// =========================================
// SmartPOS - Dashboard Application Logic (dashboard.html)
// Every data operation goes through Api.* (see js/api.js), which talks to
// the Express backend, which talks to MongoDB. No local arrays of fake data.
// =========================================

const State = {
  cart: [],
  selectedCustomer: null,
  categories: [],
  products: [],
  customers: [],
  suppliers: [],
  employees: [],
  sales: [],
  business: null,
  user: null,
  currentCategoryFilter: 'all',
};

// =======================
// Bootstrap / Guard
// =======================
(function guardAndInit() {
  if (!Auth.isLoggedIn()) {
    window.location.href = 'index.html';
    return;
  }
  State.user = Auth.getUser();
  State.business = Auth.getBusiness();
  document.addEventListener('DOMContentLoaded', init);
})();

async function init() {
  initTheme();
  applyRoleVisibility();
  renderUserHeader();

  try {
    // Refresh the profile/business in case it changed since login
    const me = await Api.auth.me();
    State.user = me.user;
    State.business = me.business;
    Auth.setSession({ token: Auth.getToken(), user: me.user, business: me.business });
    renderUserHeader();
    applyRoleVisibility();

    if (isSubscriptionExpired(me.business)) {
      onSubscriptionExpired();
      return; // don't bother loading dashboard data the user can't reach yet
    }
  } catch (err) {
    showToast(err.message, 'error');
    if (err.message.includes('token')) {
      window.location.href = 'index.html';
      return;
    }
  }

  await Promise.all([loadCategories(), loadProducts()]);
  renderPOSCategories();
  await loadDashboard();
  dashboardRefreshTimer = setInterval(loadDashboard, 30000);

  // Close the notification dropdown when clicking anywhere else on the page
  document.addEventListener('click', (event) => {
    const wrapper = document.querySelector('.notification-wrapper');
    if (wrapper && !wrapper.contains(event.target)) {
      document.getElementById('notification-dropdown')?.classList.remove('active');
    }
  });
}

// =======================
// Role-based visibility
// =======================
function applyRoleVisibility() {
  const role = State.user ? State.user.role : null;
  document.querySelectorAll('.nav-item[data-roles]').forEach((item) => {
    const roles = item.dataset.roles.split(',');
    item.classList.toggle('hidden-role', !roles.includes(role));
  });
}

// =======================
// Header / Theme
// =======================
function renderUserHeader() {
  if (!State.user || !State.business) return;
  document.getElementById('user-initials').textContent = getInitials(State.user.name);
  document.getElementById('user-name').textContent = State.user.name;
  document.getElementById('user-role').textContent = formatRole(State.user.role);
  const label = document.getElementById('business-name-label');
  if (label) label.textContent = `Welcome back to ${State.business.name}!`;

  document.getElementById('settings-business-name').value = State.business.name || '';
  document.getElementById('settings-currency').value = State.business.currencySymbol || '';
  document.getElementById('settings-tax-rate').value = State.business.taxRate ?? '';
  document.getElementById('settings-plan').value = (State.business.subscriptionPlan || '').toUpperCase();
  renderSubscriptionStatus();

  // Only the Owner can edit business settings; everyone else sees them read-only.
  const isOwner = State.user.role === 'owner';
  ['settings-business-name', 'settings-currency', 'settings-tax-rate'].forEach((id) => {
    document.getElementById(id).disabled = !isOwner;
  });
  const saveBtn = document.getElementById('save-business-btn');
  const note = document.getElementById('business-settings-note');
  if (saveBtn) saveBtn.style.display = isOwner ? 'inline-flex' : 'none';
  if (note) note.textContent = isOwner
    ? 'Subscription plan changes are handled by billing/support - everything else here is yours to edit.'
    : 'Only the business Owner can edit these settings. Contact them if something needs to change.';
}

async function saveBusinessSettings() {
  const alertEl = document.getElementById('business-settings-alert');
  alertEl.style.display = 'none';

  const payload = {
    name: document.getElementById('settings-business-name').value.trim(),
    currencySymbol: document.getElementById('settings-currency').value.trim(),
    taxRate: parseFloat(document.getElementById('settings-tax-rate').value),
  };

  if (!payload.name) {
    alertEl.textContent = 'Business name is required';
    alertEl.style.display = 'block';
    return;
  }
  if (isNaN(payload.taxRate) || payload.taxRate < 0 || payload.taxRate > 100) {
    alertEl.textContent = 'Tax rate must be a number between 0 and 100';
    alertEl.style.display = 'block';
    return;
  }

  const btn = document.getElementById('save-business-btn');
  btn.disabled = true;
  const originalText = btn.textContent;
  btn.innerHTML = '<span class="spinner"></span> Saving...';

  try {
    const { data } = await Api.business.update(payload);
    State.business = data;
    Auth.setSession({ token: Auth.getToken(), user: State.user, business: data });
    renderUserHeader();
    showToast('Business settings updated', 'success');
  } catch (err) {
    alertEl.textContent = err.message;
    alertEl.style.display = 'block';
  } finally {
    btn.disabled = false;
    btn.textContent = originalText;
  }
}

function formatRole(role) {
  return { owner: 'Owner', manager: 'Manager', cashier: 'Cashier', inventory_staff: 'Inventory Staff' }[role] || role;
}

// =======================
// Subscription expiry + renewal
// =======================
const RENEWAL_PLAN_PRICES = { starter: 29, professional: 79, enterprise: 149 };
const RENEWAL_PLAN_LABELS = { starter: 'Starter', professional: 'Professional', enterprise: 'Enterprise' };

function isSubscriptionExpired(business) {
  if (!business) return false;
  if (business.subscriptionStatus === 'expired') return true;
  return !!(business.subscriptionExpiresAt && new Date(business.subscriptionExpiresAt).getTime() < Date.now());
}

// Called by js/api.js whenever any API request comes back with 402 (Payment
// Required), and also proactively right after login in init(). Blocks the
// dashboard behind a non-dismissable renewal modal until the Owner pays again.
function onSubscriptionExpired() {
  openRenewalModal({ forced: true });
}
window.onSubscriptionExpired = onSubscriptionExpired;

// Called from the Settings page "Renew Now" button - same payment flow, but
// the subscription isn't necessarily expired yet (renewing early just adds
// days on top of whatever time is left), and the person can cancel out of it.
function openRenewFromSettings() {
  openRenewalModal({ forced: false });
}

function openRenewalModal({ forced }) {
  const business = State.business || Auth.getBusiness();
  const plan = business?.subscriptionPlan || 'starter';
  document.getElementById('renewal-plan-name').textContent = RENEWAL_PLAN_LABELS[plan] || plan;
  document.getElementById('renewal-plan-price').innerHTML = `$${RENEWAL_PLAN_PRICES[plan] || '--'}<small>/month</small>`;
  document.getElementById('renewal-payer-name').value = (State.user && State.user.name) || '';

  document.getElementById('renewal-modal-title').textContent = forced ? 'Subscription Expired' : 'Renew Subscription';
  document.getElementById('renewal-modal-note').textContent = forced
    ? "Your business's subscription has expired. Renew below to restore access to SmartPOS - your data is safe and will be exactly as you left it."
    : 'Renewing now extends your subscription by 30 more days on top of any time you already have left.';
  document.getElementById('renewal-logout-btn').classList.toggle('hidden', !forced);
  document.getElementById('renewal-cancel-btn').classList.toggle('hidden', forced);

  const isOwner = State.user && State.user.role === 'owner';
  document.getElementById('renewal-alert').style.display = 'none';
  if (!isOwner) {
    document.getElementById('renewal-alert').textContent = 'Only the business Owner can renew the subscription. Please contact them, or log out.';
    document.getElementById('renewal-alert').className = 'alert alert-error';
    document.getElementById('renewal-alert').style.display = 'block';
    document.getElementById('renewal-pay-btn').style.display = 'none';
  } else {
    document.getElementById('renewal-pay-btn').style.display = 'inline-flex';
  }

  openModal('renewal-modal');
}

// Populates the Settings -> Subscription card with the current plan, expiry
// date, days remaining, and a color-coded status badge.
function renderSubscriptionStatus() {
  const business = State.business;
  if (!business) return;

  document.getElementById('subscription-plan-label').textContent = `${RENEWAL_PLAN_LABELS[business.subscriptionPlan] || business.subscriptionPlan} Plan`;

  const badge = document.getElementById('subscription-status-badge');
  const expiryLabel = document.getElementById('subscription-expiry-label');
  const renewBtn = document.getElementById('renew-now-btn');
  const isOwner = State.user && State.user.role === 'owner';
  renewBtn.style.display = isOwner ? 'inline-flex' : 'none';

  if (!business.subscriptionExpiresAt) {
    expiryLabel.textContent = 'No active billing period on file';
    badge.textContent = 'Unknown';
    badge.className = 'badge badge-gray';
    return;
  }

  const expiresAt = new Date(business.subscriptionExpiresAt);
  const daysLeft = Math.ceil((expiresAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000));
  expiryLabel.textContent = `Renews/expires on ${expiresAt.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}`;

  if (isSubscriptionExpired(business)) {
    badge.textContent = 'Expired';
    badge.className = 'badge badge-danger';
  } else if (daysLeft <= 7) {
    badge.textContent = `${daysLeft} day${daysLeft === 1 ? '' : 's'} left`;
    badge.className = 'badge badge-warning';
  } else {
    badge.textContent = 'Active';
    badge.className = 'badge badge-success';
  }
}

function selectRenewalMethod(btn) {
  document.querySelectorAll('#renewal-payment-methods .payment-method').forEach((b) => b.classList.remove('active'));
  btn.classList.add('active');
  const isCard = btn.dataset.method === 'card';
  document.getElementById('renewal-card-fields').classList.toggle('hidden', !isCard);
  document.getElementById('renewal-wallet-fields').classList.toggle('hidden', isCard);
}

async function handleRenewal() {
  const alertEl = document.getElementById('renewal-alert');
  alertEl.style.display = 'none';

  const business = State.business || Auth.getBusiness();
  const plan = business?.subscriptionPlan || 'starter';
  const method = document.querySelector('#renewal-payment-methods .payment-method.active')?.dataset.method || 'gcash';
  const payerName = document.getElementById('renewal-payer-name').value.trim();

  const payload = { plan, paymentMethod: method, payerName, purpose: 'renewal' };
  if (method === 'card') {
    payload.cardNumber = document.getElementById('renewal-card-number').value.trim();
    payload.cardExpiry = document.getElementById('renewal-card-expiry').value.trim();
    payload.cardCvv = document.getElementById('renewal-card-cvv').value.trim();
  } else {
    payload.mobileNumber = document.getElementById('renewal-mobile').value.trim();
  }

  const btn = document.getElementById('renewal-pay-btn');
  btn.disabled = true;
  const originalText = btn.textContent;
  btn.innerHTML = '<span class="spinner"></span> Processing...';

  try {
    const { data: payment } = await Api.payments.checkout(payload);
    const { data: renewedBusiness } = await Api.payments.renew({ reference: payment.reference });
    State.business = renewedBusiness;
    Auth.setSession({ token: Auth.getToken(), user: State.user, business: renewedBusiness });
    closeModal('renewal-modal');
    showToast('Subscription renewed successfully!', 'success');
    renderUserHeader();
    // Reload the data pages that were blocked while expired
    await Promise.all([loadCategories(), loadProducts()]);
    renderPOSCategories();
    await loadDashboard();
  } catch (err) {
    alertEl.textContent = err.message;
    alertEl.className = 'alert alert-error';
    alertEl.style.display = 'block';
  } finally {
    btn.disabled = false;
    btn.textContent = originalText;
  }
}

function getInitials(name) {
  return (name || '').split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
}

function formatCurrency(amount) {
  const symbol = (State.business && State.business.currencySymbol) || '$';
  return `${symbol}${Number(amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function initTheme() {
  const theme = localStorage.getItem('smartpos-theme') || 'light';
  document.documentElement.classList.toggle('dark', theme === 'dark');
  updateThemeIcon(theme);
}

function toggleTheme() {
  const isDark = document.documentElement.classList.toggle('dark');
  localStorage.setItem('smartpos-theme', isDark ? 'dark' : 'light');
  updateThemeIcon(isDark ? 'dark' : 'light');
}

function updateThemeIcon(theme) {
  const icon = document.getElementById('theme-icon');
  if (!icon) return;
  icon.innerHTML = theme === 'dark'
    ? '<circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>'
    : '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>';
}

function showToast(message, type = 'info') {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.className = `toast active ${type}`;
  setTimeout(() => (toast.className = 'toast'), 3000);
}

function closeModal(id) {
  document.getElementById(id).classList.remove('active');
}
function openModal(id) {
  document.getElementById(id).classList.add('active');
}

function handleLogout(event) {
  if (event) event.preventDefault();
  if (confirm('Are you sure you want to logout?')) {
    Auth.clearSession();
    window.location.href = 'index.html';
  }
}

function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('collapsed');
}

// =======================
// Navigation
// =======================
async function navigateTo(page, event) {
  if (event) event.preventDefault();

  document.querySelectorAll('.nav-item').forEach((item) => item.classList.remove('active'));
  const activeNav = document.querySelector(`.nav-item[data-page="${page}"]`);
  if (activeNav) activeNav.classList.add('active');

  document.querySelectorAll('.page-content').forEach((c) => c.classList.remove('active'));
  const content = document.getElementById(`${page}-content`);
  if (content) content.classList.add('active');

  // Auto-refresh the dashboard every 30s while it's the visible page, so
  // stats/top-products/low-stock update on their own (e.g. a manager
  // watching the dashboard while a cashier rings up sales elsewhere).
  // Stops automatically the moment you navigate to any other page.
  stopDashboardAutoRefresh();
  if (page === 'dashboard') {
    dashboardRefreshTimer = setInterval(loadDashboard, 30000);
  }

  try {
    if (page === 'dashboard') await loadDashboard();
    if (page === 'pos') { await loadProducts(); renderPOSProducts(); }
    if (page === 'sales') await loadSales();
    if (page === 'products') { await loadProducts(); renderProductsTable(); }
    if (page === 'inventory') await loadInventory();
    if (page === 'customers') { await loadCustomers(); renderCustomersGrid(); }
    if (page === 'suppliers') { await loadSuppliers(); renderSuppliersGrid(); }
    if (page === 'employees') await loadEmployees();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

let dashboardRefreshTimer = null;
function stopDashboardAutoRefresh() {
  if (dashboardRefreshTimer) {
    clearInterval(dashboardRefreshTimer);
    dashboardRefreshTimer = null;
  }
}

// =======================
// Global header search
// =======================
// Jumps to the most relevant page and filters it, based on what's currently
// on screen and what the person typed. Enter triggers the jump/filter.
function handleGlobalSearch(event) {
  const value = event.target.value;
  const activePage = document.querySelector('.page-content.active')?.id || '';

  if (activePage === 'products-content') {
    document.getElementById('product-search').value = value;
    renderProductsTable();
    return;
  }
  if (activePage === 'customers-content') {
    document.getElementById('customer-search').value = value;
    renderCustomersGrid();
    return;
  }
  if (activePage === 'pos-content') {
    document.getElementById('pos-search').value = value;
    renderPOSProducts();
    return;
  }

  if (event.key === 'Enter' && value.trim()) {
    navigateTo('products').then(() => {
      document.getElementById('product-search').value = value;
      renderProductsTable();
    });
  }
}

// =======================
// Dashboard
// =======================
async function loadDashboard() {
  try {
    const { data } = await Api.dashboard.stats();
    document.getElementById('stat-revenue').textContent = formatCurrency(data.todayRevenue);
    document.getElementById('stat-orders').textContent = data.todayOrders;
    document.getElementById('stat-profit').textContent = formatCurrency(data.todayProfit);
    document.getElementById('stat-products').textContent = data.totalProducts;

    document.getElementById('low-stock-count').textContent = `${data.lowStockCount + data.outOfStockCount} items`;
    const lowStockList = document.getElementById('low-stock-list');
    lowStockList.innerHTML = data.lowStockProducts.length
      ? data.lowStockProducts.map((p) => `
          <div class="low-stock-item">
            <div class="item-icon ${p.stock === 0 ? 'bg-danger' : 'bg-warning'}" style="color:white;">!</div>
            <div class="item-info">
              <span class="item-name">${escapeHtml(p.name)}</span>
              <span class="item-stock ${p.stock === 0 ? 'danger' : 'warning'}">${p.stock === 0 ? 'Out of stock' : p.stock + ' remaining'}</span>
            </div>
          </div>
        `).join('')
      : '<p style="color:var(--text-muted);font-size:.85rem;">All products are well stocked.</p>';

    const topTbody = document.getElementById('top-products-tbody');
    topTbody.innerHTML = data.topProducts.length
      ? data.topProducts.map((p) => `<tr><td>${escapeHtml(p.name)}</td><td>${p.totalQty}</td><td>${formatCurrency(p.totalRevenue)}</td></tr>`).join('')
      : '<tr><td colspan="3" style="color:var(--text-muted);">No sales yet</td></tr>';

    updateNotifications(data.lowStockProducts);
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// =======================
// Notifications (real low-stock alerts, not a placeholder)
// =======================
function updateNotifications(lowStockProducts) {
  const badge = document.getElementById('notification-badge');
  const list = document.getElementById('notification-list');
  if (!badge || !list) return;

  if (lowStockProducts.length === 0) {
    badge.style.display = 'none';
    list.innerHTML = '<p class="loading-text">No low stock alerts right now.</p>';
    return;
  }

  badge.style.display = 'flex';
  badge.textContent = lowStockProducts.length;
  list.innerHTML = lowStockProducts.map((p) => `
    <div class="notification-item" onclick="navigateTo('inventory')">
      <span class="notification-item-name">${escapeHtml(p.name)}</span>
      <span class="notification-item-stock ${p.stock === 0 ? 'danger' : 'warning'}">${p.stock === 0 ? 'Out of stock' : p.stock + ' left'}</span>
    </div>
  `).join('');
}

function toggleNotifications() {
  document.getElementById('notification-dropdown')?.classList.toggle('active');
}

// =======================
// Categories & Products
// =======================
async function loadCategories() {
  const { data } = await Api.categories.list();
  State.categories = data;
  const productCategorySelect = document.getElementById('product-category');
  if (productCategorySelect) {
    productCategorySelect.innerHTML = State.categories.map((c) => `<option value="${c._id}">${escapeHtml(c.name)}</option>`).join('');
  }
}

async function loadProducts() {
  const { data } = await Api.products.list();
  State.products = data;
}

function renderPOSCategories() {
  const container = document.getElementById('pos-categories');
  if (!container) return;
  let html = `<button class="category-btn ${State.currentCategoryFilter === 'all' ? 'active' : ''}" onclick="filterByCategory('all')">All</button>`;
  State.categories.forEach((cat) => {
    html += `<button class="category-btn ${State.currentCategoryFilter === cat._id ? 'active' : ''}" onclick="filterByCategory('${cat._id}')">${escapeHtml(cat.name)}</button>`;
  });
  container.innerHTML = html;
}

function filterByCategory(categoryId) {
  State.currentCategoryFilter = categoryId;
  renderPOSCategories();
  renderPOSProducts();
}

function renderPOSProducts() {
  const grid = document.getElementById('pos-products-grid');
  if (!grid) return;
  const search = (document.getElementById('pos-search')?.value || '').toLowerCase();

  let list = State.products;
  if (State.currentCategoryFilter !== 'all') {
    list = list.filter((p) => (p.category && (p.category._id || p.category)) === State.currentCategoryFilter);
  }
  if (search) list = list.filter((p) => p.name.toLowerCase().includes(search) || p.sku.toLowerCase().includes(search));

  grid.innerHTML = list.map((product) => `
    <div class="pos-product-card ${product.stock === 0 ? 'disabled' : ''}" onclick="addToCart('${product._id}')">
      <img src="${product.image || 'https://placehold.co/150'}" alt="${escapeHtml(product.name)}" class="pos-product-image">
      <div class="pos-product-name">${escapeHtml(product.name)}</div>
      <div class="pos-product-price">${formatCurrency(product.sellingPrice)}</div>
      <div class="pos-product-stock ${product.stock <= product.minStock ? (product.stock === 0 ? 'out' : 'low') : ''}">${product.stock === 0 ? 'Out of stock' : product.stock + ' left'}</div>
    </div>
  `).join('') || '<p style="color:var(--text-muted);">No products found.</p>';
}

function addToCart(productId) {
  const product = State.products.find((p) => p._id === productId);
  if (!product || product.stock === 0) return;

  const existing = State.cart.find((item) => item._id === productId);
  if (existing) {
    if (existing.quantity >= product.stock) {
      showToast('No more stock available', 'error');
      return;
    }
    existing.quantity++;
  } else {
    State.cart.push({ ...product, quantity: 1 });
  }
  updateCartUI();
}

function removeFromCart(productId) {
  State.cart = State.cart.filter((item) => item._id !== productId);
  updateCartUI();
}

function updateCartQuantity(productId, change) {
  const item = State.cart.find((i) => i._id === productId);
  if (!item) return;
  item.quantity += change;
  if (item.quantity <= 0) removeFromCart(productId);
  else updateCartUI();
}

function clearCart() {
  State.cart = [];
  State.selectedCustomer = null;
  const el = document.getElementById('selected-customer');
  if (el) el.textContent = 'Walk-in Customer';
  updateCartUI();
}

function cartTotals() {
  const subtotal = State.cart.reduce((sum, item) => sum + item.sellingPrice * item.quantity, 0);
  const taxRate = (State.business && State.business.taxRate) || 0;
  const tax = +(subtotal * (taxRate / 100)).toFixed(2);
  const total = +(subtotal + tax).toFixed(2);
  return { subtotal, tax, total, taxRate };
}

function updateCartUI() {
  const cartContainer = document.getElementById('cart-items');
  const { subtotal, tax, total, taxRate } = cartTotals();

  if (State.cart.length === 0) {
    cartContainer.innerHTML = `<div class="cart-empty"><p>Cart is empty</p><span>Add products to get started</span></div>`;
    document.getElementById('checkout-btn').disabled = true;
  } else {
    cartContainer.innerHTML = State.cart.map((item) => `
      <div class="cart-item">
        <img src="${item.image || 'https://placehold.co/48'}" alt="" class="cart-item-image">
        <div class="cart-item-info">
          <div class="cart-item-name">${escapeHtml(item.name)}</div>
          <div class="cart-item-price">${formatCurrency(item.sellingPrice)} each</div>
          <div class="cart-item-qty">
            <button class="qty-btn" onclick="updateCartQuantity('${item._id}', -1)">-</button>
            <span class="qty-value">${item.quantity}</span>
            <button class="qty-btn" onclick="updateCartQuantity('${item._id}', 1)">+</button>
          </div>
        </div>
        <div class="cart-item-total">${formatCurrency(item.sellingPrice * item.quantity)}</div>
        <button class="cart-item-remove" onclick="removeFromCart('${item._id}')">&times;</button>
      </div>
    `).join('');
    document.getElementById('checkout-btn').disabled = false;
  }

  document.getElementById('cart-subtotal').textContent = formatCurrency(subtotal);
  document.getElementById('cart-tax-label').textContent = `Tax (${taxRate}%)`;
  document.getElementById('cart-tax').textContent = formatCurrency(tax);
  document.getElementById('cart-total').textContent = formatCurrency(total);
}

// =======================
// Checkout
// =======================
function openCheckout() {
  if (State.cart.length === 0) return;
  const { total } = cartTotals();
  document.getElementById('payment-total').textContent = formatCurrency(total);
  document.getElementById('amount-received').value = '';
  document.getElementById('change-amount').textContent = formatCurrency(0);
  document.getElementById('checkout-alert').style.display = 'none';
  openModal('checkout-modal');
}

function selectPaymentMethod(btn) {
  document.querySelectorAll('.payment-method').forEach((b) => b.classList.remove('active'));
  btn.classList.add('active');
}

function addQuickAmount(amount) {
  const input = document.getElementById('amount-received');
  const current = parseFloat(input.value) || 0;
  input.value = (current + amount).toFixed(2);
  calculateChange();
}

function setExactAmount() {
  const { total } = cartTotals();
  document.getElementById('amount-received').value = total.toFixed(2);
  calculateChange();
}

function calculateChange() {
  const { total } = cartTotals();
  const paid = parseFloat(document.getElementById('amount-received').value) || 0;
  const change = Math.max(0, paid - total);
  document.getElementById('change-amount').textContent = formatCurrency(change);
}

async function processPayment() {
  const { total, subtotal, tax } = cartTotals();
  const amountPaid = parseFloat(document.getElementById('amount-received').value) || 0;
  const paymentMethod = document.querySelector('.payment-method.active')?.dataset.method || 'cash';
  const alertEl = document.getElementById('checkout-alert');
  alertEl.style.display = 'none';

  if (amountPaid < total) {
    alertEl.textContent = 'Amount received is less than the total due';
    alertEl.style.display = 'block';
    return;
  }

  const btn = document.getElementById('process-payment-btn');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Processing...';

  try {
    const payload = {
      items: State.cart.map((item) => ({ productId: item._id, quantity: item.quantity })),
      customerId: State.selectedCustomer ? State.selectedCustomer._id : undefined,
      paymentMethod,
      amountPaid,
    };
    const { data: sale } = await Api.sales.create(payload);

    document.getElementById('receipt-number').textContent = sale.saleNumber;
    document.getElementById('receipt-method').textContent = paymentMethod.toUpperCase();
    document.getElementById('receipt-subtotal').textContent = formatCurrency(sale.subtotal);
    document.getElementById('receipt-tax').textContent = formatCurrency(sale.tax);
    document.getElementById('receipt-total').textContent = formatCurrency(sale.total);
    document.getElementById('receipt-paid').textContent = formatCurrency(sale.amountPaid);
    document.getElementById('receipt-change').textContent = formatCurrency(sale.change);

    closeModal('checkout-modal');
    openModal('receipt-modal');
    await loadProducts(); // refresh stock levels
  } catch (err) {
    alertEl.textContent = err.message;
    alertEl.style.display = 'block';
  } finally {
    btn.disabled = false;
    btn.textContent = 'Complete Payment';
  }
}

function newTransaction() {
  closeModal('receipt-modal');
  clearCart();
  renderPOSProducts();
}

// =======================
// Sales History
// =======================
async function loadSales() {
  try {
    const { data } = await Api.sales.list();
    State.sales = data;
    renderSalesTable();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function renderSalesTable() {
  const tbody = document.getElementById('sales-tbody');
  if (!tbody) return;
  const search = (document.getElementById('sales-search')?.value || '').toLowerCase();
  let list = State.sales;
  if (search) list = list.filter((s) => s.saleNumber.toLowerCase().includes(search));

  tbody.innerHTML = list.length
    ? list.map((s) => `
        <tr>
          <td style="font-family:monospace;">${escapeHtml(s.saleNumber)}</td>
          <td>${new Date(s.createdAt).toLocaleString()}</td>
          <td>${s.customer ? escapeHtml(s.customer.name) : 'Walk-in'}</td>
          <td>${s.cashier ? escapeHtml(s.cashier.name) : '-'}</td>
          <td style="text-transform:uppercase;">${escapeHtml(s.paymentMethod)}</td>
          <td>${formatCurrency(s.total)}</td>
          <td><span class="badge badge-${s.status === 'completed' ? 'success' : 'gray'}" style="text-transform:capitalize;">${s.status}</span></td>
        </tr>
      `).join('')
    : '<tr><td colspan="7" style="color:var(--text-muted);">No sales found.</td></tr>';
}

// =======================
// Customer select (POS)
// =======================
async function openCustomerModal() {
  await loadCustomers();
  const list = document.getElementById('customer-select-list');
  let html = `
    <div class="customer-list-item" onclick="selectCustomer(null)">
      <div class="customer-avatar" style="background:var(--gray-200);">--</div>
      <div><div style="font-weight:500;">Walk-in Customer</div><div style="font-size:.75rem;color:var(--text-muted);">No account</div></div>
    </div>`;
  html += State.customers.map((c) => `
    <div class="customer-list-item" onclick='selectCustomer(${JSON.stringify(c._id)})'>
      <div class="customer-avatar">${getInitials(c.name)}</div>
      <div><div style="font-weight:500;">${escapeHtml(c.name)}</div><div style="font-size:.75rem;color:var(--text-muted);">${escapeHtml(c.phone || '')}</div></div>
      <span class="badge badge-${c.membership === 'platinum' ? 'primary' : c.membership === 'gold' ? 'warning' : 'gray'}" style="margin-left:auto;text-transform:capitalize;">${c.membership}</span>
    </div>`).join('');
  list.innerHTML = html;
  openModal('customer-select-modal');
}

function selectCustomer(customerId) {
  if (customerId) {
    State.selectedCustomer = State.customers.find((c) => c._id === customerId);
    document.getElementById('selected-customer').textContent = State.selectedCustomer.name;
  } else {
    State.selectedCustomer = null;
    document.getElementById('selected-customer').textContent = 'Walk-in Customer';
  }
  closeModal('customer-select-modal');
}

// =======================
// Products page (CRUD)
// =======================
function renderProductsTable() {
  const tbody = document.getElementById('products-tbody');
  const search = (document.getElementById('product-search')?.value || '').toLowerCase();
  let list = State.products;
  if (search) list = list.filter((p) => p.name.toLowerCase().includes(search) || p.sku.toLowerCase().includes(search));

  const canEdit = ['owner', 'manager', 'inventory_staff'].includes(State.user.role);

  tbody.innerHTML = list.map((p) => {
    const stockClass = p.stock === 0 ? 'danger' : p.stock <= p.minStock ? 'warning' : 'success';
    const stockText = p.stock === 0 ? 'Out' : p.stock <= p.minStock ? 'Low' : 'In Stock';
    return `
      <tr>
        <td>${escapeHtml(p.name)}</td>
        <td style="font-family:monospace;font-size:.75rem;color:var(--text-muted);">${escapeHtml(p.sku)}</td>
        <td><span class="badge badge-gray">${p.category ? escapeHtml(p.category.name) : 'Uncategorized'}</span></td>
        <td>${formatCurrency(p.sellingPrice)}</td>
        <td><span class="text-${stockClass}">${p.stock} ${escapeHtml(p.unit)}</span></td>
        <td><span class="badge badge-${stockClass}">${stockText}</span></td>
        <td>${canEdit ? `<button class="btn btn-ghost btn-sm" onclick='openProductModal(${JSON.stringify(p._id)})'>Edit</button>
          <button class="btn btn-ghost btn-sm text-danger" onclick="deleteProduct('${p._id}')">Delete</button>` : ''}</td>
      </tr>`;
  }).join('');
}

function openProductModal(productId) {
  document.getElementById('product-alert').style.display = 'none';
  const product = productId ? State.products.find((p) => p._id === productId) : null;
  document.getElementById('product-modal-title').textContent = product ? 'Edit Product' : 'Add Product';
  document.getElementById('product-id').value = product ? product._id : '';
  document.getElementById('product-name').value = product ? product.name : '';
  document.getElementById('product-sku').value = product ? product.sku : '';
  document.getElementById('product-barcode').value = product ? (product.barcode || '') : '';
  document.getElementById('product-category').value = product && product.category ? (product.category._id || product.category) : (State.categories[0]?._id || '');
  document.getElementById('product-cost').value = product ? product.costPrice : '';
  document.getElementById('product-price').value = product ? product.sellingPrice : '';
  document.getElementById('product-stock').value = product ? product.stock : '';
  document.getElementById('product-min-stock').value = product ? product.minStock : '';
  document.getElementById('product-unit').value = product ? product.unit : 'piece';
  openModal('product-modal');
}

async function saveProduct() {
  const id = document.getElementById('product-id').value;
  const payload = {
    name: document.getElementById('product-name').value.trim(),
    sku: document.getElementById('product-sku').value.trim(),
    barcode: document.getElementById('product-barcode').value.trim(),
    category: document.getElementById('product-category').value,
    costPrice: parseFloat(document.getElementById('product-cost').value) || 0,
    sellingPrice: parseFloat(document.getElementById('product-price').value) || 0,
    stock: parseInt(document.getElementById('product-stock').value, 10) || 0,
    minStock: parseInt(document.getElementById('product-min-stock').value, 10) || 0,
    unit: document.getElementById('product-unit').value.trim() || 'piece',
  };

  try {
    if (id) await Api.products.update(id, payload);
    else await Api.products.create(payload);
    closeModal('product-modal');
    await loadProducts();
    renderProductsTable();
    showToast('Product saved successfully', 'success');
  } catch (err) {
    const alertEl = document.getElementById('product-alert');
    alertEl.textContent = err.message;
    alertEl.style.display = 'block';
  }
}

async function deleteProduct(id) {
  if (!confirm('Delete this product?')) return;
  try {
    await Api.products.remove(id);
    await loadProducts();
    renderProductsTable();
    showToast('Product deleted', 'success');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// =======================
// Category management (Products page)
// =======================
function openCategoryManageModal() {
  document.getElementById('category-manage-alert').style.display = 'none';
  document.getElementById('new-category-name').value = '';
  document.getElementById('new-category-color').value = '#3b82f6';
  renderCategoryManageList();
  openModal('category-manage-modal');
}

function renderCategoryManageList() {
  const list = document.getElementById('category-manage-list');
  list.innerHTML = State.categories.length
    ? State.categories.map((c) => {
        const productCount = State.products.filter((p) => (p.category && (p.category._id || p.category)) === c._id).length;
        return `
          <div class="category-manage-item">
            <span class="category-color-dot" style="background:${c.color || '#6b7280'};"></span>
            <span class="category-manage-name">${escapeHtml(c.name)}</span>
            <span class="category-manage-count">${productCount} product${productCount === 1 ? '' : 's'}</span>
            <button class="btn btn-ghost btn-sm text-danger" onclick="deleteCategoryRecord('${c._id}')">Delete</button>
          </div>
        `;
      }).join('')
    : '<p style="color:var(--text-muted);font-size:.85rem;">No categories yet. Add one above.</p>';
}

async function saveCategory() {
  const name = document.getElementById('new-category-name').value.trim();
  const color = document.getElementById('new-category-color').value;
  const alertEl = document.getElementById('category-manage-alert');
  alertEl.style.display = 'none';

  if (!name) {
    alertEl.textContent = 'Category name is required';
    alertEl.style.display = 'block';
    return;
  }

  try {
    await Api.categories.create({ name, color });
    document.getElementById('new-category-name').value = '';
    await loadCategories();
    renderCategoryManageList();
    showToast('Category added', 'success');
  } catch (err) {
    alertEl.textContent = err.message;
    alertEl.style.display = 'block';
  }
}

async function deleteCategoryRecord(id) {
  const productCount = State.products.filter((p) => (p.category && (p.category._id || p.category)) === id).length;
  const message = productCount > 0
    ? `${productCount} product(s) use this category. Delete it anyway? They'll become uncategorized.`
    : 'Delete this category?';
  if (!confirm(message)) return;

  try {
    await Api.categories.remove(id);
    await loadCategories();
    await loadProducts();
    renderCategoryManageList();
    if (document.getElementById('products-content').classList.contains('active')) renderProductsTable();
    showToast('Category deleted', 'success');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// =======================
// Inventory page
// =======================
async function loadInventory() {
  const { summary, data } = await Api.inventory.overview();
  document.getElementById('inv-total-items').textContent = summary.totalItems;
  document.getElementById('inv-total-value').textContent = formatCurrency(summary.totalValue);
  document.getElementById('inv-low-stock').textContent = summary.lowStock;
  document.getElementById('inv-out-stock').textContent = summary.outOfStock;

  const tbody = document.getElementById('inventory-tbody');
  tbody.innerHTML = data.map((p) => {
    const statusClass = p.stock === 0 ? 'danger' : p.stock <= p.minStock ? 'warning' : 'success';
    const statusText = p.stock === 0 ? 'Out of Stock' : p.stock <= p.minStock ? 'Low Stock' : 'In Stock';
    return `<tr>
      <td>${escapeHtml(p.name)}</td>
      <td style="font-family:monospace;font-size:.75rem;color:var(--text-muted);">${escapeHtml(p.sku)}</td>
      <td>${p.stock}</td>
      <td>${p.minStock}</td>
      <td>${formatCurrency(p.costPrice * p.stock)}</td>
      <td><span class="badge badge-${statusClass}">${statusText}</span></td>
    </tr>`;
  }).join('');

  // populate the adjust-stock dropdown too
  const select = document.getElementById('adjust-product');
  if (select) select.innerHTML = data.map((p) => `<option value="${p._id}">${escapeHtml(p.name)} (${p.stock} in stock)</option>`).join('');

  await loadMovements();
}

async function loadMovements() {
  const { data } = await Api.inventory.movements();
  const tbody = document.getElementById('movements-tbody');
  const typeColors = { in: 'success', out: 'danger', adjustment: 'warning', transfer: 'primary' };
  const typeText = { in: 'Stock In', out: 'Stock Out', adjustment: 'Adjustment', transfer: 'Transfer' };
  tbody.innerHTML = data.map((m) => `
    <tr>
      <td>${new Date(m.createdAt).toLocaleString()}</td>
      <td>${m.product ? escapeHtml(m.product.name) : 'Unknown'}</td>
      <td><span class="badge badge-${typeColors[m.type]}">${typeText[m.type]}</span></td>
      <td>${m.quantity}</td>
      <td>${escapeHtml(m.reference || '-')}</td>
      <td>${m.createdBy ? escapeHtml(m.createdBy.name) : '-'}</td>
    </tr>`).join('') || '<tr><td colspan="6" style="color:var(--text-muted);">No movements yet</td></tr>';
}

function switchInventoryTab(tab) {
  document.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach((c) => c.classList.remove('active'));
  document.querySelector(`.tab-btn[data-tab="${tab}"]`).classList.add('active');
  document.getElementById(`inventory-${tab}`).classList.add('active');
}

function openAdjustModal() {
  document.getElementById('adjust-alert').style.display = 'none';
  document.getElementById('adjust-quantity').value = '';
  document.getElementById('adjust-reference').value = '';
  document.getElementById('adjust-notes').value = '';
  openModal('adjust-modal');
}

async function saveStockAdjustment() {
  const payload = {
    productId: document.getElementById('adjust-product').value,
    type: document.getElementById('adjust-type').value,
    quantity: parseInt(document.getElementById('adjust-quantity').value, 10),
    reference: document.getElementById('adjust-reference').value.trim(),
    notes: document.getElementById('adjust-notes').value.trim(),
  };
  if (!payload.quantity || payload.quantity <= 0) {
    const alertEl = document.getElementById('adjust-alert');
    alertEl.textContent = 'Enter a valid quantity';
    alertEl.style.display = 'block';
    return;
  }
  try {
    await Api.inventory.adjust(payload);
    closeModal('adjust-modal');
    await loadInventory();
    await loadProducts();
    showToast('Stock updated', 'success');
  } catch (err) {
    const alertEl = document.getElementById('adjust-alert');
    alertEl.textContent = err.message;
    alertEl.style.display = 'block';
  }
}

// =======================
// Customers page
// =======================
async function loadCustomers() {
  const { data } = await Api.customers.list();
  State.customers = data;
}

function renderCustomersGrid() {
  const grid = document.getElementById('customers-grid');
  const search = (document.getElementById('customer-search')?.value || '').toLowerCase();
  let list = State.customers;
  if (search) list = list.filter((c) => c.name.toLowerCase().includes(search) || (c.phone || '').includes(search));

  const canManage = ['owner', 'manager'].includes(State.user.role);

  grid.innerHTML = list.map((c) => `
    <div class="customer-card">
      <div class="customer-header">
        <div style="display:flex;align-items:center;gap:.75rem;">
          <div class="customer-avatar-lg">${getInitials(c.name)}</div>
          <div><div style="font-weight:600;">${escapeHtml(c.name)}</div><div style="font-size:.75rem;color:var(--text-muted);">${escapeHtml(c.phone || '')}</div></div>
        </div>
        <span class="badge badge-${c.membership === 'platinum' ? 'primary' : c.membership === 'gold' ? 'warning' : 'gray'}" style="text-transform:capitalize;">${c.membership}</span>
      </div>
      <div class="customer-stats">
        <div class="customer-stat"><div class="value">${c.points}</div><div class="label">Points</div></div>
        <div class="customer-stat"><div class="value text-success">${formatCurrency(c.totalSpent)}</div><div class="label">Total Spent</div></div>
      </div>
      ${canManage ? `
        <div class="card-actions">
          <button class="btn btn-ghost btn-sm" onclick='event.stopPropagation(); openCustomerAddModal(${JSON.stringify(c._id)})'>Edit</button>
          <button class="btn btn-ghost btn-sm text-danger" onclick="event.stopPropagation(); deleteCustomerRecord('${c._id}')">Delete</button>
        </div>
      ` : ''}
    </div>
  `).join('') || '<p style="color:var(--text-muted);">No customers found.</p>';
}

function openCustomerAddModal(customerId) {
  const customer = customerId ? State.customers.find((c) => c._id === customerId) : null;
  document.getElementById('customer-alert').style.display = 'none';
  document.getElementById('customer-modal-title').textContent = customer ? 'Edit Customer' : 'Add Customer';
  document.getElementById('customer-id').value = customer ? customer._id : '';
  document.getElementById('customer-name').value = customer ? customer.name : '';
  document.getElementById('customer-phone').value = customer ? (customer.phone || '') : '';
  document.getElementById('customer-email').value = customer ? (customer.email || '') : '';
  document.getElementById('customer-membership').value = customer ? customer.membership : 'silver';
  openModal('customer-add-modal');
}

async function saveCustomer() {
  const id = document.getElementById('customer-id').value;
  const payload = {
    name: document.getElementById('customer-name').value.trim(),
    phone: document.getElementById('customer-phone').value.trim(),
    email: document.getElementById('customer-email').value.trim(),
    membership: document.getElementById('customer-membership').value,
  };
  if (!payload.name) {
    const alertEl = document.getElementById('customer-alert');
    alertEl.textContent = 'Customer name is required';
    alertEl.style.display = 'block';
    return;
  }
  try {
    if (id) await Api.customers.update(id, payload);
    else await Api.customers.create(payload);
    closeModal('customer-add-modal');
    await loadCustomers();
    renderCustomersGrid();
    showToast(id ? 'Customer updated' : 'Customer added', 'success');
  } catch (err) {
    const alertEl = document.getElementById('customer-alert');
    alertEl.textContent = err.message;
    alertEl.style.display = 'block';
  }
}

async function deleteCustomerRecord(id) {
  if (!confirm('Delete this customer? This cannot be undone.')) return;
  try {
    await Api.customers.remove(id);
    await loadCustomers();
    renderCustomersGrid();
    showToast('Customer deleted', 'success');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// =======================
// Suppliers page
// =======================
async function loadSuppliers() {
  const { data } = await Api.suppliers.list();
  State.suppliers = data;
}

function renderSuppliersGrid() {
  const grid = document.getElementById('suppliers-grid');
  grid.innerHTML = State.suppliers.map((s) => `
    <div class="supplier-card">
      <div class="supplier-header">
        <div style="display:flex;align-items:center;gap:.75rem;">
          <div class="supplier-icon">${getInitials(s.name)}</div>
          <div><div style="font-weight:600;">${escapeHtml(s.name)}</div><div style="font-size:.75rem;color:var(--text-muted);">${escapeHtml(s.company || '')}</div></div>
        </div>
        <span class="badge badge-${s.isActive ? 'success' : 'gray'}">${s.isActive ? 'Active' : 'Inactive'}</span>
      </div>
      <div class="supplier-contact">
        <div class="supplier-contact-item">${escapeHtml(s.phone || '')}</div>
        <div class="supplier-contact-item">${escapeHtml(s.email || '')}</div>
        <div class="supplier-contact-item">${escapeHtml(s.address || '')}</div>
      </div>
      <div class="card-actions">
        <button class="btn btn-ghost btn-sm" onclick='openSupplierModal(${JSON.stringify(s._id)})'>Edit</button>
        <button class="btn btn-ghost btn-sm" onclick="toggleSupplierActive('${s._id}', ${!s.isActive})">${s.isActive ? 'Deactivate' : 'Activate'}</button>
        <button class="btn btn-ghost btn-sm text-danger" onclick="deleteSupplierRecord('${s._id}')">Delete</button>
      </div>
    </div>
  `).join('') || '<p style="color:var(--text-muted);">No suppliers found.</p>';
}

function openSupplierModal(supplierId) {
  const supplier = supplierId ? State.suppliers.find((s) => s._id === supplierId) : null;
  document.getElementById('supplier-alert').style.display = 'none';
  document.getElementById('supplier-modal-title').textContent = supplier ? 'Edit Supplier' : 'Add Supplier';
  document.getElementById('supplier-id').value = supplier ? supplier._id : '';
  document.getElementById('supplier-name').value = supplier ? supplier.name : '';
  document.getElementById('supplier-company').value = supplier ? (supplier.company || '') : '';
  document.getElementById('supplier-contact-person').value = supplier ? (supplier.contactPerson || '') : '';
  document.getElementById('supplier-email').value = supplier ? (supplier.email || '') : '';
  document.getElementById('supplier-phone').value = supplier ? (supplier.phone || '') : '';
  document.getElementById('supplier-address').value = supplier ? (supplier.address || '') : '';
  document.getElementById('supplier-active').checked = supplier ? supplier.isActive : true;
  openModal('supplier-modal');
}

async function saveSupplier() {
  const id = document.getElementById('supplier-id').value;
  const payload = {
    name: document.getElementById('supplier-name').value.trim(),
    company: document.getElementById('supplier-company').value.trim(),
    contactPerson: document.getElementById('supplier-contact-person').value.trim(),
    email: document.getElementById('supplier-email').value.trim(),
    phone: document.getElementById('supplier-phone').value.trim(),
    address: document.getElementById('supplier-address').value.trim(),
    isActive: document.getElementById('supplier-active').checked,
  };
  if (!payload.name) {
    const alertEl = document.getElementById('supplier-alert');
    alertEl.textContent = 'Supplier name is required';
    alertEl.style.display = 'block';
    return;
  }
  try {
    if (id) await Api.suppliers.update(id, payload);
    else await Api.suppliers.create(payload);
    closeModal('supplier-modal');
    await loadSuppliers();
    renderSuppliersGrid();
    showToast(id ? 'Supplier updated' : 'Supplier added', 'success');
  } catch (err) {
    const alertEl = document.getElementById('supplier-alert');
    alertEl.textContent = err.message;
    alertEl.style.display = 'block';
  }
}

async function toggleSupplierActive(id, nextActive) {
  try {
    await Api.suppliers.update(id, { isActive: nextActive });
    await loadSuppliers();
    renderSuppliersGrid();
    showToast(nextActive ? 'Supplier activated' : 'Supplier deactivated', 'success');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function deleteSupplierRecord(id) {
  if (!confirm('Delete this supplier? This cannot be undone.')) return;
  try {
    await Api.suppliers.remove(id);
    await loadSuppliers();
    renderSuppliersGrid();
    showToast('Supplier deleted', 'success');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// =======================
// Employees page (Owner/Manager account management)
// =======================
async function loadEmployees() {
  const { data } = await Api.users.list();
  State.employees = data;
  renderEmployeesTable();
}

function renderEmployeesTable() {
  document.getElementById('emp-total').textContent = State.employees.length;
  document.getElementById('emp-active').textContent = State.employees.filter((e) => e.isActive).length;
  document.getElementById('emp-limit').textContent = (State.business && State.business.maxUsers) || '--';

  const tbody = document.getElementById('employees-tbody');
  const canManage = ['owner', 'manager'].includes(State.user.role);

  tbody.innerHTML = State.employees.map((emp) => `
    <tr>
      <td>
        <div style="display:flex;align-items:center;gap:.75rem;">
          <div class="user-avatar">${getInitials(emp.name)}</div>
          <div><div style="font-weight:500;">${escapeHtml(emp.name)}</div><div style="font-size:.75rem;color:var(--text-muted);">${escapeHtml(emp.email)}</div></div>
        </div>
      </td>
      <td><span class="badge role-badge-${emp.role}" style="text-transform:capitalize;">${formatRole(emp.role)}</span></td>
      <td>${escapeHtml(emp.phone || '-')}</td>
      <td><span class="badge badge-${emp.isActive ? 'success' : 'gray'}">${emp.isActive ? 'Active' : 'Inactive'}</span></td>
      <td>
        ${canManage && emp.role !== 'owner' ? `
          <button class="btn btn-ghost btn-sm" onclick='openEmployeeModal(${JSON.stringify(emp._id)})'>Edit</button>
          <button class="btn btn-ghost btn-sm" onclick='openResetPasswordModal(${JSON.stringify(emp._id)})'>Reset Password</button>
          <button class="btn btn-ghost btn-sm" onclick="toggleEmployeeActive('${emp._id}', ${!emp.isActive})">${emp.isActive ? 'Deactivate' : 'Activate'}</button>
          <button class="btn btn-ghost btn-sm text-danger" onclick="deleteEmployee('${emp._id}')">Remove</button>
        ` : ''}
      </td>
    </tr>
  `).join('');
}

function openEmployeeModal(employeeId) {
  document.getElementById('employee-alert').style.display = 'none';
  const emp = employeeId ? State.employees.find((e) => e._id === employeeId) : null;

  document.getElementById('employee-modal-title').textContent = emp ? 'Edit Employee' : 'Add Employee';
  document.getElementById('employee-id').value = emp ? emp._id : '';
  document.getElementById('employee-name').value = emp ? emp.name : '';
  document.getElementById('employee-email').value = emp ? emp.email : '';
  document.getElementById('employee-phone').value = emp ? (emp.phone || '') : '';
  document.getElementById('employee-role').value = emp ? emp.role : 'cashier';

  // Managers cannot promote to "manager" role (only owners can)
  const roleSelect = document.getElementById('employee-role');
  const managerOption = roleSelect.querySelector('option[value="manager"]');
  if (managerOption) managerOption.style.display = State.user.role === 'owner' ? '' : 'none';

  // Password + email fields are locked when editing (email can't change here to keep it simple)
  document.getElementById('employee-password-group').style.display = emp ? 'none' : '';
  document.getElementById('employee-email').disabled = !!emp;

  openModal('employee-modal');
}

async function saveEmployee() {
  const id = document.getElementById('employee-id').value;
  const alertEl = document.getElementById('employee-alert');
  alertEl.style.display = 'none';

  const name = document.getElementById('employee-name').value.trim();
  const role = document.getElementById('employee-role').value;
  const phone = document.getElementById('employee-phone').value.trim();

  try {
    if (id) {
      await Api.users.update(id, { name, role, phone });
    } else {
      const email = document.getElementById('employee-email').value.trim();
      const password = document.getElementById('employee-password').value;
      if (!password || password.length < 6) {
        alertEl.textContent = 'Temporary password must be at least 6 characters';
        alertEl.style.display = 'block';
        return;
      }
      await Api.users.create({ name, email, password, role, phone });
    }
    closeModal('employee-modal');
    await loadEmployees();
    showToast('Employee saved successfully', 'success');
  } catch (err) {
    alertEl.textContent = err.message;
    alertEl.style.display = 'block';
  }
}

async function toggleEmployeeActive(id, nextActive) {
  try {
    await Api.users.update(id, { isActive: nextActive });
    await loadEmployees();
    showToast(nextActive ? 'Employee activated' : 'Employee deactivated', 'success');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function deleteEmployee(id) {
  if (!confirm('Remove this employee account? This cannot be undone.')) return;
  try {
    await Api.users.remove(id);
    await loadEmployees();
    showToast('Employee removed', 'success');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function openResetPasswordModal(employeeId) {
  const emp = State.employees.find((e) => e._id === employeeId);
  if (!emp) return;
  document.getElementById('reset-password-alert').style.display = 'none';
  document.getElementById('reset-password-employee-id').value = emp._id;
  document.getElementById('reset-password-employee-name').textContent = `Setting a new temporary password for ${emp.name} (${emp.email}).`;
  document.getElementById('reset-password-new').value = '';
  openModal('reset-password-modal');
}

async function saveResetPassword() {
  const id = document.getElementById('reset-password-employee-id').value;
  const newPassword = document.getElementById('reset-password-new').value;
  const alertEl = document.getElementById('reset-password-alert');
  alertEl.style.display = 'none';

  if (!newPassword || newPassword.length < 6) {
    alertEl.textContent = 'Password must be at least 6 characters';
    alertEl.style.display = 'block';
    return;
  }

  try {
    await Api.users.resetPassword(id, newPassword);
    closeModal('reset-password-modal');
    showToast('Password reset successfully', 'success');
  } catch (err) {
    alertEl.textContent = err.message;
    alertEl.style.display = 'block';
  }
}

// =======================
// Settings - change own password
// =======================
async function handleChangePassword() {
  const currentPassword = document.getElementById('current-password').value;
  const newPassword = document.getElementById('new-password').value;
  const alertEl = document.getElementById('password-alert');

  try {
    const res = await Api.auth.changePassword({ currentPassword, newPassword });
    alertEl.className = 'alert alert-success';
    alertEl.textContent = res.message;
    alertEl.style.display = 'block';
    document.getElementById('current-password').value = '';
    document.getElementById('new-password').value = '';
  } catch (err) {
    alertEl.className = 'alert alert-error';
    alertEl.textContent = err.message;
    alertEl.style.display = 'block';
  }
}

// =======================
// Utilities
// =======================
function escapeHtml(str) {
  if (str === undefined || str === null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
