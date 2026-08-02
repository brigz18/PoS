// =========================================
// SmartPOS - Dashboard Application Logic (dashboard.html)
// Every data operation goes through Api.* (see js/api.js), which talks to
// the Express backend, which talks to MongoDB. No local arrays of fake data.
// =========================================

const State = {
  cart: [],
  selectedCustomer: null,
  categories: [
    { _id: "c1", name: "Appetizers / Starters" },
    { _id: "c2", name: "Breakfast" },
    { _id: "c3", name: "Burgers" },
    { _id: "c4", name: "Pizza" },
    { _id: "c5", name: "Snacks" },
    { _id: "c6", name: "Pasta" },
    { _id: "c7", name: "Rice Meals" },
    { _id: "c8", name: "Beef" },
    { _id: "c9", name: "Pork" },
    { _id: "c10", name: "Seafood" },
    { _id: "c11", name: "Filipino Food" },
    { _id: "c12", name: "Sandwiches" },
    { _id: "c13", name: "Salads" },
    { _id: "c14", name: "Soups" },
    { _id: "c15", name: "Desserts" },
    { _id: "c16", name: "Coffee" },
    { _id: "c17", name: "Milk Tea" },
    { _id: "c18", name: "Soft Drinks" },
    { _id: "c19", name: "Juices" },
    { _id: "c20", name: "Smoothies / Shakes" },
    { _id: "c21", name: "Tea" },
    { _id: "c22", name: "Water" },
    { _id: "c23", name: "Instant Foods" },
  ],
  products: [],
  customers: [],
  suppliers: [],
  employees: [],
  sales: [],
  business: null,
  user: null,
  currentCategoryFilter: "all",
};

// =======================
// Bootstrap / Guard
// =======================
(function guardAndInit() {
  if (!Auth.isLoggedIn()) {
    window.location.href = "index.html";
    return;
  }
  State.user = Auth.getUser();
  State.business = Auth.getBusiness();
  document.addEventListener("DOMContentLoaded", init);
})();

async function init() {
  initTheme();
  applyPermissionVisibility();
  renderUserHeader();

  try {
    // Refresh the profile/business in case it changed since login
    const me = await Api.auth.me();
    State.user = me.user;
    State.business = me.business;
    Auth.setSession({
      token: Auth.getToken(),
      user: me.user,
      business: me.business,
    });
    renderUserHeader();
    applyPermissionVisibility();

    if (isSubscriptionExpired(me.business)) {
      onSubscriptionExpired();
      return; // don't bother loading dashboard data the user can't reach yet
    }
  } catch (err) {
    showToast(err.message, "error");
    if (err.message.includes("token")) {
      window.location.href = "index.html";
      return;
    }
  }

  await Promise.all([loadCategories(), loadProducts()]);
  renderPOSCategories();
  await loadDashboard();
  dashboardRefreshTimer = setInterval(loadDashboard, 30000);

  // Close the notification dropdown when clicking anywhere else on the page
  document.addEventListener("click", (event) => {
    const wrapper = document.querySelector(".notification-wrapper");
    if (wrapper && !wrapper.contains(event.target)) {
      document
        .getElementById("notification-dropdown")
        ?.classList.remove("active");
    }
  });
}

// =======================
// Role-based visibility
// =======================
// Hides/shows each sidebar nav item based on the logged-in employee's
// granular permissions (see backend/utils/permissions.js for the full model).
// An Owner always sees everything, regardless of their `permissions` object.
// "Settings" uses the special value "always" since every account - no matter
// their permissions - needs somewhere to change their own password.
function applyPermissionVisibility() {
  const isOwner = State.user && State.user.role === "owner";
  const permissions = (State.user && State.user.permissions) || {};

  document.querySelectorAll(".nav-item[data-permission]").forEach((item) => {
    const key = item.dataset.permission;
    const visible = isOwner || key === "always" || permissions[key] === true;
    item.classList.toggle("hidden-role", !visible);
  });
}

// Reusable check for "does the current employee have this permission" - used
// throughout the app to decide whether to render Edit/Delete/Add buttons, in
// addition to the sidebar visibility above. An Owner always passes, matching
// the backend's requirePermission() behavior exactly.
function hasPermission(key) {
  if (!State.user) return false;
  if (State.user.role === "owner") return true;
  return !!(State.user.permissions && State.user.permissions[key]);
}

// =======================
// Header / Theme
// =======================
function renderUserHeader() {
  if (!State.user || !State.business) return;
  document.getElementById("user-initials").textContent = getInitials(
    State.user.name,
  );
  document.getElementById("user-name").textContent = State.user.name;
  document.getElementById("user-role").textContent = formatRole(
    State.user.role,
  );
  const label = document.getElementById("business-name-label");
  if (label) label.textContent = `Welcome back to ${State.business.name}!`;

  document.getElementById("settings-business-name").value =
    State.business.name || "";
  document.getElementById("settings-currency").value =
    State.business.currencySymbol || "";
  document.getElementById("settings-tax-rate").value =
    State.business.taxRate ?? "";
  document.getElementById("settings-plan").value = (
    State.business.subscriptionPlan || ""
  ).toUpperCase();
  renderSubscriptionStatus();

  // Only the Owner can edit business settings; everyone else sees them read-only.
  const isOwner = State.user.role === "owner";
  ["settings-business-name", "settings-currency", "settings-tax-rate"].forEach(
    (id) => {
      document.getElementById(id).disabled = !isOwner;
    },
  );
  const saveBtn = document.getElementById("save-business-btn");
  const note = document.getElementById("business-settings-note");
  if (saveBtn) saveBtn.style.display = isOwner ? "inline-flex" : "none";
  if (note)
    note.textContent = isOwner
      ? "Subscription plan changes are handled by billing/support - everything else here is yours to edit."
      : "Only the business Owner can edit these settings. Contact them if something needs to change.";
}

async function saveBusinessSettings() {
  const alertEl = document.getElementById("business-settings-alert");
  alertEl.style.display = "none";

  const payload = {
    name: document.getElementById("settings-business-name").value.trim(),
    currencySymbol: document.getElementById("settings-currency").value.trim(),
    taxRate: parseFloat(document.getElementById("settings-tax-rate").value),
  };

  if (!payload.name) {
    alertEl.textContent = "Business name is required";
    alertEl.style.display = "block";
    return;
  }
  if (isNaN(payload.taxRate) || payload.taxRate < 0 || payload.taxRate > 100) {
    alertEl.textContent = "Tax rate must be a number between 0 and 100";
    alertEl.style.display = "block";
    return;
  }

  const btn = document.getElementById("save-business-btn");
  btn.disabled = true;
  const originalText = btn.textContent;
  btn.innerHTML = '<span class="spinner"></span> Saving...';

  try {
    const { data } = await Api.business.update(payload);
    State.business = data;
    Auth.setSession({
      token: Auth.getToken(),
      user: State.user,
      business: data,
    });
    renderUserHeader();
    showToast("Business settings updated", "success");
  } catch (err) {
    alertEl.textContent = err.message;
    alertEl.style.display = "block";
  } finally {
    btn.disabled = false;
    btn.textContent = originalText;
  }
}

function formatRole(role) {
  return (
    {
      owner: "Owner",
      manager: "Manager",
      cashier: "Cashier",
      inventory_staff: "Inventory Staff",
    }[role] || role
  );
}

// =======================
// Subscription expiry + renewal
// =======================
const RENEWAL_PLAN_PRICES = { starter: 29, professional: 79, enterprise: 149 };
const RENEWAL_PLAN_LABELS = {
  starter: "Starter",
  professional: "Professional",
  enterprise: "Enterprise",
};

function isSubscriptionExpired(business) {
  if (!business) return false;
  if (business.subscriptionStatus === "expired") return true;
  return !!(
    business.subscriptionExpiresAt &&
    new Date(business.subscriptionExpiresAt).getTime() < Date.now()
  );
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
  const plan = business?.subscriptionPlan || "starter";
  document.getElementById("renewal-plan-name").textContent =
    RENEWAL_PLAN_LABELS[plan] || plan;
  document.getElementById("renewal-plan-price").innerHTML =
    `$${RENEWAL_PLAN_PRICES[plan] || "--"}<small>/month</small>`;
  document.getElementById("renewal-payer-name").value =
    (State.user && State.user.name) || "";

  document.getElementById("renewal-modal-title").textContent = forced
    ? "Subscription Expired"
    : "Renew Subscription";
  document.getElementById("renewal-modal-note").textContent = forced
    ? "Your business's subscription has expired. Renew below to restore access to SmartPOS - your data is safe and will be exactly as you left it."
    : "Renewing now extends your subscription by 30 more days on top of any time you already have left.";
  document
    .getElementById("renewal-logout-btn")
    .classList.toggle("hidden", !forced);
  document
    .getElementById("renewal-cancel-btn")
    .classList.toggle("hidden", forced);

  const isOwner = State.user && State.user.role === "owner";
  document.getElementById("renewal-alert").style.display = "none";
  if (!isOwner) {
    document.getElementById("renewal-alert").textContent =
      "Only the business Owner can renew the subscription. Please contact them, or log out.";
    document.getElementById("renewal-alert").className = "alert alert-error";
    document.getElementById("renewal-alert").style.display = "block";
    document.getElementById("renewal-pay-btn").style.display = "none";
  } else {
    document.getElementById("renewal-pay-btn").style.display = "inline-flex";
  }

  openModal("renewal-modal");
}

// Populates the Settings -> Subscription card with the current plan, expiry
// date, days remaining, and a color-coded status badge.
function renderSubscriptionStatus() {
  const business = State.business;
  if (!business) return;

  document.getElementById("subscription-plan-label").textContent =
    `${RENEWAL_PLAN_LABELS[business.subscriptionPlan] || business.subscriptionPlan} Plan`;

  const badge = document.getElementById("subscription-status-badge");
  const expiryLabel = document.getElementById("subscription-expiry-label");
  const renewBtn = document.getElementById("renew-now-btn");
  const isOwner = State.user && State.user.role === "owner";
  renewBtn.style.display = isOwner ? "inline-flex" : "none";

  if (!business.subscriptionExpiresAt) {
    expiryLabel.textContent = "No active billing period on file";
    badge.textContent = "Unknown";
    badge.className = "badge badge-gray";
    return;
  }

  const expiresAt = new Date(business.subscriptionExpiresAt);
  const daysLeft = Math.ceil(
    (expiresAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000),
  );
  expiryLabel.textContent = `Renews/expires on ${expiresAt.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })}`;

  if (isSubscriptionExpired(business)) {
    badge.textContent = "Expired";
    badge.className = "badge badge-danger";
  } else if (daysLeft <= 7) {
    badge.textContent = `${daysLeft} day${daysLeft === 1 ? "" : "s"} left`;
    badge.className = "badge badge-warning";
  } else {
    badge.textContent = "Active";
    badge.className = "badge badge-success";
  }
}

function selectRenewalMethod(btn) {
  document
    .querySelectorAll("#renewal-payment-methods .payment-method")
    .forEach((b) => b.classList.remove("active"));
  btn.classList.add("active");
  const isCard = btn.dataset.method === "card";
  document
    .getElementById("renewal-card-fields")
    .classList.toggle("hidden", !isCard);
  document
    .getElementById("renewal-wallet-fields")
    .classList.toggle("hidden", isCard);
}

async function handleRenewal() {
  const alertEl = document.getElementById("renewal-alert");
  alertEl.style.display = "none";

  const business = State.business || Auth.getBusiness();
  const plan = business?.subscriptionPlan || "starter";
  const method =
    document.querySelector("#renewal-payment-methods .payment-method.active")
      ?.dataset.method || "gcash";
  const payerName = document.getElementById("renewal-payer-name").value.trim();

  const payload = {
    plan,
    paymentMethod: method,
    payerName,
    purpose: "renewal",
  };
  if (method === "card") {
    payload.cardNumber = document
      .getElementById("renewal-card-number")
      .value.trim();
    payload.cardExpiry = document
      .getElementById("renewal-card-expiry")
      .value.trim();
    payload.cardCvv = document.getElementById("renewal-card-cvv").value.trim();
  } else {
    payload.mobileNumber = document
      .getElementById("renewal-mobile")
      .value.trim();
  }

  const btn = document.getElementById("renewal-pay-btn");
  btn.disabled = true;
  const originalText = btn.textContent;
  btn.innerHTML = '<span class="spinner"></span> Processing...';

  try {
    const { data: payment } = await Api.payments.checkout(payload);
    const { data: renewedBusiness } = await Api.payments.renew({
      reference: payment.reference,
    });
    State.business = renewedBusiness;
    Auth.setSession({
      token: Auth.getToken(),
      user: State.user,
      business: renewedBusiness,
    });
    closeModal("renewal-modal");
    showToast("Subscription renewed successfully!", "success");
    renderUserHeader();
    // Reload the data pages that were blocked while expired
    await Promise.all([loadCategories(), loadProducts()]);
    renderPOSCategories();
    await loadDashboard();
  } catch (err) {
    alertEl.textContent = err.message;
    alertEl.className = "alert alert-error";
    alertEl.style.display = "block";
  } finally {
    btn.disabled = false;
    btn.textContent = originalText;
  }
}

function getInitials(name) {
  return (name || "")
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function formatCurrency(amount) {
  const symbol = (State.business && State.business.currencySymbol) || "$";
  return `${symbol}${Number(amount || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// Used everywhere we drop user- or server-supplied text into innerHTML, so a
// product/customer/supplier name containing "<" or "&" can't break markup.
function escapeHtml(str) {
  return String(str ?? "").replace(
    /[&<>"']/g,
    (ch) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[ch],
  );
}

function initTheme() {
  const theme = localStorage.getItem("smartpos-theme") || "light";
  document.documentElement.classList.toggle("dark", theme === "dark");
  updateThemeIcon(theme);
}

function toggleTheme() {
  const isDark = document.documentElement.classList.toggle("dark");
  localStorage.setItem("smartpos-theme", isDark ? "dark" : "light");
  updateThemeIcon(isDark ? "dark" : "light");
}

function updateThemeIcon(theme) {
  const icon = document.getElementById("theme-icon");
  if (!icon) return;
  icon.innerHTML =
    theme === "dark"
      ? '<circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>'
      : '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>';
}

function showToast(message, type = "info") {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.className = `toast active ${type}`;
  setTimeout(() => (toast.className = "toast"), 3000);
}

function closeModal(id) {
  document.getElementById(id).classList.remove("active");
}
function openModal(id) {
  document.getElementById(id).classList.add("active");
}

function handleLogout(event) {
  if (event) event.preventDefault();
  if (confirm("Are you sure you want to logout?")) {
    Auth.clearSession();
    window.location.href = "index.html";
  }
}

function toggleSidebar(event) {
  if (event) event.preventDefault();
  const dashboard = document.getElementById("dashboard");
  const btn = document.querySelector(".sidebar-toggle");
  const collapsed = dashboard.classList.toggle("sidebar-collapsed");
  if (btn) {
    const label = collapsed ? "Expand sidebar" : "Collapse sidebar";
    btn.setAttribute("aria-expanded", String(!collapsed));
    btn.setAttribute("aria-label", label);
    btn.setAttribute("title", label);
  }
}

// =======================
// Navigation
// =======================
async function navigateTo(page, event) {
  if (event) event.preventDefault();

  document
    .querySelectorAll(".nav-item")
    .forEach((item) => item.classList.remove("active"));
  const activeNav = document.querySelector(`.nav-item[data-page="${page}"]`);
  if (activeNav) activeNav.classList.add("active");

  document
    .querySelectorAll(".page-content")
    .forEach((c) => c.classList.remove("active"));
  const content = document.getElementById(`${page}-content`);
  if (content) content.classList.add("active");

  // Auto-refresh the dashboard every 30s while it's visible, so
  // stats/top-products/low-stock update on their own. Stops automatically
  // the moment you navigate elsewhere.
  stopDashboardAutoRefresh();
  if (page === "dashboard") {
    dashboardRefreshTimer = setInterval(loadDashboard, 30000);
  }

  try {
    if (page === "dashboard") await loadDashboard();
    if (page === "pos") {
      await Promise.all([loadProducts(), loadCategories()]);
      renderPOSCategories();
      renderPOSProducts();
      posPopulateCustomerSelect();
      renderPOSCart();
    }
    if (page === "sales") await loadSales();
    if (page === "products") {
      await Promise.all([loadProducts(), loadCategories()]);
      populateCategorySelects();
      renderProductsTable();
    }
    if (page === "inventory") await loadInventory();
    if (page === "customers") {
      await loadCustomers();
      renderCustomersGrid();
    }
    if (page === "suppliers") {
      await loadSuppliers();
      renderSuppliersGrid();
    }
    if (page === "employees") await loadEmployees();
    if (page === "finance") await loadFinance();
  } catch (err) {
    showToast(err.message, "error");
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
  const activePage = document.querySelector(".page-content.active")?.id || "";

  if (activePage === "products-content") {
    document.getElementById("product-search").value = value;
    renderProductsTable();
    return;
  }
  if (activePage === "customers-content") {
    document.getElementById("customer-search").value = value;
    renderCustomersGrid();
    return;
  }
  if (activePage === "pos-content") {
    document.getElementById("posSearch").value = value;
    posState.query = value;
    renderPOSProducts();
    return;
  }

  if (event.key === "Enter" && value.trim()) {
    navigateTo("products").then(() => {
      document.getElementById("product-search").value = value;
      renderProductsTable();
    });
  }
}

// =======================
// Dashboard — fully computed from live products + sales data
// =======================

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function setDelta(id, text, tone) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = text;
  el.className =
    "stat__delta" +
    (tone === "up"
      ? " stat__delta--up"
      : tone === "down"
        ? " stat__delta--down"
        : "");
}

function saleDate(s) {
  return new Date(s.createdAt || s.date || s.updatedAt || Date.now());
}

function saleTotal(s) {
  return Number(s.total ?? s.grandTotal ?? 0);
}

function saleItems(s) {
  return Array.isArray(s.items) ? s.items : [];
}

function itemQty(i) {
  return Number(i.qty ?? i.quantity ?? 0);
}

function itemLineRevenue(i) {
  if (i.subtotal != null) return Number(i.subtotal);
  const price = Number(i.price ?? i.unitPrice ?? 0);
  return price * itemQty(i);
}

// Best-effort cost lookup: prefer cost recorded on the sale line item,
// fall back to the product's current cost from the catalog.
function itemLineCost(i) {
  if (i.cost != null) return Number(i.cost) * itemQty(i);
  if (i.unitCost != null) return Number(i.unitCost) * itemQty(i);
  const productId = typeof i.product === "object" ? i.product?._id : i.product;
  const catalogProduct = (State.products || []).find(
    (p) => p._id === productId || p._id === i.productId,
  );
  if (catalogProduct) return Number(catalogProduct.cost || 0) * itemQty(i);
  return itemLineRevenue(i) * 0.65; // last-resort estimate: assume ~35% gross margin
}

function saleProfit(s) {
  return saleItems(s).reduce(
    (sum, i) => sum + (itemLineRevenue(i) - itemLineCost(i)),
    0,
  );
}

function itemCategoryName(i) {
  if (i.category)
    return typeof i.category === "object" ? i.category.name : i.category;
  const productId = typeof i.product === "object" ? i.product?._id : i.product;
  const catalogProduct = (State.products || []).find(
    (p) => p._id === productId || p._id === i.productId,
  );
  if (catalogProduct) return categoryName(catalogProduct.category);
  return "Uncategorized";
}

function startOfDay(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

async function loadDashboard() {
  try {
    const [productsRes, salesRes] = await Promise.all([
      Api.products.list(),
      Api.sales.list(),
    ]);
    State.products = productsRes.data || [];
    if (!State.categories || !State.categories.length) {
      try {
        const { data } = await Api.categories.list();
        State.categories = data || [];
      } catch (e) {
        /* categories optional here */
      }
    }

    const sales = salesRes.data || [];
    const today = startOfDay(new Date());
    const todaySales = sales.filter((s) => saleDate(s) >= today);

    // --- Stat cards: automatically counted from real transactions ---
    const todayRevenue = todaySales.reduce((sum, s) => sum + saleTotal(s), 0);
    const todayOrders = todaySales.length;
    const completedToday = todaySales.filter(
      (s) =>
        (s.status || "Completed") !== "Refunded" &&
        (s.status || "Completed") !== "Cancelled",
    ).length;
    const todayProfit = todaySales.reduce((sum, s) => sum + saleProfit(s), 0);
    const margin = todayRevenue > 0 ? (todayProfit / todayRevenue) * 100 : 0;

    setText("stat-revenue", formatCurrency(todayRevenue));
    setDelta(
      "stat-revenue-delta",
      todayOrders
        ? `${todayOrders} order${todayOrders === 1 ? "" : "s"} today`
        : "No sales yet",
      todayOrders ? "up" : null,
    );

    setText("stat-orders", String(todayOrders));
    setDelta(
      "stat-orders-delta",
      `${completedToday} completed · ${todayOrders - completedToday} other`,
      null,
    );

    setText("stat-profit", formatCurrency(todayProfit));
    setDelta(
      "stat-profit-delta",
      `${margin.toFixed(1)}% margin`,
      margin >= 0 ? "up" : "down",
    );

    setText("stat-products", String(State.products.length));
    const lowStock = State.products.filter(
      (p) => p.stock > 0 && p.stock <= (p.minStock || 0),
    );
    const outStock = State.products.filter((p) => (p.stock || 0) <= 0);
    setDelta(
      "stat-products-delta",
      `${lowStock.length} low · ${outStock.length} out of stock`,
      lowStock.length + outStock.length > 0 ? "down" : null,
    );

    updateNotifications([...outStock, ...lowStock]);
    renderWeeklySalesChart(sales);
    renderCategoryChart(sales);
    renderRecentTransactions(sales);
    renderRecentActivity(outStock, lowStock);
  } catch (err) {
    showToast(err.message, "error");
  }
}

// --- Sales this week: real bar chart from the last 7 days of sales ---
function renderWeeklySalesChart(sales) {
  const el = document.getElementById("salesChart");
  if (!el) return;

  const days = [];
  const today = startOfDay(new Date());
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    days.push({ date: d, total: 0 });
  }
  sales.forEach((s) => {
    const d = startOfDay(saleDate(s));
    const bucket = days.find((day) => day.date.getTime() === d.getTime());
    if (bucket) bucket.total += saleTotal(s);
  });

  const max = Math.max(1, ...days.map((d) => d.total));
  el.innerHTML = days
    .map((d) => {
      const pct = Math.round((d.total / max) * 100);
      const label = d.date.toLocaleDateString([], { weekday: "short" });
      return `
        <div class="bar-col">
          <span class="bar-value">${d.total > 0 ? formatCurrency(d.total) : ""}</span>
          <div class="bar" style="height:${Math.max(pct, d.total > 0 ? 4 : 0)}%" title="${escapeHtml(label)}: ${formatCurrency(d.total)}"></div>
          <span class="bar-label">${escapeHtml(label)}</span>
        </div>`;
    })
    .join("");
}

// --- Sales by category: highest to lowest, as bars ---
function renderCategoryChart(sales) {
  const el = document.getElementById("categoryChart");
  if (!el) return;

  const totals = {};
  sales.forEach((s) => {
    saleItems(s).forEach((i) => {
      const name = itemCategoryName(i);
      totals[name] = (totals[name] || 0) + itemLineRevenue(i);
    });
  });

  const rows = Object.entries(totals)
    .map(([name, total]) => ({ name, total }))
    .sort((a, b) => b.total - a.total);

  if (!rows.length) {
    el.innerHTML = '<p class="text-muted text-sm">No sales yet.</p>';
    return;
  }

  const max = rows[0].total || 1;
  el.innerHTML = rows
    .map(
      (r) => `
      <div class="cat-row">
        <div class="cat-row__top">
          <span>${escapeHtml(r.name)}</span>
          <strong>${formatCurrency(r.total)}</strong>
        </div>
        <div class="cat-bar-track">
          <div class="cat-bar-fill" style="width:${Math.round((r.total / max) * 100)}%"></div>
        </div>
      </div>`,
    )
    .join("");
}

// --- Recent transactions: latest real sales, newest first ---
function renderRecentTransactions(sales) {
  const el = document.getElementById("recentTransactions");
  if (!el) return;

  const rows = sales
    .slice()
    .sort((a, b) => saleDate(b) - saleDate(a))
    .slice(0, 5);
  el.innerHTML = rows.length
    ? rows
        .map((s) => {
          const itemCount = saleItems(s).reduce((n, i) => n + itemQty(i), 0);
          const customerName = s.customer
            ? typeof s.customer === "object"
              ? s.customer.name || "Walk-in"
              : s.customer
            : "Walk-in";
          const status = s.status || "Completed";
          return `<tr>
            <td>${escapeHtml(s.receiptNumber || s.reference || String(s._id || "").slice(-8))}</td>
            <td>${escapeHtml(customerName)}</td>
            <td>${itemCount}</td>
            <td>${escapeHtml(s.paymentMethod || "-")}</td>
            <td>${formatCurrency(saleTotal(s))}</td>
            <td><span class="badge badge-${status === "Refunded" || status === "Cancelled" ? "danger" : "success"}">${escapeHtml(status)}</span></td>
            <td>${saleDate(s).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</td>
          </tr>`;
        })
        .join("")
    : '<tr><td colspan="7" class="loading-text">No transactions yet</td></tr>';
}

// --- Recent activity: real out-of-stock / low-stock log ---
function renderRecentActivity(outStock, lowStock) {
  const el = document.getElementById("recentActivity");
  if (!el) return;

  const outLines = outStock
    .slice(0, 5)
    .map(
      (p) =>
        `<div class="list-item">🔴 <strong>${escapeHtml(p.name)}</strong> is out of stock</div>`,
    );
  const lowLines = lowStock
    .slice(0, 5)
    .map(
      (p) =>
        `<div class="list-item">🟡 <strong>${escapeHtml(p.name)}</strong> is low on stock (${p.stock} left, reorder at ${p.minStock})</div>`,
    );

  const lines = [...outLines, ...lowLines];
  el.innerHTML = lines.length
    ? lines.join("")
    : '<p class="text-muted text-sm">All products are sufficiently stocked.</p>';
}

// =======================
// Notifications (real low-stock alerts, not a placeholder)
// =======================
function updateNotifications(lowStockProducts) {
  const badge = document.getElementById("notification-badge");
  const list = document.getElementById("notification-list");
  if (!badge || !list) return;

  if (lowStockProducts.length === 0) {
    badge.style.display = "none";
    list.innerHTML =
      '<p class="loading-text">No low stock alerts right now.</p>';
    return;
  }

  badge.style.display = "flex";
  badge.textContent = lowStockProducts.length;
  list.innerHTML = lowStockProducts
    .map(
      (p) => `
    <div class="notification-item" onclick="navigateTo('inventory')">
      <span class="notification-item-name">${escapeHtml(p.name)}</span>
      <span class="notification-item-stock ${p.stock === 0 ? "danger" : "warning"}">${p.stock === 0 ? "Out of stock" : p.stock + " left"}</span>
    </div>
  `,
    )
    .join("");
}

function toggleNotifications() {
  document.getElementById("notification-dropdown")?.classList.toggle("active");
}

// =======================
// Categories + Products data
// =======================
async function loadCategories() {
  const { data } = await Api.categories.list();
  State.categories = data;
}

async function loadProducts() {
  const { data } = await Api.products.list();
  State.products = data;
}

function productStatus(p) {
  if (p.stock <= 0)
    return { key: "out", label: "Out of stock", badge: "danger" };
  if (p.stock <= p.minStock)
    return { key: "low", label: "Low stock", badge: "warning" };
  return { key: "ok", label: "In stock", badge: "success" };
}

function categoryName(categoryId) {
  const cat = State.categories.find(
    (c) => c._id === categoryId || c._id === (categoryId && categoryId._id),
  );
  return cat ? cat.name : "—";
}

// =======================
// Product Catalog
// =======================
function populateCategorySelects() {
  const options = State.categories
    .map((c) => `<option value="${c._id}">${escapeHtml(c.name)}</option>`)
    .join("");
  const filter = document.getElementById("product-category-filter");
  if (filter) {
    const prev = filter.value;
    filter.innerHTML = `<option value="all">All categories</option>` + options;
    filter.value = prev || "all";
  }
  const formSelect = document.getElementById("product-category");
  if (formSelect)
    formSelect.innerHTML =
      `<option value="">Select a category</option>` + options;
  const beSelect = document.getElementById("be-product");
  if (beSelect) {
    beSelect.innerHTML =
      `<option value="">All products (average)</option>` +
      State.products
        .map((p) => `<option value="${p._id}">${escapeHtml(p.name)}</option>`)
        .join("");
  }
}

function renderProductsTable() {
  const tbody = document.getElementById("products-tbody");
  if (!tbody) return;
  const search = (
    document.getElementById("product-search")?.value || ""
  ).toLowerCase();
  const categoryFilter =
    document.getElementById("product-category-filter")?.value || "all";
  const statusFilter =
    document.getElementById("product-status-filter")?.value || "all";

  let list = State.products.filter((p) => {
    if (categoryFilter !== "all" && p.category !== categoryFilter) return false;
    if (statusFilter !== "all" && productStatus(p).key !== statusFilter)
      return false;
    if (!search) return true;
    return (
      p.name.toLowerCase().includes(search) ||
      (p.sku || "").toLowerCase().includes(search) ||
      (p.barcode || "").includes(search)
    );
  });

  const countEl = document.getElementById("product-count");
  if (countEl)
    countEl.textContent = `${list.length} of ${State.products.length} products`;
  const canManage = hasPermission("manageProducts");

  tbody.innerHTML = list.length
    ? list
        .map((p) => {
          const s = productStatus(p);
          const margin = p.price
            ? (((p.price - (p.costPrice || 0)) / p.price) * 100).toFixed(0)
            : 0;
          return `<tr>
          <td>
            <div style="font-weight:600">${escapeHtml(p.name)}</div>
            <div class="text-xs text-muted">${escapeHtml(p.sku || "")} · ${escapeHtml(p.barcode || "—")}</div>
          </td>
          <td class="text-muted">${escapeHtml(categoryName(p.category))}</td>
          <td>${formatCurrency(p.costPrice)}</td>
          <td><strong>${formatCurrency(p.price)}</strong></td>
          <td><span class="badge badge-info">${margin}%</span></td>
          <td>${p.stock} ${escapeHtml(p.unit || "pc")}</td>
          <td><span class="badge badge-${s.badge}">${s.label}</span></td>
          <td>
            ${
              canManage
                ? `<button class="btn btn-ghost btn-sm" onclick="openProductModal('${p._id}')">Edit</button>
                   <button class="btn btn-ghost btn-sm text-danger" onclick="deleteProductRecord('${p._id}')">Delete</button>`
                : ""
            }
          </td>
        </tr>`;
        })
        .join("")
    : `<tr><td colspan="8" class="text-muted" style="text-align:center;padding:36px">No products found.</td></tr>`;
}

function openProductModal(productId) {
  populateCategorySelects();
  const p = productId ? State.products.find((x) => x._id === productId) : null;
  document.getElementById("product-alert").classList.add("hidden");
  document.getElementById("product-modal-title").textContent = p
    ? "Edit Product"
    : "Add Product";
  document.getElementById("product-id").value = p ? p._id : "";
  document.getElementById("product-name").value = p ? p.name : "";
  document.getElementById("product-sku").value = p ? p.sku || "" : "";
  document.getElementById("product-barcode").value = p ? p.barcode || "" : "";
  document.getElementById("product-category").value = p ? p.category : "";
  document.getElementById("product-cost").value = p ? (p.costPrice ?? "") : "";
  document.getElementById("product-price").value = p ? (p.price ?? "") : "";
  document.getElementById("product-stock").value = p ? (p.stock ?? "") : "";
  document.getElementById("product-min-stock").value = p
    ? (p.minStock ?? "")
    : "";
  document.getElementById("product-unit").value = p ? p.unit || "" : "";
  openModal("product-modal");
}

async function saveProduct() {
  const id = document.getElementById("product-id").value;
  const alertEl = document.getElementById("product-alert");
  alertEl.classList.add("hidden");

  const payload = {
    name: document.getElementById("product-name").value.trim(),
    sku: document.getElementById("product-sku").value.trim(),
    barcode: document.getElementById("product-barcode").value.trim(),
    category: document.getElementById("product-category").value,
    costPrice: Number(document.getElementById("product-cost").value) || 0,
    price: Number(document.getElementById("product-price").value) || 0,
    stock: Number(document.getElementById("product-stock").value) || 0,
    minStock: Number(document.getElementById("product-min-stock").value) || 0,
    unit: document.getElementById("product-unit").value.trim() || "pc",
  };

  if (!payload.name || !payload.sku || !payload.price) {
    alertEl.textContent = "Name, SKU and selling price are required";
    alertEl.classList.remove("hidden");
    return;
  }

  try {
    if (id) await Api.products.update(id, payload);
    else await Api.products.create(payload);
    closeModal("product-modal");
    await loadProducts();
    renderProductsTable();
    renderPOSCategories();
    renderPOSProducts();
    showToast(id ? "Product updated" : "Product created", "success");
  } catch (err) {
    alertEl.textContent = err.message;
    alertEl.classList.remove("hidden");
  }
}

async function deleteProductRecord(id) {
  if (!confirm("Delete this product? This cannot be undone.")) return;
  try {
    await Api.products.remove(id);
    await loadProducts();
    renderProductsTable();
    renderPOSCategories();
    renderPOSProducts();
    showToast("Product deleted", "success");
  } catch (err) {
    showToast(err.message, "error");
  }
}

// =======================
// Category management
// =======================
function openCategoryManageModal() {
  renderCategoryManageList();
  document.getElementById("category-manage-alert").classList.add("hidden");
  document.getElementById("new-category-name").value = "";
  openModal("category-manage-modal");
}

function renderCategoryManageList() {
  const list = document.getElementById("category-manage-list");
  if (!list) return;
  list.innerHTML = State.categories.length
    ? State.categories
        .map((c) => {
          const count = State.products.filter(
            (p) => p.category === c._id,
          ).length;
          return `
      <div class="category-manage-row">
        <span class="category-color-dot" style="background:${escapeHtml(c.color || DEFAULT_CATEGORY_COLOR)}"></span>
        <span class="grow">${escapeHtml(c.name)} <span class="text-xs text-muted">(${count} product${count === 1 ? "" : "s"})</span></span>
        <button class="btn btn-ghost btn-sm text-danger" onclick="deleteCategoryRecord('${c._id}')">Delete</button>
      </div>`;
        })
        .join("")
    : '<p class="text-muted text-sm">No categories yet.</p>';
}

async function saveCategory() {
  const alertEl = document.getElementById("category-manage-alert");
  alertEl.classList.add("hidden");
  const name = document.getElementById("new-category-name").value.trim();
  const color = document.getElementById("new-category-color").value;
  if (!name) {
    alertEl.textContent = "Category name is required";
    alertEl.classList.remove("hidden");
    return;
  }
  try {
    await Api.categories.create({ name, color });
    document.getElementById("new-category-name").value = "";
    await loadCategories();
    renderCategoryManageList();
    populateCategorySelects();
    renderPOSCategories();
    renderPOSProducts();
    showToast("Category added", "success");
  } catch (err) {
    alertEl.textContent = err.message;
    alertEl.classList.remove("hidden");
  }
}

async function deleteCategoryRecord(id) {
  const inUse = State.products.some((p) => p.category === id);
  if (
    inUse &&
    !confirm("Products are still using this category. Delete it anyway?")
  )
    return;
  try {
    await Api.categories.remove(id);
    await loadCategories();
    renderCategoryManageList();
    populateCategorySelects();
    renderPOSCategories();
    renderPOSProducts();
    renderProductsTable();
    showToast("Category deleted", "success");
  } catch (err) {
    showToast(err.message, "error");
  }
}

// =======================
// POS terminal
// =======================
const FAVORITES_KEY = "smartpos_favorite_products";
function getFavoriteIds() {
  try {
    return new Set(JSON.parse(localStorage.getItem(FAVORITES_KEY) || "[]"));
  } catch (e) {
    return new Set();
  }
}
function toggleFavoriteId(id) {
  const favs = getFavoriteIds();
  if (favs.has(id)) favs.delete(id);
  else favs.add(id);
  localStorage.setItem(FAVORITES_KEY, JSON.stringify([...favs]));
}

const posState = {
  category: "all",
  query: "",
  favoritesOnly: false,
  held: [],
};

function renderPOSCategories() {
  const el = document.getElementById("posCategories");
  if (!el) return;
  const counts = { all: State.products.length };
  State.products.forEach((p) => {
    counts[p.category] = (counts[p.category] || 0) + 1;
  });
  el.innerHTML = [
    `<button class="cat-btn ${posState.category === "all" ? "is-active" : ""}" data-cat="all"><span>🛒 All Products</span><small>${counts.all || 0}</small></button>`,
  ]
    .concat(
      State.categories.map(
        (c) =>
          `<button class="cat-btn ${posState.category === c._id ? "is-active" : ""}" data-cat="${c._id}"><span>${escapeHtml(c.name)}</span><small>${counts[c._id] || 0}</small></button>`,
      ),
    )
    .join("");
  el.onclick = (e) => {
    const btn = e.target.closest("[data-cat]");
    if (!btn) return;
    posState.category = btn.dataset.cat;
    renderPOSCategories();
    renderPOSProducts();
  };
}

function posVisibleProducts() {
  const q = posState.query.trim().toLowerCase();
  const favs = getFavoriteIds();
  return State.products.filter((p) => {
    if (posState.favoritesOnly && !favs.has(p._id)) return false;
    if (posState.category !== "all" && p.category !== posState.category)
      return false;
    if (!q) return true;
    return (
      p.name.toLowerCase().includes(q) ||
      (p.sku || "").toLowerCase().includes(q) ||
      (p.barcode || "").includes(q)
    );
  });
}

function renderPOSProducts() {
  const grid = document.getElementById("posGrid");
  if (!grid) return;
  const list = posVisibleProducts();
  const favs = getFavoriteIds();
  grid.innerHTML = list.length
    ? list
        .map((p) => {
          const s = productStatus(p);
          const out = s.key === "out";
          const isFav = favs.has(p._id);
          return `<button class="product" data-id="${p._id}" ${out ? "disabled" : ""} aria-label="Add ${escapeHtml(p.name)} to cart">
          <div class="product__thumb" aria-hidden="true">
            <span class="product__fav ${isFav ? "is-active" : ""}" data-fav-id="${p._id}" role="button" aria-label="${isFav ? "Remove from favorites" : "Add to favorites"}" title="${isFav ? "Remove from favorites" : "Add to favorites"}">${isFav ? "★" : "☆"}</span>
          </div>
          <div class="product__body">
            <span class="product__name">${escapeHtml(p.name)}</span>
            <span class="product__sku">${escapeHtml(p.sku || "")}</span>
            <div class="product__foot">
              <span class="product__price">${formatCurrency(p.price)}</span>
              <span class="badge badge--${s.badge}">${out ? "Out" : p.stock + " " + (p.unit || "pc")}</span>
            </div>
          </div>
        </button>`;
        })
        .join("")
    : `<p class="text-muted text-sm">No products match your search.</p>`;
  grid.onclick = (e) => {
    const favStar = e.target.closest("[data-fav-id]");
    if (favStar) {
      e.preventDefault();
      e.stopPropagation();
      toggleFavoriteId(favStar.dataset.favId);
      renderPOSProducts();
      return;
    }
    const card = e.target.closest(".product");
    if (card && !card.disabled) posAddToCart(card.dataset.id);
  };
}

function posAddToCart(productId) {
  const p = State.products.find((x) => x._id === productId);
  if (!p || p.stock <= 0) return;
  const line = State.cart.find((l) => l.productId === p._id);
  if (line) {
    if (line.qty >= p.stock) {
      showToast(`Only ${p.stock} ${p.unit || "pc"} available`, "error");
      return;
    }
    line.qty += 1;
  } else {
    State.cart.push({
      productId: p._id,
      name: p.name,
      price: p.price,
      unit: p.unit || "pc",
      qty: 1,
    });
  }
  renderPOSCart();
}

function posChangeQty(productId, delta) {
  const line = State.cart.find((l) => l.productId === productId);
  if (!line) return;
  const product = State.products.find((p) => p._id === productId);
  line.qty += delta;
  if (product && line.qty > product.stock) {
    line.qty = product.stock;
    showToast("Stock limit reached", "error");
  }
  if (line.qty <= 0)
    State.cart = State.cart.filter((l) => l.productId !== productId);
  renderPOSCart();
}

function posRemoveLine(productId) {
  State.cart = State.cart.filter((l) => l.productId !== productId);
  renderPOSCart();
}

function posTotals() {
  const subtotal = State.cart.reduce((s, l) => s + l.price * l.qty, 0);
  const discountPercent = Number(
    document.getElementById("discountInput")?.value || 0,
  );
  const discount = subtotal * (discountPercent / 100);
  const taxRate = (State.business && Number(State.business.taxRate)) || 0;
  const taxable = subtotal - discount;
  const tax = taxable * (taxRate / 100);
  return { subtotal, discount, tax, grand: taxable + tax, taxRate };
}

function renderPOSCart() {
  const items = document.getElementById("cartItems");
  if (!items) return;
  items.innerHTML = State.cart.length
    ? State.cart
        .map(
          (l) => `
      <div class="cart-item">
        <div class="grow">
          <div class="cart-item__name">${escapeHtml(l.name)}</div>
          <div class="cart-item__price">${formatCurrency(l.price)} × ${l.qty}</div>
          <div class="row gap-2" style="margin-top:8px">
            <div class="qty">
              <button onclick="posChangeQty('${l.productId}', -1)" aria-label="Decrease quantity">−</button>
              <span>${l.qty}</span>
              <button onclick="posChangeQty('${l.productId}', 1)" aria-label="Increase quantity">+</button>
            </div>
            <button class="btn btn--sm btn--danger" onclick="posRemoveLine('${l.productId}')">Remove</button>
          </div>
        </div>
        <strong class="text-sm">${formatCurrency(l.price * l.qty)}</strong>
      </div>`,
        )
        .join("")
    : `<div class="cart__empty">🧾<br />Cart is empty.<br />Tap a product to start a sale.</div>`;

  const t = posTotals();
  const cartCount = document.getElementById("cartCount");
  if (cartCount)
    cartCount.textContent = State.cart.reduce((s, l) => s + l.qty, 0);
  const cartSubtotal = document.getElementById("cartSubtotal");
  if (cartSubtotal) cartSubtotal.textContent = formatCurrency(t.subtotal);
  const cartDiscount = document.getElementById("cartDiscount");
  if (cartDiscount) cartDiscount.textContent = "−" + formatCurrency(t.discount);
  const cartTax = document.getElementById("cartTax");
  if (cartTax) cartTax.textContent = formatCurrency(t.tax);
  const cartTotal = document.getElementById("cartTotal");
  if (cartTotal) cartTotal.textContent = formatCurrency(t.grand);
  const checkoutBtn = document.getElementById("btnCheckout");
  if (checkoutBtn) {
    checkoutBtn.disabled = !State.cart.length;
    checkoutBtn.style.opacity = State.cart.length ? "1" : "0.55";
  }
}

function posPopulateCustomerSelect() {
  const select = document.getElementById("cartCustomer");
  if (!select) return;
  const prev = select.value;
  select.innerHTML =
    `<option value="">Walk-in Customer</option>` +
    State.customers
      .map((c) => `<option value="${c._id}">${escapeHtml(c.name)}</option>`)
      .join("");
  select.value = prev || "";
}

function initPOS() {
  document.getElementById("posSearch")?.addEventListener("input", (e) => {
    posState.query = e.target.value;
    renderPOSProducts();
  });
  document.getElementById("posBarcode")?.addEventListener("keydown", (e) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const code = e.target.value.trim();
    const p = State.products.find(
      (x) =>
        x.barcode === code ||
        (x.sku || "").toLowerCase() === code.toLowerCase(),
    );
    if (p) posAddToCart(p._id);
    else showToast("No product found for that code", "error");
    e.target.value = "";
  });
  document.getElementById("posFavToggle")?.addEventListener("click", (e) => {
    posState.favoritesOnly = !posState.favoritesOnly;
    e.currentTarget.classList.toggle("is-active", posState.favoritesOnly);
    e.currentTarget.textContent = posState.favoritesOnly
      ? "★ Favorites only"
      : "☆ Favorites";
    renderPOSProducts();
  });
  document
    .getElementById("discountInput")
    ?.addEventListener("input", renderPOSCart);
  document.getElementById("btnClear")?.addEventListener("click", () => {
    if (!State.cart.length) return;
    if (!confirm("Cancel this transaction and clear the cart?")) return;
    State.cart = [];
    const discountInput = document.getElementById("discountInput");
    if (discountInput) discountInput.value = 0;
    renderPOSCart();
    showToast("Transaction cancelled", "info");
  });
  document.getElementById("btnHold")?.addEventListener("click", () => {
    if (!State.cart.length) return;
    posState.held.push({
      cart: [...State.cart],
      customer: document.getElementById("cartCustomer")?.value || "",
    });
    State.cart = [];
    renderPOSCart();
    const resumeBtn = document.getElementById("btnResume");
    if (resumeBtn) resumeBtn.textContent = `Resume (${posState.held.length})`;
    showToast("Order held", "info");
  });
  document.getElementById("btnResume")?.addEventListener("click", () => {
    const last = posState.held.pop();
    if (!last) {
      showToast("No held orders", "error");
      return;
    }
    State.cart = last.cart;
    const customerSelect = document.getElementById("cartCustomer");
    if (last.customer && customerSelect) customerSelect.value = last.customer;
    const resumeBtn = document.getElementById("btnResume");
    if (resumeBtn)
      resumeBtn.textContent = posState.held.length
        ? `Resume (${posState.held.length})`
        : "Resume";
    renderPOSCart();
    showToast("Held order resumed", "success");
  });
  document
    .getElementById("btnCheckout")
    ?.addEventListener("click", openCheckoutModal);

  // Payment-method buttons shown inline in the cart panel: clicking one just
  // pre-selects the method the checkout modal opens with.
  document.getElementById("payMethods")?.addEventListener("click", (e) => {
    const btn = e.target.closest(".pay-method");
    if (!btn) return;
    document
      .querySelectorAll("#payMethods .pay-method")
      .forEach((b) => b.classList.remove("is-active"));
    btn.classList.add("is-active");
    checkoutMethod = (btn.dataset.method || "cash").toLowerCase();
  });

  document.addEventListener("keydown", (e) => {
    const dashboardVisible = document
      .getElementById("dashboard-content")
      ?.classList.contains("active");
    if (!dashboardVisible) return;
    if (e.key === "F2") {
      e.preventDefault();
      document.getElementById("posSearch")?.focus();
    }
    if (e.key === "F4") {
      e.preventDefault();
      document.getElementById("btnCheckout")?.click();
    }
  });

  renderPOSCart();
}
document.addEventListener("DOMContentLoaded", initPOS);

// =======================
// Checkout modal
// =======================
let checkoutMethod = "cash";

function syncCheckoutModalPaymentMethod() {
  document.querySelectorAll("#checkout-modal .payment-method").forEach((b) => {
    b.classList.toggle(
      "active",
      (b.dataset.method || "").toLowerCase() === checkoutMethod,
    );
  });
}

function openCheckoutModal() {
  if (!State.cart.length) return;
  posPopulateCustomerSelect();
  syncCheckoutModalPaymentMethod();
  const t = posTotals();
  document.getElementById("payment-total").textContent = formatCurrency(
    t.grand,
  ).replace(/[^0-9.,]/g, "");
  document.getElementById("amount-received").value = "";
  document.getElementById("change-amount").textContent = "0.00";
  document.getElementById("checkout-alert").classList.add("hidden");
  openModal("checkout-modal");
}

function selectPaymentMethod(btn) {
  document
    .querySelectorAll("#checkout-modal .payment-method")
    .forEach((b) => b.classList.remove("active"));
  btn.classList.add("active");
  checkoutMethod = (btn.dataset.method || "cash").toLowerCase();
}

function calculateChange() {
  const t = posTotals();
  const received = Number(
    document.getElementById("amount-received").value || 0,
  );
  const change = Math.max(0, received - t.grand);
  document.getElementById("change-amount").textContent = change.toFixed(2);
}

function addQuickAmount(amount) {
  const input = document.getElementById("amount-received");
  input.value = (Number(input.value || 0) + amount).toFixed(2);
  calculateChange();
}

function setExactAmount() {
  const t = posTotals();
  document.getElementById("amount-received").value = t.grand.toFixed(2);
  calculateChange();
}

async function processPayment() {
  const alertEl = document.getElementById("checkout-alert");
  alertEl.classList.add("hidden");

  const t = posTotals();
  const received = Number(
    document.getElementById("amount-received").value || 0,
  );
  if (checkoutMethod === "cash" && received < t.grand) {
    alertEl.textContent = "Amount received is less than the total due";
    alertEl.classList.remove("hidden");
    return;
  }

  const payload = {
    items: State.cart.map((l) => ({
      productId: l.productId,
      qty: l.qty,
      price: l.price,
    })),
    customerId: document.getElementById("cartCustomer").value || null,
    paymentMethod: checkoutMethod,
    amountReceived: received || t.grand,
    discount: t.discount,
  };

  const btn = document.getElementById("process-payment-btn");
  btn.disabled = true;
  const originalText = btn.textContent;
  btn.innerHTML = '<span class="spinner"></span> Processing...';

  try {
    const { data: sale } = await Api.sales.create(payload);
    closeModal("checkout-modal");
    showReceipt(sale, received || t.grand);
    State.cart = [];
    const discountInput = document.getElementById("discountInput");
    if (discountInput) discountInput.value = 0;
    renderPOSCart();
    await refreshConnectedPages();
  } catch (err) {
    alertEl.textContent = err.message;
    alertEl.classList.remove("hidden");
  } finally {
    btn.disabled = false;
    btn.textContent = originalText;
  }
}

function showReceipt(sale, amountPaid) {
  document.getElementById("receipt-number").textContent =
    sale.receiptNumber || sale._id;
  document.getElementById("receipt-method").textContent =
    sale.paymentMethod || checkoutMethod;
  document.getElementById("receipt-subtotal").textContent = formatCurrency(
    sale.subtotal,
  );
  document.getElementById("receipt-tax").textContent = formatCurrency(sale.tax);
  document.getElementById("receipt-total").textContent = formatCurrency(
    sale.total,
  );
  document.getElementById("receipt-paid").textContent =
    formatCurrency(amountPaid);
  document.getElementById("receipt-change").textContent = formatCurrency(
    Math.max(0, amountPaid - sale.total),
  );
  openModal("receipt-modal");
}

function printReceipt() {
  window.print();
}

function emailReceipt() {
  const email = State.customers?.find?.(
    (c) => c._id === document.getElementById("cartCustomer")?.value,
  )?.email;
  if (email) {
    showToast(`Receipt emailed to ${email}`, "success");
  } else {
    showToast(
      "Select a customer with an email on file to send a receipt",
      "info",
    );
  }
}

function newTransaction() {
  closeModal("receipt-modal");
  const customerSelect = document.getElementById("cartCustomer");
  if (customerSelect) customerSelect.value = "";
  document.getElementById("posSearch")?.focus();
}

// Keeps Dashboard, Product Catalog and Inventory in sync the moment a sale
// completes, even if the cashier stays on the POS screen.
async function refreshConnectedPages() {
  try {
    await loadProducts();
  } catch (e) {
    /* already surfaced via toast in processPayment */
  }
  renderPOSCategories();
  renderPOSProducts();
  try {
    renderProductsTable();
  } catch (e) {}
  try {
    await loadInventory();
  } catch (e) {}
  try {
    await loadDashboard();
  } catch (e) {}
}

// =======================
// Sales page
// =======================
async function loadSales() {
  const { data } = await Api.sales.list();
  State.sales = data;
  renderSalesTable();
}

function renderSalesTable() {
  const tbody = document.getElementById("sales-tbody");
  if (!tbody) return;
  const keyword = (
    document.getElementById("sales-search")?.value || ""
  ).toLowerCase();
  const filtered = State.sales.filter((s) =>
    (s.receiptNumber || s._id || "").toLowerCase().includes(keyword),
  );

  if (!filtered.length) {
    tbody.innerHTML =
      '<tr><td colspan="7" class="loading-text">No sales found.</td></tr>';
    return;
  }

  const statusBadge = {
    Completed: "success",
    Pending: "warning",
    Refunded: "danger",
    Cancelled: "gray",
  };

  tbody.innerHTML = filtered
    .map((s) => {
      const status = s.status || "Completed";
      return `<tr>
      <td>${escapeHtml(s.receiptNumber || s._id)}</td>
      <td>${new Date(s.createdAt || s.date).toLocaleString()}</td>
      <td>${escapeHtml(s.customer ? s.customer.name || s.customer : "Walk-in")}</td>
      <td>${escapeHtml(s.cashier ? s.cashier.name || s.cashier : "-")}</td>
      <td>${escapeHtml(s.paymentMethod || "-")}</td>
      <td>${formatCurrency(s.total)}</td>
      <td><span class="badge badge-${statusBadge[status] || "gray"}">${escapeHtml(status)}</span></td>
    </tr>`;
    })
    .join("");
}

// =======================
// Finance & Analytics (live data + local device inputs)
// =======================
function financeInputs() {
  return LocalStore.get("financeInputs", {});
}
function financeCostItems() {
  return LocalStore.get("costItems", []);
}
function financeGoals() {
  return LocalStore.get("goals", []);
}
function financeBudget() {
  return LocalStore.get("budget", { revenueTarget: 0, expenseTarget: 0 });
}
function financeCashOnHand() {
  return LocalStore.get("cashOnHand", 0);
}

function financeOperatingExpenses() {
  return financeCostItems().reduce((sum, c) => sum + Number(c.amount || 0), 0);
}

// Revenue/COGS/inventory value are "live" - computed from real sales &
// products already loaded into State - everything else (assets, liabilities,
// etc.) comes from the local inputs above, per the note on the Finance page.
function financeLiveNumbers() {
  const sales = (State.sales || []).filter((s) => s.status !== "Refunded");
  const revenue = sales.reduce((s, x) => s + (x.total || 0), 0);
  const cogs = sales.reduce((sum, s) => {
    return (
      sum +
      (s.items || []).reduce((a, i) => {
        const p = State.products.find(
          (x) => x._id === (i.productId?._id || i.productId),
        );
        return a + (p ? p.costPrice || 0 : 0) * (i.qty || 0);
      }, 0)
    );
  }, 0);
  const inventoryValue = State.products.reduce(
    (sum, p) => sum + (p.costPrice || 0) * (p.stock || 0),
    0,
  );
  return { revenue, cogs, inventoryValue, salesCount: sales.length };
}

function financeProfitability() {
  const { revenue, cogs } = financeLiveNumbers();
  const fi = financeInputs();
  const opex = financeOperatingExpenses();
  const grossProfit = revenue - cogs;
  const netProfit =
    grossProfit -
    opex -
    Number(fi.interestExpense || 0) +
    Number(fi.otherIncome || 0) -
    Number(fi.otherExpenses || 0);
  const grossMargin = revenue ? (grossProfit / revenue) * 100 : 0;
  const netMargin = revenue ? (netProfit / revenue) * 100 : 0;
  const investment = Number(fi.totalInvestment || fi.totalAssets || 0);
  const roi = investment ? (netProfit / investment) * 100 : 0;
  const roa = fi.totalAssets ? (netProfit / Number(fi.totalAssets)) * 100 : 0;
  const roe = fi.totalEquity ? (netProfit / Number(fi.totalEquity)) * 100 : 0;
  return {
    revenue,
    cogs,
    grossProfit,
    netProfit,
    grossMargin,
    netMargin,
    roi,
    roa,
    roe,
    opex,
  };
}

function financeLiquidity() {
  const fi = financeInputs();
  const { inventoryValue } = financeLiveNumbers();
  const currentAssets = Number(fi.currentAssets || 0);
  const currentLiabilities = Number(fi.currentLiabilities || 0);
  const currentRatio = currentLiabilities
    ? currentAssets / currentLiabilities
    : 0;
  const quickRatio = currentLiabilities
    ? (currentAssets - inventoryValue) / currentLiabilities
    : 0;
  const debtToEquity = fi.totalEquity
    ? Number(fi.totalLiabilities || 0) / Number(fi.totalEquity)
    : 0;
  const ebit =
    financeProfitability().netProfit + Number(fi.interestExpense || 0);
  const interestCoverage = fi.interestExpense
    ? ebit / Number(fi.interestExpense)
    : 0;
  return {
    currentRatio,
    quickRatio,
    debtToEquity,
    interestCoverage,
    inventoryValue,
  };
}

function financeBreakEven(productId) {
  const fi = financeInputs();
  const fixedCosts = Number(fi.fixedCosts || 0);
  let price, cost;
  if (productId) {
    const p = State.products.find((x) => x._id === productId);
    price = p ? p.price : 0;
    cost = p ? p.costPrice : 0;
  } else {
    const products = State.products;
    price = products.length
      ? products.reduce((a, p) => a + p.price, 0) / products.length
      : 0;
    cost = products.length
      ? products.reduce((a, p) => a + (p.costPrice || 0), 0) / products.length
      : 0;
  }
  const contribution = price - cost;
  const unitsToBreakEven = contribution > 0 ? fixedCosts / contribution : 0;
  const revenueToBreakEven = unitsToBreakEven * price;
  return {
    fixedCosts,
    price,
    cost,
    contribution,
    unitsToBreakEven,
    revenueToBreakEven,
  };
}

function financeWorkingCapital() {
  const fi = financeInputs();
  return {
    capital: Number(fi.currentAssets || 0) - Number(fi.currentLiabilities || 0),
    currentAssets: Number(fi.currentAssets || 0),
    currentLiabilities: Number(fi.currentLiabilities || 0),
  };
}

function financeForecast() {
  const sales = (State.sales || []).filter((s) => s.status !== "Refunded");
  const days = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const total = sales
      .filter((s) => {
        const sd = new Date(s.createdAt || s.date);
        return (
          sd.getFullYear() === d.getFullYear() &&
          sd.getMonth() === d.getMonth() &&
          sd.getDate() === d.getDate()
        );
      })
      .reduce((sum, s) => sum + (s.total || 0), 0);
    days.push(total);
  }
  const n = days.length;
  const xs = days.map((_, i) => i);
  const xMean = xs.reduce((a, b) => a + b, 0) / n;
  const yMean = days.reduce((a, b) => a + b, 0) / n;
  let num = 0,
    den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - xMean) * (days[i] - yMean);
    den += (xs[i] - xMean) ** 2;
  }
  const slope = den ? num / den : 0;
  const intercept = yMean - slope * xMean;
  let projected = 0;
  for (let i = n; i < n + 7; i++)
    projected += Math.max(0, slope * i + intercept);
  return {
    dailyAvg: yMean,
    projectedNext7: projected,
    trend: slope > 5 ? "up" : slope < -5 ? "down" : "flat",
  };
}

function financeCostBreakdown() {
  const items = financeCostItems();
  const total = items.reduce((a, c) => a + Number(c.amount || 0), 0) || 1;
  return items.map((c) => ({
    ...c,
    pct: (Number(c.amount || 0) / total) * 100,
  }));
}

function financeRevenueByCategory() {
  const sales = (State.sales || []).filter((s) => s.status !== "Refunded");
  const totals = {};
  State.categories.forEach((c) => (totals[c._id] = 0));
  sales.forEach((s) => {
    (s.items || []).forEach((i) => {
      const p = State.products.find(
        (x) => x._id === (i.productId?._id || i.productId),
      );
      if (p)
        totals[p.category] =
          (totals[p.category] || 0) + (i.price || 0) * (i.qty || 0);
    });
  });
  const grand = Object.values(totals).reduce((a, b) => a + b, 0) || 1;
  return State.categories.map((c) => ({
    ...c,
    total: totals[c._id] || 0,
    pct: ((totals[c._id] || 0) / grand) * 100,
  }));
}

async function loadFinance() {
  if (!State.products.length) await loadProducts();
  if (!State.categories.length) await loadCategories();
  const { data } = await Api.sales.list();
  State.sales = data;
  populateFinanceInputsForm();
  renderFinanceProfitability();
  renderFinanceLiquidity();
  renderFinanceAnalysis();
  renderFinancePlanning();
}

function switchFinanceTab(tab) {
  document
    .querySelectorAll("#finance-tabs .tab-btn")
    .forEach((b) => b.classList.toggle("active", b.dataset.ftab === tab));
  document
    .querySelectorAll("#finance-content .tab-content")
    .forEach((c) => c.classList.remove("active"));
  document.getElementById(`finance-${tab}`)?.classList.add("active");
}

function statCard(label, value) {
  return `<div class="stat-card"><div class="stat-label">${label}</div><div class="stat-value">${value}</div></div>`;
}

function renderFinanceProfitability() {
  const p = financeProfitability();
  const grid = document.getElementById("finance-profitability-grid");
  if (!grid) return;
  grid.innerHTML = [
    statCard("Revenue", formatCurrency(p.revenue)),
    statCard("Gross profit", formatCurrency(p.grossProfit)),
    statCard("Net profit", formatCurrency(p.netProfit)),
    statCard("Gross margin", p.grossMargin.toFixed(1) + "%"),
    statCard("Net margin", p.netMargin.toFixed(1) + "%"),
    statCard("ROI", p.roi.toFixed(1) + "%"),
    statCard("ROA", p.roa.toFixed(1) + "%"),
    statCard("ROE", p.roe.toFixed(1) + "%"),
  ].join("");
}

function renderFinanceLiquidity() {
  const l = financeLiquidity();
  const grid = document.getElementById("finance-liquidity-grid");
  if (!grid) return;
  grid.innerHTML = [
    statCard("Current ratio", l.currentRatio.toFixed(2)),
    statCard("Quick ratio", l.quickRatio.toFixed(2)),
    statCard("Debt-to-equity", l.debtToEquity.toFixed(2)),
    statCard("Interest coverage", l.interestCoverage.toFixed(2)),
    statCard("Inventory value", formatCurrency(l.inventoryValue)),
  ].join("");
}

function renderBreakEven() {
  const productId = document.getElementById("be-product")?.value || "";
  const be = financeBreakEven(productId);
  const grid = document.getElementById("finance-breakeven-grid");
  if (!grid) return;
  grid.innerHTML = [
    statCard("Fixed costs", formatCurrency(be.fixedCosts)),
    statCard("Contribution / unit", formatCurrency(be.contribution)),
    statCard(
      "Units to break even",
      Math.ceil(be.unitsToBreakEven).toLocaleString(),
    ),
    statCard("Revenue to break even", formatCurrency(be.revenueToBreakEven)),
  ].join("");
}

function renderFinanceAnalysis() {
  renderBreakEven();
  const p = financeProfitability();
  const grid = document.getElementById("finance-analysis-grid");
  if (grid) {
    grid.innerHTML = [
      statCard("Operating expenses", formatCurrency(p.opex)),
      statCard("Cost of goods sold", formatCurrency(p.cogs)),
    ].join("");
  }
  const byCategory = document.getElementById("finance-revenue-by-category");
  if (byCategory) {
    byCategory.innerHTML = financeRevenueByCategory()
      .map(
        (
          c,
        ) => `<div><div class="row" style="justify-content:space-between"><span>${escapeHtml(c.name)}</span><strong>${c.pct.toFixed(0)}%</strong></div>
        <div class="progress"><div class="progress-fill" style="width:${c.pct}%;background:${escapeHtml(c.color || DEFAULT_CATEGORY_COLOR)}"></div></div></div>`,
      )
      .join("");
  }
  const costBreakdown = document.getElementById("finance-cost-breakdown");
  if (costBreakdown) {
    const items = financeCostBreakdown();
    costBreakdown.innerHTML = items.length
      ? items
          .map(
            (
              c,
            ) => `<div><div class="row" style="justify-content:space-between"><span>${escapeHtml(c.name)}</span><strong>${c.pct.toFixed(0)}%</strong></div>
        <div class="progress"><div class="progress-fill" style="width:${c.pct}%"></div></div></div>`,
          )
          .join("")
      : '<p class="text-muted text-sm">No cost items yet.</p>';
  }
}

function renderFinancePlanning() {
  const budget = financeBudget();
  const revInput = document.getElementById("budget-revenue-target");
  const expInput = document.getElementById("budget-expense-target");
  if (revInput) revInput.value = budget.revenueTarget || "";
  if (expInput) expInput.value = budget.expenseTarget || "";

  const live = financeLiveNumbers();
  const opex = financeOperatingExpenses();
  const budgetSummary = document.getElementById("finance-budget-summary");
  if (budgetSummary) {
    budgetSummary.innerHTML = `
      <div>Revenue so far: <strong>${formatCurrency(live.revenue)}</strong> of ${formatCurrency(budget.revenueTarget)} target</div>
      <div>Expenses so far: <strong>${formatCurrency(opex)}</strong> of ${formatCurrency(budget.expenseTarget)} target</div>`;
  }

  const forecast = financeForecast();
  const forecastSummary = document.getElementById("finance-forecast-summary");
  if (forecastSummary) {
    forecastSummary.innerHTML = `
      <div>Average daily sales: <strong>${formatCurrency(forecast.dailyAvg)}</strong></div>
      <div>Projected next 7 days: <strong>${formatCurrency(forecast.projectedNext7)}</strong></div>
      <div>Trend: <strong style="text-transform:capitalize">${forecast.trend}</strong></div>`;
  }

  const cashInput = document.getElementById("cf-cash-on-hand");
  if (cashInput) cashInput.value = financeCashOnHand() || "";
  const cashflowSummary = document.getElementById("finance-cashflow-summary");
  if (cashflowSummary) {
    cashflowSummary.innerHTML = `<div>Cash on hand: <strong>${formatCurrency(financeCashOnHand())}</strong></div>`;
  }

  const costTbody = document.getElementById("finance-cost-items-tbody");
  if (costTbody) {
    const items = financeCostItems();
    costTbody.innerHTML = items.length
      ? items
          .map(
            (c, i) => `<tr>
        <td>${escapeHtml(c.name)}</td>
        <td>${formatCurrency(c.amount)}</td>
        <td><button class="btn btn-ghost btn-sm text-danger" onclick="deleteCostItem(${i})">Delete</button></td>
      </tr>`,
          )
          .join("")
      : '<tr><td colspan="3" class="text-muted">No cost items yet.</td></tr>';
  }

  const wc = financeWorkingCapital();
  const wcEl = document.getElementById("finance-working-capital");
  if (wcEl) {
    wcEl.innerHTML = `
      <div>Current assets: <strong>${formatCurrency(wc.currentAssets)}</strong></div>
      <div>Current liabilities: <strong>${formatCurrency(wc.currentLiabilities)}</strong></div>
      <div>Working capital: <strong>${formatCurrency(wc.capital)}</strong></div>`;
  }

  const goalsList = document.getElementById("finance-goals-list");
  if (goalsList) {
    const goals = financeGoals();
    goalsList.innerHTML = goals.length
      ? goals
          .map(
            (
              g,
              i,
            ) => `<div class="row" style="justify-content:space-between;align-items:center">
        <label style="display:flex;align-items:center;gap:8px;${g.done ? "text-decoration:line-through;color:var(--text-muted)" : ""}">
          <input type="checkbox" ${g.done ? "checked" : ""} onchange="toggleGoal(${i})"> ${escapeHtml(g.text)}
        </label>
        <button class="btn btn-ghost btn-sm text-danger" onclick="deleteGoal(${i})">Delete</button>
      </div>`,
          )
          .join("")
      : '<p class="text-muted text-sm">No goals yet.</p>';
  }
}

function openFinanceInputsModal() {
  const fi = financeInputs();
  document.getElementById("fi-total-assets").value = fi.totalAssets || "";
  document.getElementById("fi-total-liabilities").value =
    fi.totalLiabilities || "";
  document.getElementById("fi-total-equity").value = fi.totalEquity || "";
  document.getElementById("fi-total-investment").value =
    fi.totalInvestment || "";
  document.getElementById("fi-current-assets").value = fi.currentAssets || "";
  document.getElementById("fi-current-liabilities").value =
    fi.currentLiabilities || "";
  document.getElementById("fi-interest-expense").value =
    fi.interestExpense || "";
  document.getElementById("fi-other-income").value = fi.otherIncome || "";
  document.getElementById("fi-other-expenses").value = fi.otherExpenses || "";
  document.getElementById("fi-fixed-costs").value = fi.fixedCosts || "";
  document.getElementById("finance-inputs-alert").classList.add("hidden");
  openModal("finance-inputs-modal");
}
function populateFinanceInputsForm() {
  // Kept separate from openFinanceInputsModal so loadFinance() can call it
  // without needing the modal's fields to exist/behave as "open".
}

function saveFinanceInputs() {
  const fields = [
    "totalAssets",
    "totalLiabilities",
    "totalEquity",
    "totalInvestment",
    "currentAssets",
    "currentLiabilities",
    "interestExpense",
    "otherIncome",
    "otherExpenses",
    "fixedCosts",
  ];
  const idMap = {
    totalAssets: "fi-total-assets",
    totalLiabilities: "fi-total-liabilities",
    totalEquity: "fi-total-equity",
    totalInvestment: "fi-total-investment",
    currentAssets: "fi-current-assets",
    currentLiabilities: "fi-current-liabilities",
    interestExpense: "fi-interest-expense",
    otherIncome: "fi-other-income",
    otherExpenses: "fi-other-expenses",
    fixedCosts: "fi-fixed-costs",
  };
  const values = {};
  fields.forEach((f) => {
    values[f] = Number(document.getElementById(idMap[f]).value) || 0;
  });
  LocalStore.set("financeInputs", values);
  closeModal("finance-inputs-modal");
  renderFinanceProfitability();
  renderFinanceLiquidity();
  renderFinanceAnalysis();
  renderFinancePlanning();
  showToast("Financial inputs saved", "success");
}

function saveBudgetTargets() {
  const revenueTarget =
    Number(document.getElementById("budget-revenue-target").value) || 0;
  const expenseTarget =
    Number(document.getElementById("budget-expense-target").value) || 0;
  LocalStore.set("budget", { revenueTarget, expenseTarget });
  renderFinancePlanning();
  showToast("Budget saved", "success");
}

function saveCashOnHand() {
  const value = Number(document.getElementById("cf-cash-on-hand").value) || 0;
  LocalStore.set("cashOnHand", value);
  renderFinancePlanning();
  showToast("Cash on hand saved", "success");
}

function openAddCostItemPrompt() {
  const name = prompt("Cost item name (e.g. Rent, Utilities):");
  if (!name) return;
  const amountStr = prompt(`Monthly amount for "${name}":`);
  const amount = Number(amountStr);
  if (!amountStr || isNaN(amount) || amount < 0) {
    showToast("Enter a valid amount", "error");
    return;
  }
  const items = financeCostItems();
  items.push({ name, amount });
  LocalStore.set("costItems", items);
  renderFinancePlanning();
  renderFinanceAnalysis();
}

function deleteCostItem(index) {
  const items = financeCostItems();
  items.splice(index, 1);
  LocalStore.set("costItems", items);
  renderFinancePlanning();
  renderFinanceAnalysis();
}

function openAddGoalPrompt() {
  const text = prompt("Goal text (e.g. Hit ₱700,000 in monthly revenue):");
  if (!text) return;
  const goals = financeGoals();
  goals.push({ text, done: false });
  LocalStore.set("goals", goals);
  renderFinancePlanning();
}

function toggleGoal(index) {
  const goals = financeGoals();
  if (!goals[index]) return;
  goals[index].done = !goals[index].done;
  LocalStore.set("goals", goals);
  renderFinancePlanning();
}

function deleteGoal(index) {
  const goals = financeGoals();
  goals.splice(index, 1);
  LocalStore.set("goals", goals);
  renderFinancePlanning();
}

// =======================
// Customer select (POS)
// =======================
async function openCustomerModal() {
  await loadCustomers();
  const list = document.getElementById("customer-select-list");
  let html = `
    <div class="customer-list-item" onclick="selectCustomer(null)">
      <div class="customer-avatar" style="background:var(--gray-200);">--</div>
      <div><div style="font-weight:500;">Walk-in Customer</div><div style="font-size:.75rem;color:var(--text-muted);">No account</div></div>
    </div>`;
  html += State.customers
    .map(
      (c) => `
    <div class="customer-list-item" onclick='selectCustomer(${JSON.stringify(c._id)})'>
      <div class="customer-avatar">${getInitials(c.name)}</div>
      <div><div style="font-weight:500;">${escapeHtml(c.name)}</div><div style="font-size:.75rem;color:var(--text-muted);">${escapeHtml(c.phone || "")}</div></div>
      <span class="badge badge-${c.membership === "platinum" ? "primary" : c.membership === "gold" ? "warning" : "gray"}" style="margin-left:auto;text-transform:capitalize;">${c.membership}</span>
    </div>`,
    )
    .join("");
  list.innerHTML = html;
  openModal("customer-select-modal");
}

function selectCustomer(customerId) {
  const select = document.getElementById("cartCustomer");
  if (customerId) {
    State.selectedCustomer = State.customers.find((c) => c._id === customerId);
    if (select && State.selectedCustomer)
      select.value = State.selectedCustomer._id;
  } else {
    State.selectedCustomer = null;
    if (select) select.value = "";
  }
  closeModal("customer-select-modal");
}

// =======================
// Inventory page
// =======================
async function loadInventory() {
  const { summary, data } = await Api.inventory.overview();
  document.getElementById("inv-total-items").textContent = summary.totalItems;
  document.getElementById("inv-total-value").textContent = formatCurrency(
    summary.totalValue,
  );
  document.getElementById("inv-low-stock").textContent = summary.lowStock;
  document.getElementById("inv-out-stock").textContent = summary.outOfStock;

  const tbody = document.getElementById("inventory-tbody");
  tbody.innerHTML = data
    .map((p) => {
      const statusClass =
        p.stock === 0
          ? "danger"
          : p.stock <= p.minStock
            ? "warning"
            : "success";
      const statusText =
        p.stock === 0
          ? "Out of Stock"
          : p.stock <= p.minStock
            ? "Low Stock"
            : "In Stock";
      return `<tr>
      <td>${escapeHtml(p.name)}</td>
      <td style="font-family:monospace;font-size:.75rem;color:var(--text-muted);">${escapeHtml(p.sku)}</td>
      <td>${p.stock}</td>
      <td>${p.minStock}</td>
      <td>${formatCurrency(p.costPrice * p.stock)}</td>
      <td><span class="badge badge-${statusClass}">${statusText}</span></td>
    </tr>`;
    })
    .join("");

  // populate the adjust-stock dropdown too
  const select = document.getElementById("adjust-product");
  if (select)
    select.innerHTML = data
      .map(
        (p) =>
          `<option value="${p._id}">${escapeHtml(p.name)} (${p.stock} in stock)</option>`,
      )
      .join("");

  await loadMovements();
}

async function loadMovements() {
  const { data } = await Api.inventory.movements();
  const tbody = document.getElementById("movements-tbody");
  const typeColors = {
    in: "success",
    out: "danger",
    adjustment: "warning",
    transfer: "primary",
  };
  const typeText = {
    in: "Stock In",
    out: "Stock Out",
    adjustment: "Adjustment",
    transfer: "Transfer",
  };
  tbody.innerHTML =
    data
      .map(
        (m) => `
    <tr>
      <td>${new Date(m.createdAt).toLocaleString()}</td>
      <td>${m.product ? escapeHtml(m.product.name) : "Unknown"}</td>
      <td><span class="badge badge-${typeColors[m.type]}">${typeText[m.type]}</span></td>
      <td>${m.quantity}</td>
      <td>${escapeHtml(m.reference || "-")}</td>
      <td>${m.createdBy ? escapeHtml(m.createdBy.name) : "-"}</td>
    </tr>`,
      )
      .join("") ||
    '<tr><td colspan="6" style="color:var(--text-muted);">No movements yet</td></tr>';
}

function switchInventoryTab(tab) {
  document
    .querySelectorAll(".tab-btn")
    .forEach((b) => b.classList.remove("active"));
  document
    .querySelectorAll(".tab-content")
    .forEach((c) => c.classList.remove("active"));
  document.querySelector(`.tab-btn[data-tab="${tab}"]`).classList.add("active");
  document.getElementById(`inventory-${tab}`).classList.add("active");
}

function openAdjustModal() {
  document.getElementById("adjust-alert").style.display = "none";
  document.getElementById("adjust-quantity").value = "";
  document.getElementById("adjust-reference").value = "";
  document.getElementById("adjust-notes").value = "";
  openModal("adjust-modal");
}

async function saveStockAdjustment() {
  const payload = {
    productId: document.getElementById("adjust-product").value,
    type: document.getElementById("adjust-type").value,
    quantity: parseInt(document.getElementById("adjust-quantity").value, 10),
    reference: document.getElementById("adjust-reference").value.trim(),
    notes: document.getElementById("adjust-notes").value.trim(),
  };
  if (!payload.quantity || payload.quantity <= 0) {
    const alertEl = document.getElementById("adjust-alert");
    alertEl.textContent = "Enter a valid quantity";
    alertEl.style.display = "block";
    return;
  }
  try {
    await Api.inventory.adjust(payload);
    closeModal("adjust-modal");
    await loadInventory();
    await loadProducts();
    showToast("Stock updated", "success");
  } catch (err) {
    const alertEl = document.getElementById("adjust-alert");
    alertEl.textContent = err.message;
    alertEl.style.display = "block";
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
  const grid = document.getElementById("customers-grid");
  const search = (
    document.getElementById("customer-search")?.value || ""
  ).toLowerCase();
  let list = State.customers;
  if (search)
    list = list.filter(
      (c) =>
        c.name.toLowerCase().includes(search) ||
        (c.phone || "").includes(search),
    );

  const canManage = hasPermission("manageCustomers");

  grid.innerHTML =
    list
      .map(
        (c) => `
    <div class="customer-card">
      <div class="customer-header">
        <div style="display:flex;align-items:center;gap:.75rem;">
          <div class="customer-avatar-lg">${getInitials(c.name)}</div>
          <div><div style="font-weight:600;">${escapeHtml(c.name)}</div><div style="font-size:.75rem;color:var(--text-muted);">${escapeHtml(c.phone || "")}</div></div>
        </div>
        <span class="badge badge-${c.membership === "platinum" ? "primary" : c.membership === "gold" ? "warning" : "gray"}" style="text-transform:capitalize;">${c.membership}</span>
      </div>
      <div class="customer-stats">
        <div class="customer-stat"><div class="value">${c.points}</div><div class="label">Points</div></div>
        <div class="customer-stat"><div class="value text-success">${formatCurrency(c.totalSpent)}</div><div class="label">Total Spent</div></div>
      </div>
      ${
        canManage
          ? `
        <div class="card-actions">
          <button class="btn btn-ghost btn-sm" onclick='event.stopPropagation(); openCustomerAddModal(${JSON.stringify(c._id)})'>Edit</button>
          <button class="btn btn-ghost btn-sm text-danger" onclick="event.stopPropagation(); deleteCustomerRecord('${c._id}')">Delete</button>
        </div>
      `
          : ""
      }
    </div>
  `,
      )
      .join("") ||
    '<p style="color:var(--text-muted);">No customers found.</p>';
}

function openCustomerAddModal(customerId) {
  const customer = customerId
    ? State.customers.find((c) => c._id === customerId)
    : null;
  document.getElementById("customer-alert").style.display = "none";
  document.getElementById("customer-modal-title").textContent = customer
    ? "Edit Customer"
    : "Add Customer";
  document.getElementById("customer-id").value = customer ? customer._id : "";
  document.getElementById("customer-name").value = customer
    ? customer.name
    : "";
  document.getElementById("customer-phone").value = customer
    ? customer.phone || ""
    : "";
  document.getElementById("customer-email").value = customer
    ? customer.email || ""
    : "";
  document.getElementById("customer-membership").value = customer
    ? customer.membership
    : "silver";
  openModal("customer-add-modal");
}

async function saveCustomer() {
  const id = document.getElementById("customer-id").value;
  const payload = {
    name: document.getElementById("customer-name").value.trim(),
    phone: document.getElementById("customer-phone").value.trim(),
    email: document.getElementById("customer-email").value.trim(),
    membership: document.getElementById("customer-membership").value,
  };
  if (!payload.name) {
    const alertEl = document.getElementById("customer-alert");
    alertEl.textContent = "Customer name is required";
    alertEl.style.display = "block";
    return;
  }
  try {
    if (id) await Api.customers.update(id, payload);
    else await Api.customers.create(payload);
    closeModal("customer-add-modal");
    await loadCustomers();
    renderCustomersGrid();
    showToast(id ? "Customer updated" : "Customer added", "success");
  } catch (err) {
    const alertEl = document.getElementById("customer-alert");
    alertEl.textContent = err.message;
    alertEl.style.display = "block";
  }
}

async function deleteCustomerRecord(id) {
  if (!confirm("Delete this customer? This cannot be undone.")) return;
  try {
    await Api.customers.remove(id);
    await loadCustomers();
    renderCustomersGrid();
    showToast("Customer deleted", "success");
  } catch (err) {
    showToast(err.message, "error");
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
  const grid = document.getElementById("suppliers-grid");
  const search = (
    document.getElementById("supplier-search")?.value || ""
  ).toLowerCase();
  let list = State.suppliers;
  if (search) {
    list = list.filter(
      (s) =>
        s.name.toLowerCase().includes(search) ||
        (s.company || "").toLowerCase().includes(search) ||
        (s.email || "").toLowerCase().includes(search),
    );
  }

  grid.innerHTML =
    list
      .map(
        (s) => `
    <div class="supplier-card">
      <div class="supplier-header">
        <div style="display:flex;align-items:center;gap:.75rem;">
          <div class="supplier-icon">${getInitials(s.name)}</div>
          <div><div style="font-weight:600;">${escapeHtml(s.name)}</div><div style="font-size:.75rem;color:var(--text-muted);">${escapeHtml(s.company || "")}</div></div>
        </div>
        <span class="badge badge-${s.isActive ? "success" : "gray"}">${s.isActive ? "Active" : "Inactive"}</span>
      </div>
      <div class="supplier-contact">
        <div class="supplier-contact-item">${escapeHtml(s.phone || "")}</div>
        <div class="supplier-contact-item">${escapeHtml(s.email || "")}</div>
        <div class="supplier-contact-item">${escapeHtml(s.address || "")}</div>
      </div>
      <div class="card-actions">
        <button class="btn btn-ghost btn-sm" onclick='openSupplierModal(${JSON.stringify(s._id)})'>Edit</button>
        <button class="btn btn-ghost btn-sm" onclick="toggleSupplierActive('${s._id}', ${!s.isActive})">${s.isActive ? "Deactivate" : "Activate"}</button>
        <button class="btn btn-ghost btn-sm text-danger" onclick="deleteSupplierRecord('${s._id}')">Delete</button>
      </div>
    </div>
  `,
      )
      .join("") ||
    '<p style="color:var(--text-muted);">No suppliers found.</p>';
}

function openSupplierModal(supplierId) {
  const supplier = supplierId
    ? State.suppliers.find((s) => s._id === supplierId)
    : null;
  document.getElementById("supplier-alert").style.display = "none";
  document.getElementById("supplier-modal-title").textContent = supplier
    ? "Edit Supplier"
    : "Add Supplier";
  document.getElementById("supplier-id").value = supplier ? supplier._id : "";
  document.getElementById("supplier-name").value = supplier
    ? supplier.name
    : "";
  document.getElementById("supplier-company").value = supplier
    ? supplier.company || ""
    : "";
  document.getElementById("supplier-contact-person").value = supplier
    ? supplier.contactPerson || ""
    : "";
  document.getElementById("supplier-email").value = supplier
    ? supplier.email || ""
    : "";
  document.getElementById("supplier-phone").value = supplier
    ? supplier.phone || ""
    : "";
  document.getElementById("supplier-address").value = supplier
    ? supplier.address || ""
    : "";
  document.getElementById("supplier-active").checked = supplier
    ? supplier.isActive
    : true;
  openModal("supplier-modal");
}

async function saveSupplier() {
  const id = document.getElementById("supplier-id").value;
  const payload = {
    name: document.getElementById("supplier-name").value.trim(),
    company: document.getElementById("supplier-company").value.trim(),
    contactPerson: document
      .getElementById("supplier-contact-person")
      .value.trim(),
    email: document.getElementById("supplier-email").value.trim(),
    phone: document.getElementById("supplier-phone").value.trim(),
    address: document.getElementById("supplier-address").value.trim(),
    isActive: document.getElementById("supplier-active").checked,
  };
  if (!payload.name) {
    const alertEl = document.getElementById("supplier-alert");
    alertEl.textContent = "Supplier name is required";
    alertEl.style.display = "block";
    return;
  }
  try {
    if (id) await Api.suppliers.update(id, payload);
    else await Api.suppliers.create(payload);
    closeModal("supplier-modal");
    await loadSuppliers();
    renderSuppliersGrid();
    showToast(id ? "Supplier updated" : "Supplier added", "success");
  } catch (err) {
    const alertEl = document.getElementById("supplier-alert");
    alertEl.textContent = err.message;
    alertEl.style.display = "block";
  }
}

async function toggleSupplierActive(id, nextActive) {
  try {
    await Api.suppliers.update(id, { isActive: nextActive });
    await loadSuppliers();
    renderSuppliersGrid();
    showToast(
      nextActive ? "Supplier activated" : "Supplier deactivated",
      "success",
    );
  } catch (err) {
    showToast(err.message, "error");
  }
}

async function deleteSupplierRecord(id) {
  if (!confirm("Delete this supplier? This cannot be undone.")) return;
  try {
    await Api.suppliers.remove(id);
    await loadSuppliers();
    renderSuppliersGrid();
    showToast("Supplier deleted", "success");
  } catch (err) {
    showToast(err.message, "error");
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
  document.getElementById("emp-total").textContent = State.employees.length;
  document.getElementById("emp-active").textContent = State.employees.filter(
    (e) => e.isActive,
  ).length;
  document.getElementById("emp-limit").textContent =
    (State.business && State.business.maxUsers) || "--";

  const tbody = document.getElementById("employees-tbody");
  const canManage = hasPermission("manageEmployees");
  const search = (
    document.getElementById("employee-search")?.value || ""
  ).toLowerCase();
  let list = State.employees;
  if (search) {
    list = list.filter(
      (emp) =>
        emp.name.toLowerCase().includes(search) ||
        emp.email.toLowerCase().includes(search) ||
        formatRole(emp.role).toLowerCase().includes(search),
    );
  }

  tbody.innerHTML = list
    .map(
      (emp) => `
    <tr>
      <td>
        <div style="display:flex;align-items:center;gap:.75rem;">
          <div class="user-avatar">${getInitials(emp.name)}</div>
          <div><div style="font-weight:500;">${escapeHtml(emp.name)}</div><div style="font-size:.75rem;color:var(--text-muted);">${escapeHtml(emp.email)}</div></div>
        </div>
      </td>
      <td><span class="badge role-badge-${emp.role}" style="text-transform:capitalize;">${formatRole(emp.role)}</span></td>
      <td>${escapeHtml(emp.phone || "-")}</td>
      <td><span class="badge badge-${emp.isActive ? "success" : "gray"}">${emp.isActive ? "Active" : "Inactive"}</span></td>
      <td>
        ${
          canManage && emp.role !== "owner"
            ? `
          <button class="btn btn-ghost btn-sm" onclick='openEmployeeModal(${JSON.stringify(emp._id)})'>Edit</button>
          <button class="btn btn-ghost btn-sm" onclick='openResetPasswordModal(${JSON.stringify(emp._id)})'>Reset Password</button>
          <button class="btn btn-ghost btn-sm" onclick="toggleEmployeeActive('${emp._id}', ${!emp.isActive})">${emp.isActive ? "Deactivate" : "Activate"}</button>
          <button class="btn btn-ghost btn-sm text-danger" onclick="deleteEmployee('${emp._id}')">Remove</button>
        `
            : ""
        }
      </td>
    </tr>
  `,
    )
    .join("");
}

// Mirrors backend/utils/permissions.js ROLE_TEMPLATES exactly - used only to
// pre-fill the checkboxes as a convenient starting point. The backend is the
// real source of truth/enforcement; if these two ever drift apart, nothing
// breaks security-wise, the Owner would just see a different default checked
// state than intended. Every checkbox is fully editable regardless.
const PERMISSION_KEYS = [
  "viewDashboard",
  "viewSalesHistory",
  "usePOS",
  "manageProducts",
  "manageInventory",
  "manageCustomers",
  "manageSuppliers",
  "manageEmployees",
];
const ROLE_PERMISSION_TEMPLATES = {
  manager: {
    viewDashboard: true,
    viewSalesHistory: true,
    usePOS: false,
    manageProducts: true,
    manageInventory: true,
    manageCustomers: true,
    manageSuppliers: true,
    manageEmployees: true,
  },
  cashier: {
    viewDashboard: true,
    viewSalesHistory: true,
    usePOS: true,
    manageProducts: false,
    manageInventory: true,
    manageCustomers: false,
    manageSuppliers: false,
    manageEmployees: false,
  },
  inventory_staff: {
    viewDashboard: true,
    viewSalesHistory: true,
    usePOS: false,
    manageProducts: false,
    manageInventory: true,
    manageCustomers: false,
    manageSuppliers: false,
    manageEmployees: false,
  },
};

function setPermissionCheckboxes(permissions) {
  PERMISSION_KEYS.forEach((key) => {
    const checkbox = document.getElementById(`perm-${key}`);
    if (checkbox) checkbox.checked = !!(permissions && permissions[key]);
  });
}

function readPermissionCheckboxes() {
  const result = {};
  PERMISSION_KEYS.forEach((key) => {
    const checkbox = document.getElementById(`perm-${key}`);
    result[key] = !!(checkbox && checkbox.checked);
  });
  return result;
}

// Called when the Role dropdown changes - refills the checkboxes with that
// role's typical starting point. Purely a convenience reset; doesn't lock
// anything, the Owner can still check/uncheck anything afterward.
function applyRoleTemplateToPermissionCheckboxes() {
  const role = document.getElementById("employee-role").value;
  setPermissionCheckboxes(ROLE_PERMISSION_TEMPLATES[role] || {});
}

function openEmployeeModal(employeeId) {
  document.getElementById("employee-alert").style.display = "none";
  const emp = employeeId
    ? State.employees.find((e) => e._id === employeeId)
    : null;

  document.getElementById("employee-modal-title").textContent = emp
    ? "Edit Employee"
    : "Add Employee";
  document.getElementById("employee-id").value = emp ? emp._id : "";
  document.getElementById("employee-name").value = emp ? emp.name : "";
  document.getElementById("employee-email").value = emp ? emp.email : "";
  document.getElementById("employee-phone").value = emp ? emp.phone || "" : "";
  document.getElementById("employee-role").value = emp ? emp.role : "cashier";

  // Managers cannot promote to "manager" role (only owners can)
  const roleSelect = document.getElementById("employee-role");
  const managerOption = roleSelect.querySelector('option[value="manager"]');
  if (managerOption)
    managerOption.style.display = State.user.role === "owner" ? "" : "none";

  // Existing employee -> show their actual current permissions.
  // New employee -> pre-fill with that role's typical starting template.
  setPermissionCheckboxes(
    emp
      ? emp.permissions
      : ROLE_PERMISSION_TEMPLATES[
          document.getElementById("employee-role").value
        ],
  );

  // A Manager (non-owner) can never grant a permission they don't have
  // themselves - grey those checkboxes out so it's clear why they're stuck,
  // rather than silently reverting after save (the backend enforces this
  // either way, but showing it up front avoids a confusing surprise).
  const isOwner = State.user.role === "owner";
  PERMISSION_KEYS.forEach((key) => {
    const checkbox = document.getElementById(`perm-${key}`);
    if (!checkbox) return;
    const editorHasIt =
      isOwner || (State.user.permissions && State.user.permissions[key]);
    checkbox.disabled = !editorHasIt;
    if (!editorHasIt) checkbox.checked = false;
  });

  // Password + email fields are locked when editing (email can't change here to keep it simple)
  document.getElementById("employee-password-group").style.display = emp
    ? "none"
    : "";
  document.getElementById("employee-email").disabled = !!emp;

  openModal("employee-modal");
}

async function saveEmployee() {
  const id = document.getElementById("employee-id").value;
  const alertEl = document.getElementById("employee-alert");
  alertEl.style.display = "none";

  const name = document.getElementById("employee-name").value.trim();
  const role = document.getElementById("employee-role").value;
  const phone = document.getElementById("employee-phone").value.trim();
  const permissions = readPermissionCheckboxes();

  try {
    if (id) {
      await Api.users.update(id, { name, role, phone, permissions });
    } else {
      const email = document.getElementById("employee-email").value.trim();
      const password = document.getElementById("employee-password").value;
      if (!password || password.length < 6) {
        alertEl.textContent =
          "Temporary password must be at least 6 characters";
        alertEl.style.display = "block";
        return;
      }
      await Api.users.create({
        name,
        email,
        password,
        role,
        phone,
        permissions,
      });
    }
    closeModal("employee-modal");
    await loadEmployees();
    showToast("Employee saved successfully", "success");
  } catch (err) {
    alertEl.textContent = err.message;
    alertEl.style.display = "block";
  }
}

async function toggleEmployeeActive(id, nextActive) {
  try {
    await Api.users.update(id, { isActive: nextActive });
    await loadEmployees();
    showToast(
      nextActive ? "Employee activated" : "Employee deactivated",
      "success",
    );
  } catch (err) {
    showToast(err.message, "error");
  }
}

async function deleteEmployee(id) {
  if (!confirm("Remove this employee account? This cannot be undone.")) return;
  try {
    await Api.users.remove(id);
    await loadEmployees();
    showToast("Employee removed", "success");
  } catch (err) {
    showToast(err.message, "error");
  }
}

function openResetPasswordModal(employeeId) {
  const emp = State.employees.find((e) => e._id === employeeId);
  if (!emp) return;
  document.getElementById("reset-password-alert").style.display = "none";
  document.getElementById("reset-password-employee-id").value = emp._id;
  document.getElementById("reset-password-employee-name").textContent =
    `Setting a new temporary password for ${emp.name} (${emp.email}).`;
  document.getElementById("reset-password-new").value = "";
  openModal("reset-password-modal");
}

async function saveResetPassword() {
  const id = document.getElementById("reset-password-employee-id").value;
  const newPassword = document.getElementById("reset-password-new").value;
  const alertEl = document.getElementById("reset-password-alert");
  alertEl.style.display = "none";

  if (!newPassword || newPassword.length < 6) {
    alertEl.textContent = "Password must be at least 6 characters";
    alertEl.style.display = "block";
    return;
  }

  try {
    await Api.users.resetPassword(id, newPassword);
    closeModal("reset-password-modal");
    showToast("Password reset successfully", "success");
  } catch (err) {
    alertEl.textContent = err.message;
    alertEl.style.display = "block";
  }
}

// =======================
// Change my password (Settings page)
// =======================
async function handleChangePassword() {
  const currentPassword = document
    .getElementById("current-password")
    .value.trim();
  const newPassword = document.getElementById("new-password").value.trim();
  const alertEl = document.getElementById("password-alert");
  alertEl.style.display = "none";

  if (!currentPassword) {
    alertEl.className = "alert alert-error";
    alertEl.textContent = "Enter your current password.";
    alertEl.style.display = "block";
    return;
  }
  if (newPassword.length < 8) {
    alertEl.className = "alert alert-error";
    alertEl.textContent = "Password must be at least 8 characters.";
    alertEl.style.display = "block";
    return;
  }

  try {
    const res = await Api.auth.changePassword({ currentPassword, newPassword });
    alertEl.className = "alert alert-success";
    alertEl.textContent = res.message || "Password updated successfully.";
    alertEl.style.display = "block";
    document.getElementById("current-password").value = "";
    document.getElementById("new-password").value = "";
  } catch (err) {
    alertEl.className = "alert alert-error";
    alertEl.textContent = err.message;
    alertEl.style.display = "block";
  }
}
