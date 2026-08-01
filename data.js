// =========================================
// SmartPOS - Local device storage helper (dashboard.html)
// -----------------------------------------------------------------------
// Everything else in the app (products, sales, customers, etc.) lives on
// the real backend and goes through js/api.js. The one exception is the
// Finance & Analytics "planning" figures (balance-sheet inputs, itemized
// costs, budget targets, cash on hand, goals) - the dashboard.html copy on
// that page is explicit that these "aren't tracked by the POS yet" and are
// "saved on this device". This file is that local, per-business storage.
// =========================================

const LocalStore = (() => {
  // Namespaced per logged-in business so switching accounts on the same
  // browser doesn't leak one business's numbers into another's.
  function key(name) {
    const business =
      (typeof Auth !== "undefined" && Auth.getBusiness()) || null;
    const businessId = (business && (business._id || business.id)) || "guest";
    return `smartpos_local_${businessId}_${name}`;
  }

  function get(name, fallback) {
    try {
      const raw = localStorage.getItem(key(name));
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      return fallback;
    }
  }

  function set(name, value) {
    localStorage.setItem(key(name), JSON.stringify(value));
    return value;
  }

  return { get, set };
})();

// Reasonable starting palette offered in the "Manage Categories" color
// picker isn't required (the input is a native <input type="color">), but
// kept here as a small shared constant in case it's ever needed elsewhere.
const DEFAULT_CATEGORY_COLOR = "#3b82f6";

window.SmartPOSData = {
  business: {
    name: "SmartPOS Mini Mart",
    address: "Quezon City, Philippines",
    phone: "+63 912 345 6789",
    tax: 12,
    currency: "₱",
  },

  categories: [
    {
      id: "all",
      name: "All Products",
      icon: "🛒",
    },
    {
      id: "beverages",
      name: "Beverages",
      icon: "🥤",
    },
    {
      id: "snacks",
      name: "Snacks",
      icon: "🍪",
    },
    {
      id: "instant",
      name: "Instant Foods",
      icon: "🍜",
    },
    {
      id: "personal",
      name: "Personal Care",
      icon: "🧴",
    },
    {
      id: "household",
      name: "Household",
      icon: "🧹",
    },
    {
      id: "frozen",
      name: "Frozen Foods",
      icon: "🧊",
    },
  ],

  products: [
    {
      id: 1,
      icon: "🥤",
      name: "Coca-Cola 500ml",
      sku: "BEV-001",
      barcode: "480001001",
      category: "beverages",
      cost: 18,
      price: 25,
      stock: 80,
      minStock: 15,
      unit: "bottle",
      favorite: true,
    },

    {
      id: 2,
      icon: "🥤",
      name: "Pepsi 500ml",
      sku: "BEV-002",
      barcode: "480001002",
      category: "beverages",
      cost: 18,
      price: 25,
      stock: 65,
      minStock: 15,
      unit: "bottle",
      favorite: true,
    },

    {
      id: 3,
      icon: "☕",
      name: "Nescafe Original",
      sku: "BEV-003",
      barcode: "480001003",
      category: "beverages",
      cost: 7,
      price: 10,
      stock: 120,
      minStock: 25,
      unit: "sachet",
      favorite: true,
    },

    {
      id: 4,
      icon: "🍪",
      name: "Oreo Cookies",
      sku: "SNK-001",
      barcode: "480002001",
      category: "snacks",
      cost: 18,
      price: 25,
      stock: 50,
      minStock: 10,
      unit: "pack",
      favorite: true,
    },

    {
      id: 5,
      icon: "🍫",
      name: "KitKat",
      sku: "SNK-002",
      barcode: "480002002",
      category: "snacks",
      cost: 14,
      price: 20,
      stock: 70,
      minStock: 15,
      unit: "bar",
      favorite: false,
    },

    {
      id: 6,
      icon: "🍜",
      name: "Lucky Me Pancit Canton",
      sku: "INS-001",
      barcode: "480003001",
      category: "instant",
      cost: 13,
      price: 18,
      stock: 140,
      minStock: 30,
      unit: "pack",
      favorite: true,
    },

    {
      id: 7,
      icon: "🍜",
      name: "Lucky Me Beef Noodles",
      sku: "INS-002",
      barcode: "480003002",
      category: "instant",
      cost: 14,
      price: 20,
      stock: 85,
      minStock: 20,
      unit: "cup",
      favorite: false,
    },

    {
      id: 8,
      icon: "🧴",
      name: "Palmolive Shampoo",
      sku: "PER-001",
      barcode: "480004001",
      category: "personal",
      cost: 6,
      price: 8,
      stock: 200,
      minStock: 40,
      unit: "sachet",
      favorite: false,
    },

    {
      id: 9,
      icon: "🪥",
      name: "Colgate Toothpaste",
      sku: "PER-002",
      barcode: "480004002",
      category: "personal",
      cost: 48,
      price: 65,
      stock: 42,
      minStock: 10,
      unit: "tube",
      favorite: false,
    },

    {
      id: 10,
      icon: "🧼",
      name: "Safeguard Soap",
      sku: "PER-003",
      barcode: "480004003",
      category: "personal",
      cost: 26,
      price: 35,
      stock: 95,
      minStock: 15,
      unit: "bar",
      favorite: true,
    },

    {
      id: 11,
      icon: "🧹",
      name: "Surf Powder 500g",
      sku: "HOU-001",
      barcode: "480005001",
      category: "household",
      cost: 48,
      price: 60,
      stock: 38,
      minStock: 10,
      unit: "pack",
      favorite: false,
    },

    {
      id: 12,
      icon: "🧴",
      name: "Joy Dishwashing Liquid",
      sku: "HOU-002",
      barcode: "480005002",
      category: "household",
      cost: 62,
      price: 75,
      stock: 21,
      minStock: 10,
      unit: "bottle",
      favorite: false,
    },

    {
      id: 13,
      icon: "🍦",
      name: "Ice Cream Cup",
      sku: "FRZ-001",
      barcode: "480006001",
      category: "frozen",
      cost: 42,
      price: 55,
      stock: 18,
      minStock: 5,
      unit: "cup",
      favorite: true,
    },

    {
      id: 14,
      icon: "🐔",
      name: "Frozen Chicken",
      sku: "FRZ-002",
      barcode: "480006002",
      category: "frozen",
      cost: 175,
      price: 210,
      stock: 9,
      minStock: 5,
      unit: "kg",
      favorite: false,
    },

    {
      id: 15,
      icon: "🥛",
      name: "Fresh Milk 1L",
      sku: "BEV-004",
      barcode: "480001004",
      category: "beverages",
      cost: 68,
      price: 85,
      stock: 0,
      minStock: 10,
      unit: "carton",
      favorite: false,
    },
  ],
};

/* ==========================================================================
   data.js — Seed data
   First-run sample data for a small café/store so the dashboard has
   something meaningful to render before real transactions exist.
   ========================================================================== */

const SEED_DATA = {
  business: {
    name: "SmartPOS Demo Café",
    currency: "₱",
    taxRate: 12,
    plan: "Professional",
    subscriptionStatus: "active", // active | expired
    subscriptionExpiry: "2026-12-31",
  },

  currentUser: {
    id: "usr-0001",
    name: "Jordan Cruz",
    role: "owner", // owner | manager | cashier | inventory_staff
    email: "jordan@smartpos.demo",
  },

  categories: [
    { id: "cat-0001", name: "Beverages", color: "#3b82f6" },
    { id: "cat-0002", name: "Pastries", color: "#f59e0b" },
    { id: "cat-0003", name: "Sandwiches", color: "#10b981" },
    { id: "cat-0004", name: "Snacks", color: "#8b5cf6" },
    { id: "cat-0005", name: "Merchandise", color: "#6b7280" },
  ],

  products: [
    {
      id: "prd-0001",
      name: "Iced Caramel Latte",
      sku: "BEV-001",
      barcode: "480011122233",
      category: "cat-0001",
      cost: 55,
      price: 130,
      stock: 42,
      minStock: 15,
      unit: "cup",
      description: "Espresso, caramel syrup, milk over ice.",
    },
    {
      id: "prd-0002",
      name: "Hot Americano",
      sku: "BEV-002",
      barcode: "480011122234",
      category: "cat-0001",
      cost: 30,
      price: 95,
      stock: 60,
      minStock: 15,
      unit: "cup",
      description: "Double shot espresso with hot water.",
    },
    {
      id: "prd-0003",
      name: "Matcha Latte",
      sku: "BEV-003",
      barcode: "480011122235",
      category: "cat-0001",
      cost: 60,
      price: 145,
      stock: 8,
      minStock: 10,
      unit: "cup",
      description: "Ceremonial-grade matcha with steamed milk.",
    },
    {
      id: "prd-0004",
      name: "Butter Croissant",
      sku: "PST-001",
      barcode: "480022233344",
      category: "cat-0002",
      cost: 35,
      price: 85,
      stock: 24,
      minStock: 10,
      unit: "piece",
      description: "Flaky all-butter croissant.",
    },
    {
      id: "prd-0005",
      name: "Chocolate Muffin",
      sku: "PST-002",
      barcode: "480022233345",
      category: "cat-0002",
      cost: 28,
      price: 75,
      stock: 3,
      minStock: 8,
      unit: "piece",
      description: "Double chocolate chip muffin.",
    },
    {
      id: "prd-0006",
      name: "Cinnamon Roll",
      sku: "PST-003",
      barcode: "480022233346",
      category: "cat-0002",
      cost: 32,
      price: 80,
      stock: 0,
      minStock: 8,
      unit: "piece",
      description: "Warm cinnamon roll with icing.",
    },
    {
      id: "prd-0007",
      name: "Ham & Cheese Panini",
      sku: "SND-001",
      barcode: "480033344455",
      category: "cat-0003",
      cost: 65,
      price: 150,
      stock: 16,
      minStock: 8,
      unit: "piece",
      description: "Grilled panini with ham and cheddar.",
    },
    {
      id: "prd-0008",
      name: "Chicken Pesto Sandwich",
      sku: "SND-002",
      barcode: "480033344456",
      category: "cat-0003",
      cost: 70,
      price: 165,
      stock: 12,
      minStock: 8,
      unit: "piece",
      description: "Grilled chicken with basil pesto.",
    },
    {
      id: "prd-0009",
      name: "Kettle Chips",
      sku: "SNK-001",
      barcode: "480044455566",
      category: "cat-0004",
      cost: 18,
      price: 45,
      stock: 50,
      minStock: 15,
      unit: "pack",
      description: "Sea salt kettle-cooked chips.",
    },
    {
      id: "prd-0010",
      name: "Trail Mix",
      sku: "SNK-002",
      barcode: "480044455567",
      category: "cat-0004",
      cost: 25,
      price: 60,
      stock: 30,
      minStock: 12,
      unit: "pack",
      description: "Nuts, seeds and dried fruit.",
    },
    {
      id: "prd-0011",
      name: "Ceramic Mug",
      sku: "MRC-001",
      barcode: "480055566677",
      category: "cat-0005",
      cost: 90,
      price: 220,
      stock: 18,
      minStock: 5,
      unit: "piece",
      description: "Branded 350ml ceramic mug.",
    },
    {
      id: "prd-0012",
      name: "Tote Bag",
      sku: "MRC-002",
      barcode: "480055566678",
      category: "cat-0005",
      cost: 70,
      price: 180,
      stock: 5,
      minStock: 5,
      unit: "piece",
      description: "Canvas tote with logo print.",
    },
  ],

  customers: [
    {
      id: "cus-0001",
      name: "Maria Santos",
      phone: "0917 123 4567",
      email: "maria.santos@email.com",
      membership: "gold",
      totalSpent: 18420,
      visits: 34,
      joined: "2025-02-10",
    },
    {
      id: "cus-0002",
      name: "John Reyes",
      phone: "0918 234 5678",
      email: "john.reyes@email.com",
      membership: "silver",
      totalSpent: 4210,
      visits: 9,
      joined: "2025-08-21",
    },
    {
      id: "cus-0003",
      name: "Anna Cruz",
      phone: "0919 345 6789",
      email: "anna.cruz@email.com",
      membership: "platinum",
      totalSpent: 52680,
      visits: 71,
      joined: "2024-11-03",
    },
    {
      id: "cus-0004",
      name: "Mark Dela Peña",
      phone: "0920 456 7890",
      email: "mark.delapena@email.com",
      membership: "silver",
      totalSpent: 1560,
      visits: 4,
      joined: "2026-01-15",
    },
  ],

  suppliers: [
    {
      id: "sup-0001",
      name: "Carlos Villanueva",
      company: "Luzon Coffee Traders",
      contactPerson: "Carlos Villanueva",
      email: "carlos@luzoncoffee.ph",
      phone: "0917 555 1010",
      address: "Baguio City, Benguet",
      active: true,
    },
    {
      id: "sup-0002",
      name: "Grace Tan",
      company: "Manila Bakers Supply Co.",
      contactPerson: "Grace Tan",
      email: "grace@manilabakers.ph",
      phone: "0918 555 2020",
      address: "Quezon City, Metro Manila",
      active: true,
    },
    {
      id: "sup-0003",
      name: "Ramon Ferrer",
      company: "Southern Foods Distribution",
      contactPerson: "Ramon Ferrer",
      email: "ramon@southernfoods.ph",
      phone: "0919 555 3030",
      address: "Calamba, Laguna",
      active: false,
    },
  ],

  employees: [
    {
      id: "usr-0001",
      name: "Jordan Cruz",
      email: "jordan@smartpos.demo",
      role: "owner",
      phone: "0917 000 0001",
      status: "active",
      permissions: [
        "viewDashboard",
        "viewSalesHistory",
        "usePOS",
        "manageProducts",
        "manageInventory",
        "manageCustomers",
        "manageSuppliers",
        "manageEmployees",
        "viewFinance",
        "always",
      ],
    },
    {
      id: "usr-0002",
      name: "Bianca Lopez",
      email: "bianca@smartpos.demo",
      role: "manager",
      phone: "0917 000 0002",
      status: "active",
      permissions: [
        "viewDashboard",
        "viewSalesHistory",
        "usePOS",
        "manageProducts",
        "manageInventory",
        "manageCustomers",
        "manageSuppliers",
        "viewFinance",
        "always",
      ],
    },
    {
      id: "usr-0003",
      name: "Diego Ramos",
      email: "diego@smartpos.demo",
      role: "cashier",
      phone: "0917 000 0003",
      status: "active",
      permissions: ["viewDashboard", "usePOS", "always"],
    },
    {
      id: "usr-0004",
      name: "Elena Ocampo",
      email: "elena@smartpos.demo",
      role: "inventory_staff",
      phone: "0917 000 0004",
      status: "inactive",
      permissions: ["manageInventory", "manageProducts", "always"],
    },
  ],

  sales: [
    {
      id: "SP-100231",
      date: "2026-08-01T08:12:00",
      customer: "Maria Santos",
      customerId: "cus-0001",
      cashier: "Diego Ramos",
      payment: "Cash",
      status: "Completed",
      items: [
        {
          productId: "prd-0001",
          name: "Iced Caramel Latte",
          qty: 2,
          price: 130,
        },
        { productId: "prd-0004", name: "Butter Croissant", qty: 1, price: 85 },
      ],
      subtotal: 345,
      discount: 0,
      tax: 41.4,
      total: 386.4,
    },
    {
      id: "SP-100232",
      date: "2026-08-01T08:45:00",
      customer: "Walk-in",
      customerId: null,
      cashier: "Diego Ramos",
      payment: "GCash",
      status: "Completed",
      items: [
        { productId: "prd-0002", name: "Hot Americano", qty: 1, price: 95 },
      ],
      subtotal: 95,
      discount: 0,
      tax: 11.4,
      total: 106.4,
    },
    {
      id: "SP-100233",
      date: "2026-08-01T09:30:00",
      customer: "Anna Cruz",
      customerId: "cus-0003",
      cashier: "Bianca Lopez",
      payment: "Card",
      status: "Completed",
      items: [
        {
          productId: "prd-0008",
          name: "Chicken Pesto Sandwich",
          qty: 2,
          price: 165,
        },
        { productId: "prd-0009", name: "Kettle Chips", qty: 2, price: 45 },
      ],
      subtotal: 420,
      discount: 42,
      tax: 45.36,
      total: 423.36,
    },
    {
      id: "SP-100234",
      date: "2026-07-31T14:05:00",
      customer: "Walk-in",
      customerId: null,
      cashier: "Diego Ramos",
      payment: "Cash",
      status: "Completed",
      items: [
        { productId: "prd-0011", name: "Ceramic Mug", qty: 1, price: 220 },
      ],
      subtotal: 220,
      discount: 0,
      tax: 26.4,
      total: 246.4,
    },
    {
      id: "SP-100235",
      date: "2026-07-31T16:20:00",
      customer: "John Reyes",
      customerId: "cus-0002",
      cashier: "Bianca Lopez",
      payment: "Maya",
      status: "Refunded",
      items: [
        { productId: "prd-0003", name: "Matcha Latte", qty: 1, price: 145 },
      ],
      subtotal: 145,
      discount: 0,
      tax: 17.4,
      total: 162.4,
    },
    {
      id: "SP-100236",
      date: "2026-07-30T10:00:00",
      customer: "Walk-in",
      customerId: null,
      cashier: "Diego Ramos",
      payment: "Cash",
      status: "Completed",
      items: [
        { productId: "prd-0005", name: "Chocolate Muffin", qty: 3, price: 75 },
      ],
      subtotal: 225,
      discount: 0,
      tax: 27,
      total: 252,
    },
  ],

  movements: [
    {
      id: "mv-0001",
      date: "2026-07-29T09:00:00",
      productId: "prd-0006",
      product: "Cinnamon Roll",
      type: "out",
      qty: 8,
      reference: "SP-100210",
      by: "System",
    },
    {
      id: "mv-0002",
      date: "2026-07-28T11:00:00",
      productId: "prd-0003",
      product: "Matcha Latte",
      type: "in",
      qty: 20,
      reference: "PO-3391",
      by: "Jordan Cruz",
    },
    {
      id: "mv-0003",
      date: "2026-07-27T15:30:00",
      productId: "prd-0005",
      product: "Chocolate Muffin",
      type: "adjustment",
      qty: -2,
      reference: "Spoilage",
      by: "Elena Ocampo",
    },
  ],

  costItems: [
    { id: "cst-0001", name: "Rent", amount: 35000 },
    { id: "cst-0002", name: "Utilities", amount: 8500 },
    { id: "cst-0003", name: "Staff wages", amount: 62000 },
  ],

  goals: [
    { id: "gl-0001", text: "Hit ₱700,000 in monthly revenue", done: false },
    { id: "gl-0002", text: "Cut spoilage waste below 2%", done: false },
    { id: "gl-0003", text: "Onboard 50 new loyalty members", done: true },
  ],

  financeInputs: {
    totalAssets: 850000,
    totalLiabilities: 220000,
    totalEquity: 630000,
    totalInvestment: 500000,
    currentAssets: 310000,
    currentLiabilities: 95000,
    interestExpense: 3200,
    otherIncome: 2000,
    otherExpenses: 1500,
    fixedCosts: 105500,
  },

  budget: { revenueTarget: 700000, expenseTarget: 380000 },
  cashOnHand: 145000,

  heldOrders: [],
  notificationsSeen: false,
};
