require("dotenv").config();
const path = require("path");
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");
const connectDB = require("./config/db");
const { notFound, errorHandler } = require("./middleware/error");

// Route imports
const authRoutes = require("./routes/authRoutes");
const userRoutes = require("./routes/userRoutes");
const categoryRoutes = require("./routes/categoryRoutes");
const productRoutes = require("./routes/productRoutes");
const customerRoutes = require("./routes/customerRoutes");
const supplierRoutes = require("./routes/supplierRoutes");
const saleRoutes = require("./routes/saleRoutes");
const inventoryRoutes = require("./routes/inventoryRoutes");
const dashboardRoutes = require("./routes/dashboardRoutes");
const businessRoutes = require("./routes/businessRoutes");
const paymentRoutes = require("./routes/paymentRoutes");

connectDB();

const app = express();

// --- Global middleware ---
// crossOriginEmbedderPolicy/contentSecurityPolicy off so the plain frontend
// (inline onclick handlers, external Google Fonts, etc.) renders without tweaks.
app.use(
  helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }),
);
app.use(express.json({ limit: "2mb" }));

const allowedOrigins = (process.env.CLIENT_ORIGIN || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no Origin header (curl, Postman, mobile apps,
      // and browsers opening the frontend via file://) and any explicitly
      // whitelisted origin from CLIENT_ORIGIN.
      if (
        !origin ||
        allowedOrigins.length === 0 ||
        allowedOrigins.includes(origin)
      ) {
        return callback(null, true);
      }
      return callback(new Error(`CORS blocked for origin: ${origin}`));
    },
    credentials: true,
  }),
);

if (process.env.NODE_ENV !== "production") {
  app.use(morgan("dev"));
}

// Basic rate limiting (protects auth endpoints from brute force)
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 100 });
app.use("/api/auth", authLimiter);
app.use("/api/payments", authLimiter);

// --- Health check ---
app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "SmartPOS API is running",
    timestamp: new Date().toISOString(),
  });
});

// --- API routes ---
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/products", productRoutes);
app.use("/api/customers", customerRoutes);
app.use("/api/suppliers", supplierRoutes);
app.use("/api/sales", saleRoutes);
app.use("/api/inventory", inventoryRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/business", businessRoutes);
app.use("/api/payments", paymentRoutes);

// --- Serve the frontend (index.html, dashboard.html, css/, js/) ---
// This lets the whole app run from ONE server/ONE origin: http://localhost:5000
const FRONTEND_DIR = path.join(__dirname, "..", "frontend");
app.use(express.static(FRONTEND_DIR));

// Any non-/api route that isn't a static file falls back to index.html
// (keeps direct links like http://localhost:5000/dashboard.html working too,
// since that file exists as a real static file and will be served above).
app.get(/^(?!\/api).*/, (req, res) => {
  res.sendFile(path.join(FRONTEND_DIR, "index.html"));
});

// --- Error handling (only reaches here for /api/* routes that didn't match) ---
app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(
    `SmartPOS API running in ${process.env.NODE_ENV || "development"} mode on port ${PORT}`,
  );
});

module.exports = app;

/* ==========================================================================
   server.js — Simulated "server"
   SmartPOS runs fully client-side for this demo, so this module stands in
   for the parts a real backend would own: the signed-in session, role
   permission templates, and subscription-gating rules. Everything is still
   backed by DB (localStorage) rather than a network call.
   ========================================================================== */

const Server = (() => {
  const ROLE_TEMPLATES = {
    owner: [
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
    manager: [
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
    cashier: ["viewDashboard", "usePOS", "always"],
    inventory_staff: [
      "viewDashboard",
      "manageInventory",
      "manageProducts",
      "always",
    ],
  };

  function getCurrentUser() {
    return DB.get("currentUser");
  }

  function getSessionPermissions() {
    const user = getCurrentUser();
    if (!user) return [];
    if (user.role === "owner") return ROLE_TEMPLATES.owner;
    const employees = DB.get("employees") || [];
    const record = employees.find((e) => e.id === user.id);
    return (
      (record && record.permissions) || ROLE_TEMPLATES[user.role] || ["always"]
    );
  }

  function can(permission) {
    if (!permission || permission === "always") return true;
    return getSessionPermissions().includes(permission);
  }

  function roleTemplate(role) {
    return ROLE_TEMPLATES[role] || [];
  }

  function getSubscription() {
    return DB.get("business").subscriptionStatus;
  }

  function isSubscriptionExpired() {
    return getSubscription() === "expired";
  }

  function renewSubscription() {
    DB.update("business", (b) => {
      b.subscriptionStatus = "active";
      const d = new Date();
      d.setFullYear(d.getFullYear() + 1);
      b.subscriptionExpiry = d.toISOString().slice(0, 10);
      return b;
    });
  }

  function logout() {
    // In a real backend this would invalidate the session token. Here we
    // simply signal the UI layer to show a signed-out state.
    return true;
  }

  return {
    ROLE_TEMPLATES,
    getCurrentUser,
    getSessionPermissions,
    can,
    roleTemplate,
    getSubscription,
    isSubscriptionExpired,
    renewSubscription,
    logout,
  };
})();
