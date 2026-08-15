// =========================================
// SmartPOS - Permission model
// Single source of truth for the granular permission keys the frontend's
// Employee editor (see js/app.js: PERMISSION_KEYS / ROLE_PERMISSION_TEMPLATES)
// reads and writes. Keep this list in sync with that file - it's duplicated
// there only because the browser can't require() this module.
// =========================================

const PERMISSION_KEYS = [
  'viewDashboard',
  'viewSalesHistory',
  'usePOS',
  'manageProducts',
  'manageInventory',
  'manageCustomers',
  'manageSuppliers',
  'manageEmployees',
  // Deliberately NOT offered in the Employee editor UI (there is no
  // perm-viewFinance checkbox in dashboard.html) - Finance & Analytics is
  // effectively Owner-only. It still lives in the schema/permission set so
  // the data model is uniform and future-proof, and so an Owner could grant
  // it directly via the API if that ever becomes a supported feature.
  'viewFinance',
];

// Every permission set to true - what an Owner conceptually has (Owners
// actually bypass permission checks entirely in requirePermission(), this
// object exists only so the Employees table's UI has something consistent
// to display for the Owner row).
const ALL_GRANTED = PERMISSION_KEYS.reduce((acc, key) => {
  acc[key] = true;
  return acc;
}, {});

// Every permission set to false - the safe baseline before a role template
// or an explicit request is applied.
const NONE_GRANTED = PERMISSION_KEYS.reduce((acc, key) => {
  acc[key] = false;
  return acc;
}, {});

// Starting-point templates applied when creating a new employee without an
// explicit `permissions` object in the request body. Mirrors
// ROLE_PERMISSION_TEMPLATES in js/app.js exactly (including that
// viewFinance is never granted by a template - only an Owner, who bypasses
// checks entirely, effectively has it).
const ROLE_TEMPLATES = {
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

function defaultPermissionsForRole(role) {
  return { ...NONE_GRANTED, ...(ROLE_TEMPLATES[role] || {}) };
}

// Caps `requested` so it can never grant more than `ceiling` allows for any
// given key. This is the privilege-escalation guard used by both
// createUser and updateUser: a Manager (whose own ceiling is their own
// permissions object) can never hand out a permission they don't personally
// have, even by editing the request body directly. An Owner's ceiling is
// ALL_GRANTED, so this is a no-op for them.
function sanitizePermissions(requested, ceiling) {
  const safeRequested = requested && typeof requested === 'object' ? requested : {};
  const safeCeiling = ceiling && typeof ceiling === 'object' ? ceiling : {};
  const result = { ...NONE_GRANTED };
  PERMISSION_KEYS.forEach((key) => {
    result[key] = !!safeRequested[key] && !!safeCeiling[key];
  });
  return result;
}

module.exports = {
  PERMISSION_KEYS,
  ALL_GRANTED,
  NONE_GRANTED,
  ROLE_TEMPLATES,
  defaultPermissionsForRole,
  sanitizePermissions,
};
