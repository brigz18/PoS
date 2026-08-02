// =========================================
// SmartPOS - Auth + Payment page logic (index.html)
// Handles: landing page interactions, subscription payment (simulated),
// business registration, login, forgot password.
// =========================================

const PAYMENT_SESSION_KEY = 'smartpos_pending_payment';

const PLAN_LABELS = {
  starter: 'Starter',
  professional: 'Professional',
  enterprise: 'Enterprise',
};

function showPage(pageId) {
  document.querySelectorAll('.page').forEach((page) => page.classList.remove('active'));
  const el = document.getElementById(pageId);
  if (el) el.classList.add('active');
}

function showLanding() { showPage('landing-page'); }
function showLogin() { showPage('login-page'); clearAlerts(); }

// showRegister() used to be reachable directly from several links (footer,
// "Already registered?", the bottom CTA button, etc). Now that registration
// requires a completed payment first, calling it without a payment on file
// sends the person to Pricing instead of a form they can't actually submit.
function showRegister() {
  const pending = getPendingPayment();
  if (!pending || !pending.reference) {
    scrollToPricing();
    return;
  }
  renderRegisterPlanSummary(pending);
  showPage('register-page');
  clearAlerts();
}

function showForgotPassword() { showPage('forgot-password-page'); }

// Used by the nav "Get Started" button and the hero "Register Your Business"
// button - instead of jumping straight to the sign-up form, scroll down to
// the Pricing section first so people can pick a plan (same destination as
// clicking the "Pricing" nav link).
function scrollToPricing(event) {
  if (event) event.preventDefault();
  if (document.getElementById('landing-page').classList.contains('active')) {
    document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  } else {
    showLanding();
    setTimeout(() => document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  }
}

function clearAlerts() {
  document.querySelectorAll('.alert').forEach((el) => (el.style.display = 'none'));
}

function setAlert(id, message, type = 'error') {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = message;
  el.className = `alert alert-${type}`;
  el.style.display = 'block';
}

function toggleMobileMenu() {
  const navLinks = document.querySelector('.nav-links');
  if (navLinks) navLinks.classList.toggle('show-mobile');
}

function toggleFaq(element) {
  element.classList.toggle('active');
}

function togglePasswordField(inputId, iconId) {
  const input = document.getElementById(inputId);
  const icon = document.getElementById(iconId);
  if (!input || !icon) return;
  if (input.type === 'password') {
    input.type = 'text';
    icon.innerHTML = `<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><path d="M14.12 14.12a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>`;
  } else {
    input.type = 'password';
    icon.innerHTML = `<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>`;
  }
}

// Redirects an already-logged-in visitor straight to the dashboard.
function redirectIfLoggedIn() {
  if (typeof Auth !== 'undefined' && Auth.isLoggedIn()) {
    window.location.href = 'dashboard.html';
  }
}

// =======================
// Plan selection -> Payment page
// =======================
function selectPlan(planKey, amount) {
  sessionStorage.setItem('smartpos_selected_plan', JSON.stringify({ plan: planKey, amount }));
  document.getElementById('payment-plan-name').textContent = PLAN_LABELS[planKey] || planKey;
  document.getElementById('payment-plan-price').innerHTML = `$${amount}<small>/month</small>`;
  document.getElementById('pay-btn-amount').textContent = `$${amount}`;

  // Reset the form each time a plan is (re-)selected
  document.getElementById('payment-form').reset();
  document.getElementById('payment-alert').style.display = 'none';
  document.querySelectorAll('#payment-page .payment-method').forEach((b, i) => b.classList.toggle('active', i === 0));
  document.getElementById('wallet-fields').classList.remove('hidden');
  document.getElementById('card-fields').classList.add('hidden');

  showPage('payment-page');
}

function selectPaymentMethod(btn) {
  document.querySelectorAll('#payment-page .payment-method').forEach((b) => b.classList.remove('active'));
  btn.classList.add('active');
  const method = btn.dataset.method;
  const isCard = method === 'card';
  document.getElementById('card-fields').classList.toggle('hidden', !isCard);
  document.getElementById('wallet-fields').classList.toggle('hidden', isCard);
}

// --- Payment form submission (simulated processor - see backend for details) ---
async function handlePayment(event) {
  event.preventDefault();
  const alertEl = document.getElementById('payment-alert');
  alertEl.style.display = 'none';

  const selectedPlan = JSON.parse(sessionStorage.getItem('smartpos_selected_plan') || 'null');
  if (!selectedPlan) {
    scrollToPricing();
    return;
  }

  const method = document.querySelector('#payment-page .payment-method.active')?.dataset.method || 'gcash';
  const payerName = document.getElementById('pay-name').value.trim();

  const payload = {
    plan: selectedPlan.plan,
    paymentMethod: method,
    payerName,
    purpose: 'registration',
  };

  if (method === 'card') {
    payload.cardNumber = document.getElementById('pay-card-number').value.trim();
    payload.cardExpiry = document.getElementById('pay-card-expiry').value.trim();
    payload.cardCvv = document.getElementById('pay-card-cvv').value.trim();
  } else {
    payload.mobileNumber = document.getElementById('pay-mobile').value.trim();
  }

  const btn = document.getElementById('pay-btn');
  btn.disabled = true;
  const originalHtml = btn.innerHTML;
  btn.innerHTML = '<span class="spinner"></span> Processing payment...';

  try {
    const { data } = await Api.payments.checkout(payload);
    setPendingPayment(data);
    renderRegisterPlanSummary(data);
    showPage('register-page');
    clearAlerts();
  } catch (err) {
    alertEl.textContent = err.message;
    alertEl.style.display = 'block';
  } finally {
    btn.disabled = false;
    btn.innerHTML = originalHtml;
  }
}

function setPendingPayment(paymentData) {
  sessionStorage.setItem(PAYMENT_SESSION_KEY, JSON.stringify(paymentData));
}

function getPendingPayment() {
  try {
    return JSON.parse(sessionStorage.getItem(PAYMENT_SESSION_KEY) || 'null');
  } catch (e) {
    return null;
  }
}

function clearPendingPayment() {
  sessionStorage.removeItem(PAYMENT_SESSION_KEY);
  sessionStorage.removeItem('smartpos_selected_plan');
}

function renderRegisterPlanSummary(paymentData) {
  document.getElementById('register-plan-name').textContent = PLAN_LABELS[paymentData.plan] || paymentData.plan;
  document.getElementById('register-plan-ref').textContent = paymentData.reference;
  document.getElementById('reg-payment-reference').value = paymentData.reference;
}

// --- Login form ---
async function handleLogin(event) {
  event.preventDefault();
  clearAlerts();

  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value.trim();
  const btn = document.getElementById('login-btn');

  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Signing in...';

  try {
    const data = await Api.auth.login({ email, password });
    Auth.setSession(data);
    window.location.href = 'dashboard.html';
  } catch (err) {
    setAlert('login-alert', err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Sign In';
  }
}

// --- Business registration form (creates the Owner account) ---
async function handleRegister(event) {
  event.preventDefault();
  clearAlerts();

  const businessName = document.getElementById('reg-business-name').value.trim();
  const ownerName = document.getElementById('reg-owner-name').value.trim();
  const email = document.getElementById('reg-email').value.trim();
  const phone = document.getElementById('reg-phone').value.trim();
  const password = document.getElementById('reg-password').value;
  const confirmPassword = document.getElementById('reg-confirm-password').value;
  const paymentReference = document.getElementById('reg-payment-reference').value;
  const btn = document.getElementById('register-btn');

  if (!paymentReference) {
    setAlert('register-alert', 'Please choose a plan and complete payment before registering.');
    return;
  }
  if (password !== confirmPassword) {
    setAlert('register-alert', 'Passwords do not match');
    return;
  }
  if (password.length < 6) {
    setAlert('register-alert', 'Password must be at least 6 characters');
    return;
  }

  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Creating your account...';

  try {
    const data = await Api.auth.registerBusiness({ businessName, ownerName, email, password, phone, paymentReference });
    clearPendingPayment();
    Auth.setSession(data);
    window.location.href = 'dashboard.html';
  } catch (err) {
    setAlert('register-alert', err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Create Business Account';
  }
}

function fillDemo(email, password) {
  const emailField = document.getElementById('email');
  const passwordField = document.getElementById('password');
  if (emailField) emailField.value = email;
  if (passwordField) passwordField.value = password;
}

// Nav scroll effect
window.addEventListener('scroll', () => {
  const nav = document.getElementById('landing-nav');
  if (!nav) return;
  if (window.scrollY > 20) nav.classList.add('scrolled');
  else nav.classList.remove('scrolled');
});

document.addEventListener('DOMContentLoaded', redirectIfLoggedIn);
