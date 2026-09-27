require("dotenv").config();
const path = require("path");
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");
const mongoSanitize = require("express-mongo-sanitize");
const hpp = require("hpp");
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

// --- Fail fast on an insecure/missing JWT secret ---
const INSECURE_JWT_SECRETS = new Set([
  "",
  "replace-this-with-a-long-random-secret",
  "secret",
  "changeme",
]);
if (
  !process.env.JWT_SECRET ||
  INSECURE_JWT_SECRETS.has(process.env.JWT_SECRET) ||
  process.env.JWT_SECRET.length < 32
) {
  console.error(
    "\nFATAL: JWT_SECRET is missing, using a known placeholder, or shorter than 32 characters.\n" +
      "Generate a real one and put it in your .env file, e.g.:\n" +
      '  node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"\n',
  );
  process.exit(1);
}

connectDB();

const app = express();

// --- Reverse proxy trust ---
// Default is 1 hop (Render/Railway/nginx in front). Override with the
// TRUST_PROXY env var: "0" or "false" when clients hit this server directly
// (e.g. plain Docker port mapping), a number for N proxy hops, or "true".
let trustProxy = 1;
const rawTrustProxy = process.env.TRUST_PROXY;
if (rawTrustProxy !== undefined && rawTrustProxy !== "") {
  if (rawTrustProxy === "true") trustProxy = true;
  else if (rawTrustProxy === "false") trustProxy = false;
  else if (!Number.isNaN(Number(rawTrustProxy))) trustProxy = Number(rawTrustProxy);
  else trustProxy = rawTrustProxy;
}
app.set("trust proxy", trustProxy);

// --- Security headers ---
// IMPORTANT: `useDefaults: false` + kebab-case directive names on purpose.
// Helmet's built-in defaults include `script-src-attr 'none'`, which blocks
// every inline onclick="" handler in index.html and dashboard.html (that is
// exactly the "Sign In / Register does nothing" error). Listing every
// directive ourselves means no hidden default can sneak back in.
//
// `upgrade-insecure-requests` is intentionally NOT set: when the app is
// opened over plain http (http://192.168.x.x:5000, a Docker host, a LAN
// demo) that directive makes the browser rewrite API calls to https and
// they all fail.
app.use(
  helmet({
    crossOriginEmbedderPolicy: false,
    // Only useful (and only honoured by browsers) over HTTPS. Turn on with
    // ENABLE_HSTS=true once you serve the app behind real HTTPS.
    hsts: process.env.ENABLE_HSTS === "true",
    contentSecurityPolicy: {
      useDefaults: false,
      directives: {
        "default-src": ["'self'"],
        "script-src": ["'self'", "'unsafe-inline'"],
        "script-src-attr": ["'unsafe-inline'"],
        "style-src": ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        "font-src": ["'self'", "https://fonts.gstatic.com", "data:"],
        "img-src": ["'self'", "data:"],
        "connect-src": ["'self'"],
        "object-src": ["'none'"],
        "base-uri": ["'self'"],
        "form-action": ["'self'"],
        "frame-ancestors": ["'none'"],
      },
    },
  }),
);

app.use(express.json({ limit: "2mb" }));

// --- Injection hardening ---
app.use(mongoSanitize());
app.use(hpp());

const allowedOrigins = (process.env.CLIENT_ORIGIN || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const isProduction = process.env.NODE_ENV === "production";
if (isProduction && allowedOrigins.length === 0) {
  console.warn(
    "\nNOTE: NODE_ENV=production and CLIENT_ORIGIN is not set - only same-origin " +
      "requests (frontend served by this server) are allowed. Set CLIENT_ORIGIN " +
      "only if the frontend is hosted on a different origin than this API.\n",
  );
}
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      if (!isProduction && allowedOrigins.length === 0) return callback(null, true);
      return callback(new Error(`CORS blocked for origin: ${origin}`));
    },
    credentials: true,
  }),
);

if (!isProduction) {
  app.use(morgan("dev"));
}

// --- Rate limiting ---
const rateLimitResponse = (message) => (req, res) => {
  res.status(429).json({ success: false, message });
};

// Backstop against scripted abuse. Kept generous because the dashboard
// auto-refreshes every 30s and several employees may share one office IP.
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitResponse("Too many requests. Please try again later."),
});
app.use("/api", generalLimiter);

// Only FAILED logins count toward this limit, so a successful demo login
// (or switching between the 4 demo accounts) never locks anyone out.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitResponse("Too many login attempts. Please wait a few minutes and try again."),
});
app.use("/api/auth/login", loginLimiter);

const paymentLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitResponse("Too many payment attempts. Please wait a few minutes and try again."),
});
app.use("/api/payments", paymentLimiter);

// --- Health check (also used by the Docker HEALTHCHECK) ---
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
// One server / one origin. FRONTEND_DIR can override the location.
const FRONTEND_DIR = process.env.FRONTEND_DIR
  ? path.resolve(process.env.FRONTEND_DIR)
  : path.join(__dirname, "..", "frontend");
app.use(express.static(FRONTEND_DIR));

app.get(/^(?!\/api).*/, (req, res) => {
  res.sendFile(path.join(FRONTEND_DIR, "index.html"));
});

// --- Error handling ---
app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, "0.0.0.0", () => {
  console.log(
    `SmartPOS API running in ${process.env.NODE_ENV || "development"} mode on port ${PORT}`,
  );
  console.log(`Serving frontend from: ${FRONTEND_DIR}`);
});

// Clean shutdown so `docker stop` / Ctrl+C doesn't kill in-flight requests.
const shutdown = () => {
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 5000).unref();
};
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

module.exports = app;
