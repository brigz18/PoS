// =========================================
// SmartPOS - Modern Point of Sale System
// JavaScript Application
// =========================================

// =======================
// Data Store
// =======================
const AppData = {
    currentUser: null,
    cart: [],
    selectedCustomer: null,
    theme: localStorage.getItem('smartpos-theme') || 'light',
    settings: {
        businessName: 'SmartPOS Demo',
        currency: 'PHP',
        currencySymbol: '₱',
        taxRate: 12
    }
};

// Sample Data
const products = [
    { id: 1, name: 'Classic Americano', sku: 'BEV-001', barcode: '1234567890123', categoryId: 1, costPrice: 35, sellingPrice: 85, unit: 'cup', stock: 150, minStock: 20, image: 'https://images.pexels.com/photos/302899/pexels-photo-302899.jpeg?auto=compress&cs=tinysrgb&w=300' },
    { id: 2, name: 'Caramel Macchiato', sku: 'BEV-002', barcode: '1234567890124', categoryId: 1, costPrice: 45, sellingPrice: 120, unit: 'cup', stock: 100, minStock: 15, image: 'https://images.pexels.com/photos/239622/pexels-photo-239622.jpeg?auto=compress&cs=tinysrgb&w=300' },
    { id: 3, name: 'Iced Latte', sku: 'BEV-003', barcode: '1234567890125', categoryId: 1, costPrice: 40, sellingPrice: 95, unit: 'cup', stock: 80, minStock: 15, image: 'https://images.pexels.com/photos/1024332/pexels-photo-1024332.jpeg?auto=compress&cs=tinysrgb&w=300' },
    { id: 4, name: 'Milk Tea Classic', sku: 'BEV-004', barcode: '1234567890126', categoryId: 1, costPrice: 30, sellingPrice: 75, unit: 'cup', stock: 200, minStock: 30, image: 'https://images.pexels.com/photos/16632708/pexels-photo-16632708.jpeg?auto=compress&cs=tinysrgb&w=300' },
    { id: 5, name: 'Taro Milk Tea', sku: 'BEV-005', barcode: '1234567890127', categoryId: 1, costPrice: 35, sellingPrice: 85, unit: 'cup', stock: 120, minStock: 20, image: 'https://images.pexels.com/photos/16942565/pexels-photo-16942565.jpeg?auto=compress&cs=tinysrgb&w=300' },
    { id: 6, name: 'Club Sandwich', sku: 'FOO-001', barcode: '1234567890128', categoryId: 2, costPrice: 65, sellingPrice: 145, unit: 'piece', stock: 45, minStock: 10, image: 'https://images.pexels.com/photos/1631436/pexels-photo-1631436.jpeg?auto=compress&cs=tinysrgb&w=300' },
    { id: 7, name: 'Chicken Wings (6pc)', sku: 'FOO-002', barcode: '1234567890129', categoryId: 2, costPrice: 95, sellingPrice: 195, unit: 'plate', stock: 35, minStock: 8, image: 'https://images.pexels.com/photos/1437325/pexels-photo-1437325.jpeg?auto=compress&cs=tinysrgb&w=300' },
    { id: 8, name: 'French Fries', sku: 'SNK-001', barcode: '1234567890130', categoryId: 3, costPrice: 25, sellingPrice: 65, unit: 'serving', stock: 95, minStock: 20, image: 'https://images.pexels.com/photos/1583884/pexels-photo-1583884.jpeg?auto=compress&cs=tinysrgb&w=300' },
    { id: 9, name: 'Chocolate Cake', sku: 'DES-001', barcode: '1234567890131', categoryId: 4, costPrice: 55, sellingPrice: 145, unit: 'slice', stock: 18, minStock: 5, image: 'https://images.pexels.com/photos/1291712/pexels-photo-1291712.jpeg?auto=compress&cs=tinysrgb&w=300' },
    { id: 10, name: 'Cheesecake', sku: 'DES-002', barcode: '1234567890132', categoryId: 4, costPrice: 65, sellingPrice: 165, unit: 'slice', stock: 15, minStock: 5, image: 'https://images.pexels.com/photos/6210580/pexels-photo-6210580.jpeg?auto=compress&cs=tinysrgb&w=300' },
    { id: 11, name: 'Matcha Latte', sku: 'BEV-006', barcode: '1234567890133', categoryId: 1, costPrice: 42, sellingPrice: 110, unit: 'cup', stock: 75, minStock: 15, image: 'https://images.pexels.com/photos/10906784/pexels-photo-10906784.jpeg?auto=compress&cs=tinysrgb&w=300' },
    { id: 12, name: 'Hot Chocolate', sku: 'BEV-007', barcode: '1234567890134', categoryId: 1, costPrice: 38, sellingPrice: 95, unit: 'cup', stock: 65, minStock: 12, image: 'https://images.pexels.com/photos/1671164/pexels-photo-1671164.jpeg?auto=compress&cs=tinysrgb&w=300' },
    { id: 13, name: 'Brownie', sku: 'DES-003', barcode: '1234567890135', categoryId: 4, costPrice: 35, sellingPrice: 85, unit: 'piece', stock: 0, minStock: 8, image: 'https://images.pexels.com/photos/4590746/pexels-photo-4590746.jpeg?auto=compress&cs=tinysrgb&w=300' },
    { id: 14, name: 'Nachos Supreme', sku: 'SNK-002', barcode: '1234567890136', categoryId: 3, costPrice: 45, sellingPrice: 125, unit: 'plate', stock: 42, minStock: 10, image: 'https://images.pexels.com/photos/2087774/pexels-photo-2087774.jpeg?auto=compress&cs=tinysrgb&w=300' },
    { id: 15, name: 'Burger Classic', sku: 'FOO-003', barcode: '1234567890137', categoryId: 2, costPrice: 75, sellingPrice: 175, unit: 'piece', stock: 38, minStock: 10, image: 'https://images.pexels.com/photos/1633578/pexels-photo-1633578.jpeg?auto=compress&cs=tinysrgb&w=300' },
];

const categories = [
    { id: 1, name: 'Beverages', color: '#3b82f6' },
    { id: 2, name: 'Food', color: '#10b981' },
    { id: 3, name: 'Snacks', color: '#f59e0b' },
    { id: 4, name: 'Desserts', color: '#ec4899' },
    { id: 5, name: 'Merchandise', color: '#8b5cf6' },
];

const customers = [
    { id: 1, name: 'John Smith', email: 'john@email.com', phone: '09171234567', membership: 'platinum', points: 2580, totalSpent: 28500 },
    { id: 2, name: 'Sarah Johnson', email: 'sarah@email.com', phone: '09181234567', membership: 'gold', points: 1250, totalSpent: 18200 },
    { id: 3, name: 'Mike Davis', email: 'mike@email.com', phone: '09191234567', membership: 'silver', points: 450, totalSpent: 6500 },
    { id: 4, name: 'Emily Brown', email: 'emily@email.com', phone: '09201234567', membership: 'gold', points: 1890, totalSpent: 22100 },
    { id: 5, name: 'David Wilson', email: 'david@email.com', phone: '09211234567', membership: 'silver', points: 320, totalSpent: 4200 },
];

const suppliers = [
    { id: 1, name: 'Coffee Beans Corp', company: 'Coffee Beans Corporation', contactPerson: 'Maria Santos', email: 'maria@coffeebeans.com', phone: '09281234567', address: '123 Coffee Lane, Makati City', isActive: true },
    { id: 2, name: 'Fresh Dairy Inc', company: 'Fresh Dairy Incorporated', contactPerson: 'Pedro Reyes', email: 'pedro@freshdairy.com', phone: '09291234567', address: '456 Milk Street, Quezon City', isActive: true },
    { id: 3, name: 'Snack Masters', company: 'Snack Masters Ltd', contactPerson: 'Ana Cruz', email: 'ana@snackmasters.com', phone: '09301234567', address: '789 Snack Road, Pasig City', isActive: true },
];

const employees = [
    { id: 1, name: 'Admin User', email: 'admin@smartpos.com', position: 'Store Manager', department: 'Management', salary: 35000, status: 'active', role: 'administrator' },
    { id: 2, name: 'Jane Manager', email: 'manager@smartpos.com', position: 'Assistant Manager', department: 'Management', salary: 28000, status: 'active', role: 'manager' },
    { id: 3, name: 'Bob Cashier', email: 'cashier@smartpos.com', position: 'Cashier', department: 'Operations', salary: 16500, status: 'active', role: 'cashier' },
    { id: 4, name: 'Alice Staff', email: 'staff@smartpos.com', position: 'Barista', department: 'Operations', salary: 18000, status: 'active', role: 'inventory_staff' },
];

const movements = [
    { id: 1, productId: 1, type: 'in', quantity: 50, reference: 'PO-2024-001', notes: 'Regular restock', createdAt: new Date(), createdBy: 'Admin User' },
    { id: 2, productId: 2, type: 'out', quantity: 12, reference: 'SL-000001', notes: 'Sale', createdAt: new Date(), createdBy: 'Bob Cashier' },
    { id: 3, productId: 5, type: 'adjustment', quantity: -3, notes: 'Damaged items', createdAt: new Date(), createdBy: 'Alice Staff' },
];

// =======================
// Utility Functions
// =======================
function formatCurrency(amount) {
    return `${AppData.settings.currencySymbol}${amount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatNumber(num) {
    return num.toLocaleString('en-PH');
}

function formatDate(date) {
    const d = new Date(date);
    return d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatDateTime(date) {
    const d = new Date(date);
    return d.toLocaleString('en-PH', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function getInitials(name) {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

function generateSaleNumber() {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 5).toUpperCase();
    return `SL-${timestamp}${random}`;
}

function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast active ${type}`;
    setTimeout(() => {
        toast.className = 'toast';
    }, 3000);
}

// =======================
// Theme Toggle
// =======================
function initTheme() {
    if (AppData.theme === 'dark') {
        document.documentElement.classList.add('dark');
    } else {
        document.documentElement.classList.remove('dark');
    }
}

function toggleTheme() {
    AppData.theme = AppData.theme === 'light' ? 'dark' : 'light';
    localStorage.setItem('smartpos-theme', AppData.theme);
    initTheme();
    updateThemeIcon();
}

function updateThemeIcon() {
    const icon = document.getElementById('theme-icon');
    if (icon) {
        if (AppData.theme === 'dark') {
            icon.innerHTML = '<circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>';
        } else {
            icon.innerHTML = '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>';
        }
    }
}

// =======================
// Navigation
// =======================
function showPage(pageId) {
    document.querySelectorAll('.page').forEach(page => {
        page.classList.remove('active');
    });
    document.getElementById(pageId).classList.add('active');
}

function showLanding() {
    showPage('landing-page');
}

function showLogin() {
    showPage('login-page');
}

function showForgotPassword() {
    showPage('forgot-password-page');
}

function navigateTo(page, event) {
    if (event) event.preventDefault();

    // Update nav active state
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
    });
    const activeNav = document.querySelector(`.nav-item[data-page="${page}"]`);
    if (activeNav) activeNav.classList.add('active');

    // Show page content
    document.querySelectorAll('.page-content').forEach(content => {
        content.classList.remove('active');
    });
    const pageContent = document.getElementById(`${page}-content`);
    if (pageContent) pageContent.classList.add('active');

    // Special handling for POS
    if (page === 'pos') {
        renderPOSProducts();
    }

    // Render data for specific pages
    if (page === 'products') renderProductsTable();
    if (page === 'inventory') renderInventoryTable();
    if (page === 'customers') renderCustomersGrid();
    if (page === 'suppliers') renderSuppliersGrid();
    if (page === 'employees') renderEmployeesTable();
}

function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    sidebar.classList.toggle('collapsed');
}

// =======================
// Landing Page
// =======================
function toggleMobileMenu() {
    // Mobile menu toggle logic
    const navLinks = document.querySelector('.nav-links');
    navLinks.classList.toggle('show-mobile');
}

function toggleFaq(element) {
    element.classList.toggle('active');
}

function toggleMobileMenu() {
    document.getElementById('mobileMenu').classList.toggle('open');
    document.getElementById('mobileMenuOverlay').classList.toggle('open');
}

// Nav scroll effect
window.addEventListener('scroll', () => {
    const nav = document.getElementById('landing-nav');
    if (window.scrollY > 20) {
        nav.classList.add('scrolled');
    } else {
        nav.classList.remove('scrolled');
    }
});


function handleLogout() {

    const confirmLogout = confirm("Are you sure you want to logout?");

    if (confirmLogout) {
        window.location.href = "index.html";
    }

}

function handleLogout() {
    alert("Logout button clicked!");
}

// =======================
// Logout
// =======================
function handleLogout() {
    window.location.href = "index.html";
}

// =======================
// Authentication
// =======================
function handleLogin(event) {
    event.preventDefault();
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    if (email && password.length >= 6) {
        // Find demo user
        const user = employees.find(e => e.email === email) || employees[0];
        AppData.currentUser = { ...user, email };

        // Update UI
        document.getElementById('user-name').textContent = user.name;
        document.getElementById('user-role').textContent = user.role.replace('_', ' ');
        document.getElementById('user-initials').textContent = getInitials(user.name);

        showPage('dashboard');
        showToast(`Welcome back, ${user.name}!`, 'success');
    } else {
        showToast('Please enter valid credentials', 'error');
    }
}

function handleLogout() {
    AppData.currentUser = null;
    AppData.cart = [];
    showLanding();
    showToast('Logged out successfully', 'success');
}

function handleForgotPassword(event) {
    event.preventDefault();
    showToast('Password reset link sent to your email!', 'success');
}

function fillDemo(email, password) {
    document.getElementById('email').value = email;
    document.getElementById('password').value = password;
}

function togglePassword() {
    const passwordInput = document.getElementById('password');
    const eyeIcon = document.getElementById('eye-icon');

    if (passwordInput.type === 'password') {
        passwordInput.type = 'text';
        eyeIcon.innerHTML = '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>';
    } else {
        passwordInput.type = 'password';
        eyeIcon.innerHTML = '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>';
    }
}

function handleLogin(event) {
    event.preventDefault();

    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;

    // Sample login credentials
    const validEmail = "admin@smartpos.com";
    const validPassword = "123456";

    if (email === validEmail && password === validPassword) {

        alert("Login Successful!");

    

    } else {

        alert("Invalid Email or Password");

    }
}

// =======================
// POS Terminal
// =======================
function renderPOSProducts(filter = 'all') {
    const grid = document.getElementById('pos-products-grid');
    const filteredProducts = filter === 'all' ? products : products.filter(p => p.categoryId == filter);

    grid.innerHTML = filteredProducts.map(product => `
        <div class="pos-product-card ${product.stock === 0 ? 'disabled' : ''}" onclick="addToCart(${product.id})">
            <img src="${product.image || 'https://via.placeholder.com/150'}" alt="${product.name}" class="pos-product-image">
            <div class="pos-product-name">${product.name}</div>
            <div class="pos-product-price">${formatCurrency(product.sellingPrice)}</div>
            <div class="pos-product-stock ${product.stock <= product.minStock ? (product.stock === 0 ? 'out' : 'low') : ''}">${product.stock === 0 ? 'Out of stock' : product.stock + ' left'}</div>
        </div>
    `).join('');
}

function renderPOSCategories() {
    const container = document.getElementById('pos-categories');
    let html = '<button class="category-btn active" data-category="all" onclick="filterByCategory(0)">All</button>';
    categories.forEach(cat => {
        html += `<button class="category-btn" data-category="${cat.id}" onclick="filterByCategory(${cat.id})" style="--cat-color: ${cat.color}">${cat.name}</button>`;
    });
    container.innerHTML = html;
}

function filterByCategory(categoryId) {
    document.querySelectorAll('.category-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.category == categoryId) {
            btn.classList.add('active');
        }
    });
    renderPOSProducts(categoryId || 'all');
}

function addToCart(productId) {
    const product = products.find(p => p.id === productId);
    if (!product || product.stock === 0) return;

    const existingItem = AppData.cart.find(item => item.id === productId);
    if (existingItem) {
        existingItem.quantity++;
    } else {
        AppData.cart.push({
            ...product,
            quantity: 1,
            discount: 0
        });
    }

    updateCartUI();
    showToast(`Added ${product.name} to cart`, 'success');
}

function removeFromCart(productId) {
    AppData.cart = AppData.cart.filter(item => item.id !== productId);
    updateCartUI();
}

function updateCartQuantity(productId, change) {
    const item = AppData.cart.find(i => i.id === productId);
    if (item) {
        item.quantity += change;
        if (item.quantity <= 0) {
            removeFromCart(productId);
        } else {
            updateCartUI();
        }
    }
}

function clearCart() {
    AppData.cart = [];
    AppData.selectedCustomer = null;
    document.getElementById('selected-customer').textContent = 'Walk-in Customer';
    updateCartUI();
}

function updateCartUI() {
    const cartContainer = document.getElementById('cart-items');
    const subtotal = AppData.cart.reduce((sum, item) => sum + (item.sellingPrice * item.quantity), 0);
    const tax = subtotal * (AppData.settings.taxRate / 100);
    const total = subtotal + tax;

    if (AppData.cart.length === 0) {
        cartContainer.innerHTML = `
            <div class="cart-empty">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" stroke-width="1.5">
                    <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
                    <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
                </svg>
                <p>Cart is empty</p>
                <span>Add products to get started</span>
            </div>
        `;
        document.getElementById('checkout-btn').disabled = true;
    } else {
        cartContainer.innerHTML = AppData.cart.map(item => `
            <div class="cart-item">
                <img src="${item.image || 'https://via.placeholder.com/48'}" alt="${item.name}" class="cart-item-image">
                <div class="cart-item-info">
                    <div class="cart-item-name">${item.name}</div>
                    <div class="cart-item-price">${formatCurrency(item.sellingPrice)} each</div>
                    <div class="cart-item-qty">
                        <button class="qty-btn" onclick="updateCartQuantity(${item.id}, -1)">-</button>
                        <span class="qty-value">${item.quantity}</span>
                        <button class="qty-btn" onclick="updateCartQuantity(${item.id}, 1)">+</button>
                    </div>
                </div>
                <div class="cart-item-total">${formatCurrency(item.sellingPrice * item.quantity)}</div>
                <button class="cart-item-remove" onclick="removeFromCart(${item.id})">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                </button>
            </div>
        `).join('');
        document.getElementById('checkout-btn').disabled = false;
    }

    document.getElementById('cart-subtotal').textContent = formatCurrency(subtotal);
    document.getElementById('cart-tax').textContent = formatCurrency(tax);
    document.getElementById('cart-total').textContent = formatCurrency(total);
}

// =======================
// Checkout & Payment
// =======================
function openCheckout() {
    if (AppData.cart.length === 0) return;

    const subtotal = AppData.cart.reduce((sum, item) => sum + (item.sellingPrice * item.quantity), 0);
    const tax = subtotal * (AppData.settings.taxRate / 100);
    const total = subtotal + tax;

    document.getElementById('payment-total').textContent = formatCurrency(total);
    document.getElementById('checkout-modal').classList.add('active');
    document.getElementById('amount-received').value = '';
    document.getElementById('change-amount').textContent = '₱0.00';
}

function closeCheckout() {
    document.getElementById('checkout-modal').classList.remove('active');
}

// Payment method selection
document.querySelectorAll('.payment-method').forEach(btn => {
    btn.addEventListener('click', function() {
        document.querySelectorAll('.payment-method').forEach(b => b.classList.remove('active'));
        this.classList.add('active');
    });
});

function addQuickAmount(amount) {
    const input = document.getElementById('amount-received');
    const currentVal = parseFloat(input.value) || 0;
    const total = AppData.cart.reduce((sum, item) => sum + (item.sellingPrice * item.quantity), 0) * (1 + AppData.settings.taxRate / 100);
    input.value = (total + amount).toFixed(2);
    calculateChange();
}

function setExactAmount() {
    const total = AppData.cart.reduce((sum, item) => sum + (item.sellingPrice * item.quantity), 0) * (1 + AppData.settings.taxRate / 100);
    document.getElementById('amount-received').value = total.toFixed(2);
    calculateChange();
}

function calculateChange() {
    const amountPaid = parseFloat(document.getElementById('amount-received').value) || 0;
    const total = AppData.cart.reduce((sum, item) => sum + (item.sellingPrice * item.quantity), 0) * (1 + AppData.settings.taxRate / 100);
    const change = Math.max(0, amountPaid - total);
    document.getElementById('change-amount').textContent = formatCurrency(change);
}

document.getElementById('amount-received')?.addEventListener('input', calculateChange);

function processPayment() {
    const amountPaid = parseFloat(document.getElementById('amount-received').value) || 0;
    const subtotal = AppData.cart.reduce((sum, item) => sum + (item.sellingPrice * item.quantity), 0);
    const tax = subtotal * (AppData.settings.taxRate / 100);
    const total = subtotal + tax;

    if (amountPaid < total) {
        showToast('Insufficient payment amount', 'error');
        return;
    }

    const change = amountPaid - total;
    const saleNumber = generateSaleNumber();
    const paymentMethod = document.querySelector('.payment-method.active')?.dataset.method || 'cash';

    // Update receipt
    document.getElementById('receipt-number').textContent = saleNumber;
    document.getElementById('receipt-date').textContent = formatDateTime(new Date());
    document.getElementById('receipt-method').textContent = paymentMethod.charAt(0).toUpperCase() + paymentMethod.slice(1);
    document.getElementById('receipt-subtotal').textContent = formatCurrency(subtotal);
    document.getElementById('receipt-tax').textContent = formatCurrency(tax);
    document.getElementById('receipt-total').textContent = formatCurrency(total);
    document.getElementById('receipt-paid').textContent = formatCurrency(amountPaid);
    document.getElementById('receipt-change').textContent = formatCurrency(change);

    closeCheckout();
    document.getElementById('receipt-modal').classList.add('active');

    // Update stock
    AppData.cart.forEach(item => {
        const product = products.find(p => p.id === item.id);
        if (product) {
            product.stock -= item.quantity;
        }
    });

    showToast('Payment successful!', 'success');
}

function newTransaction() {
    document.getElementById('receipt-modal').classList.remove('active');
    clearCart();
}

// =======================
// Customer Selection Modal
// =======================
function openCustomerModal() {
    const list = document.getElementById('customer-select-list');

    let html = `
        <div class="customer-list-item" onclick="selectCustomer(null)">
            <div class="customer-avatar" style="background: var(--gray-200);">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                    <circle cx="12" cy="7" r="4"/>
                </svg>
            </div>
            <div><div style="font-weight: 500;">Walk-in Customer</div><div style="font-size: 0.75rem; color: var(--text-muted);">No account</div></div>
        </div>
    `;

    customers.forEach(customer => {
        const avatarColor = customer.membership === 'platinum' ? 'rgba(139, 92, 246, 0.2)' :
                           customer.membership === 'gold' ? 'rgba(245, 158, 11, 0.2)' : 'rgba(156, 163, 175, 0.2)';
        const textColor = customer.membership === 'platinum' ? '#8b5cf6' :
                         customer.membership === 'gold' ? '#f59e0b' : '#6b7280';

        html += `
            <div class="customer-list-item" onclick="selectCustomer(${customer.id})">
                <div class="customer-avatar" style="background: ${avatarColor}; color: ${textColor};">${getInitials(customer.name)}</div>
                <div>
                    <div style="font-weight: 500;">${customer.name}</div>
                    <div style="font-size: 0.75rem; color: var(--text-muted);">${customer.phone}</div>
                </div>
                <span class="badge badge-${customer.membership === 'platinum' ? 'primary' : customer.membership === 'gold' ? 'warning' : 'gray'}" style="margin-left: auto; text-transform: capitalize;">${customer.membership}</span>
            </div>
        `;
    });

    list.innerHTML = html;
    document.getElementById('customer-select-modal').classList.add('active');
}

function closeCustomerModal() {
    document.getElementById('customer-select-modal').classList.remove('active');
}

function selectCustomer(customerId) {
    if (customerId) {
        const customer = customers.find(c => c.id === customerId);
        AppData.selectedCustomer = customer;
        document.getElementById('selected-customer').textContent = customer.name;
    } else {
        AppData.selectedCustomer = null;
        document.getElementById('selected-customer').textContent = 'Walk-in Customer';
    }
    closeCustomerModal();
}

// =======================
// Products Page
// =======================
function renderProductsTable() {
    const tbody = document.getElementById('products-tbody');
    tbody.innerHTML = products.map(product => {
        const category = categories.find(c => c.id === product.categoryId);
        const stockClass = product.stock === 0 ? 'danger' : product.stock <= product.minStock ? 'warning' : 'success';
        const stockText = product.stock === 0 ? 'Out' : product.stock <= product.minStock ? 'Low' : 'In Stock';

        return `
            <tr>
                <td>
                    <div style="display: flex; align-items: center; gap: 0.75rem;">
                        <img src="${product.image || 'https://via.placeholder.com/40'}" alt="" style="width: 40px; height: 40px; border-radius: 8px; object-fit: cover;">
                        <div>
                            <div style="font-weight: 500;">${product.name}</div>
                            <div style="font-size: 0.75rem; color: var(--text-muted);">${product.barcode || ''}</div>
                        </div>
                    </div>
                </td>
                <td style="font-family: monospace; font-size: 0.75rem; color: var(--text-muted);">${product.sku}</td>
                <td><span class="badge badge-gray">${category?.name || 'Unknown'}</span></td>
                <td style="text-align: right;">${formatCurrency(product.sellingPrice)}</td>
                <td style="text-align: right;"><span class="text-${stockClass}">${product.stock} ${product.unit}</span></td>
                <td><span class="badge badge-${product.stock > 0 ? 'success' : 'gray'}">${stockText}</span></td>
                <td style="text-align: right;">
                    <button class="btn btn-ghost btn-sm"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
                </td>
            </tr>
        `;
    }).join('');
}

// =======================
// Inventory Page
// =======================
function renderInventoryTable() {
    const tbody = document.getElementById('inventory-tbody');
    tbody.innerHTML = products.map(product => {
        const statusClass = product.stock === 0 ? 'danger' : product.stock <= product.minStock ? 'warning' : 'success';
        const statusText = product.stock === 0 ? 'Out of Stock' : product.stock <= product.minStock ? 'Low Stock' : 'In Stock';
        const value = product.costPrice * product.stock;

        return `
            <tr>
                <td>
                    <div style="display: flex; align-items: center; gap: 0.75rem;">
                        <img src="${product.image || 'https://via.placeholder.com/40'}" alt="" style="width: 40px; height: 40px; border-radius: 8px; object-fit: cover;">
                        <span style="font-weight: 500;">${product.name}</span>
                    </div>
                </td>
                <td style="font-family: monospace; font-size: 0.75rem; color: var(--text-muted);">${product.sku}</td>
                <td style="text-align: right; font-weight: 600;">${product.stock}</td>
                <td style="text-align: right; color: var(--text-muted);">${product.minStock}</td>
                <td style="text-align: right;">${formatCurrency(value)}</td>
                <td><span class="badge badge-${statusClass}">${statusText}</span></td>
                <td style="text-align: right;">
                    <button class="btn btn-ghost btn-sm text-success" title="Stock In"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></svg></button>
                    <button class="btn btn-ghost btn-sm text-danger" title="Stock Out"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg></button>
                </td>
            </tr>
        `;
    }).join('');

    // Render movements
    const movementsTbody = document.getElementById('movements-tbody');
    movementsTbody.innerHTML = movements.map(mov => {
        const product = products.find(p => p.id === mov.productId);
        const typeColors = { in: 'success', out: 'danger', adjustment: 'warning', transfer: 'primary' };
        const typeText = { in: 'Stock In', out: 'Stock Out', adjustment: 'Adjustment', transfer: 'Transfer' };

        return `
            <tr>
                <td>${formatDateTime(mov.createdAt)}</td>
                <td style="font-weight: 500;">${product?.name || 'Unknown'}</td>
                <td><span class="badge badge-${typeColors[mov.type]}">${typeText[mov.type]}</span></td>
                <td style="text-align: right; font-weight: 600; color: var(--${mov.type === 'in' || (mov.type === 'adjustment' && mov.quantity > 0) ? 'success' : 'danger'}-500);">
                    ${mov.type === 'adjustment' && mov.quantity < 0 ? '' : '+'}${Math.abs(mov.quantity)}
                </td>
                <td>${mov.reference || '-'}</td>
                <td>${mov.createdBy}</td>
            </tr>
        `;
    }).join('');
}

// Tab switching
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', function() {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        this.classList.add('active');
        const tabId = this.dataset.tab;
        document.getElementById(`inventory-${tabId}`).classList.add('active');
    });
});

// =======================
// Customers Page
// =======================
function renderCustomersGrid() {
    const grid = document.getElementById('customers-grid');
    grid.innerHTML = customers.map(customer => {
        const avatarBg = customer.membership === 'platinum' ? 'rgba(139, 92, 246, 0.2)' :
                        customer.membership === 'gold' ? 'rgba(245, 158, 11, 0.2)' : 'rgba(156, 163, 175, 0.2)';
        const avatarColor = customer.membership === 'platinum' ? '#8b5cf6' :
                           customer.membership === 'gold' ? '#f59e0b' : '#6b7280';

        return `
            <div class="customer-card">
                <div class="customer-header">
                    <div style="display: flex; align-items: center; gap: 0.75rem;">
                        <div class="customer-avatar-lg" style="background: ${avatarBg}; color: ${avatarColor};">${getInitials(customer.name)}</div>
                        <div>
                            <div style="font-weight: 600;">${customer.name}</div>
                            <div style="font-size: 0.75rem; color: var(--text-muted);">${customer.phone}</div>
                        </div>
                    </div>
                    <span class="badge badge-${customer.membership === 'platinum' ? 'primary' : customer.membership === 'gold' ? 'warning' : 'gray'}" style="text-transform: capitalize;">${customer.membership}</span>
                </div>
                <div class="customer-stats">
                    <div class="customer-stat">
                        <div class="value">${formatNumber(customer.points)}</div>
                        <div class="label">Points</div>
                    </div>
                    <div class="customer-stat">
                        <div class="value text-success">${formatCurrency(customer.totalSpent)}</div>
                        <div class="label">Total Spent</div>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

// =======================
// Suppliers Page
// =======================
function renderSuppliersGrid() {
    const grid = document.getElementById('suppliers-grid');
    grid.innerHTML = suppliers.map(supplier => `
        <div class="supplier-card">
            <div class="supplier-header">
                <div style="display: flex; align-items: center; gap: 0.75rem;">
                    <div class="supplier-icon">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <rect x="2" y="7" width="20" height="14" rx="2" ry="2"/>
                            <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
                        </svg>
                    </div>
                    <div>
                        <div style="font-weight: 600;">${supplier.name}</div>
                        <div style="font-size: 0.75rem; color: var(--text-muted);">${supplier.company}</div>
                    </div>
                </div>
                <span class="badge badge-${supplier.isActive ? 'success' : 'gray'}">${supplier.isActive ? 'Active' : 'Inactive'}</span>
            </div>
            <div class="supplier-contact">
                <div class="supplier-contact-item">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
                    </svg>
                    <span>${supplier.phone}</span>
                </div>
                <div class="supplier-contact-item">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                        <polyline points="22,6 12,13 2,6"/>
                    </svg>
                    <span>${supplier.email}</span>
                </div>
                <div class="supplier-contact-item">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                        <circle cx="12" cy="10" r="3"/>
                    </svg>
                    <span>${supplier.address}</span>
                </div>
            </div>
        </div>
    `).join('');
}

// =======================
// Employees Page
// =======================
function renderEmployeesTable() {
    const tbody = document.getElementById('employees-tbody');
    tbody.innerHTML = employees.map(emp => `
        <tr>
            <td>
                <div style="display: flex; align-items: center; gap: 0.75rem;">
                    <div class="user-avatar">${getInitials(emp.name)}</div>
                    <div>
                        <div style="font-weight: 500;">${emp.name}</div>
                        <div style="font-size: 0.75rem; color: var(--text-muted);">${emp.email}</div>
                    </div>
                </div>
            </td>
            <td>${emp.position}</td>
            <td>${emp.department}</td>
            <td style="text-align: right;">${formatCurrency(emp.salary)}</td>
            <td><span class="badge badge-${emp.status === 'active' ? 'success' : 'gray'}">${emp.status}</span></td>
            <td style="text-align: right;">
                <button class="btn btn-ghost btn-sm"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
            </td>
        </tr>
    `).join('');
}

// =======================
// Settings
// =======================
document.querySelectorAll('.settings-nav-item').forEach(btn => {
    btn.addEventListener('click', function() {
        document.querySelectorAll('.settings-nav-item').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.settings-section').forEach(s => s.classList.remove('active'));
        this.classList.add('active');
        const sectionId = `settings-${this.dataset.settings}`;
        document.getElementById(sectionId)?.classList.add('active');
    });
});

document.querySelectorAll('.theme-option').forEach(btn => {
    btn.addEventListener('click', function() {
        document.querySelectorAll('.theme-option').forEach(b => b.classList.remove('active'));
        this.classList.add('active');
        const theme = this.dataset.theme;
        AppData.theme = theme;
        localStorage.setItem('smartpos-theme', theme);
        initTheme();
    });
});

// =======================
// Dashboard Charts
// =======================
function renderDashboardCharts() {
    const revenueChart = document.getElementById('revenue-chart');
    const weeklyData = [
        { day: 'Mon', revenue: 12500 },
        { day: 'Tue', revenue: 14200 },
        { day: 'Wed', revenue: 11800 },
        { day: 'Thu', revenue: 16500 },
        { day: 'Fri', revenue: 18200 },
        { day: 'Sat', revenue: 21500 },
        { day: 'Sun', revenue: 19800 },
    ];

    const maxRevenue = Math.max(...weeklyData.map(d => d.revenue));

    revenueChart.innerHTML = weeklyData.map(data => {
        const height = (data.revenue / maxRevenue) * 100;
        return `
            <div style="display: flex; flex-direction: column; align-items: center; flex: 1;">
                <div style="width: 40px; height: 160px; background: var(--gray-100); border-radius: 4px; position: relative; display: flex; align-items: flex-end;">
                    <div class="bar-chart-bar" style="height: ${height}%; width: 100%;"></div>
                </div>
                <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 0.5rem;">${data.day}</div>
            </div>
        `;
    }).join('');
}

// =======================
// Notifications
// =======================
function toggleNotifications() {
    showToast('Notifications panel coming soon!', 'info');
}

function toggleUserMenu() {
    showToast('User menu coming soon!', 'info');
}

// =======================
// Initialize Application
// =======================
function init() {
    initTheme();
    updateThemeIcon();
    renderPOSCategories();
    renderDashboardCharts();

    // Event listeners for amount input
    const amountInput = document.getElementById('amount-received');
    if (amountInput) {
        amountInput.addEventListener('input', calculateChange);
    }
}

// Run on DOM ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
