const mongoose = require("mongoose");

// Connects to MongoDB Atlas (or any MongoDB instance) using the MONGO_URI env var.
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI);
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`MongoDB connection error: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;

/* ==========================================================================
   db.js — SmartPOS local persistence layer
   Wraps localStorage as a tiny "database". All other modules read/write
   through this object so storage keys and JSON handling live in one place.
   ========================================================================== */

const DB = (() => {
  const STORAGE_KEY = "smartpos_db_v1";

  function _read() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (err) {
      console.error("DB: failed to read storage", err);
      return null;
    }
  }

  function _write(state) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      return true;
    } catch (err) {
      console.error("DB: failed to write storage", err);
      return false;
    }
  }

  let state = _read();

  function init(seed) {
    if (!state) {
      state = JSON.parse(JSON.stringify(seed));
      _write(state);
    } else {
      // Fill in any collections that a newer seed introduced but an older
      // saved snapshot doesn't have yet, without touching existing data.
      Object.keys(seed).forEach((key) => {
        if (!(key in state)) state[key] = seed[key];
      });
      _write(state);
    }
    return state;
  }

  function get(collection) {
    return state ? state[collection] : undefined;
  }

  function set(collection, value) {
    if (!state) state = {};
    state[collection] = value;
    _write(state);
    return value;
  }

  function update(collection, mutatorFn) {
    const current = get(collection);
    const next = mutatorFn(current);
    return set(collection, next !== undefined ? next : current);
  }

  function nextId(prefix) {
    const key = "_seq_" + prefix;
    if (!state._sequences) state._sequences = {};
    const n = (state._sequences[key] || 0) + 1;
    state._sequences[key] = n;
    _write(state);
    return prefix + "-" + String(n).padStart(4, "0");
  }

  function resetAll(seed) {
    state = JSON.parse(JSON.stringify(seed));
    _write(state);
    return state;
  }

  return { init, get, set, update, nextId, resetAll };
})();
