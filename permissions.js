/**
 * Granular, Owner-editable permission system.
 *
 * The 4 roles (owner/manager/cashier/inventory_staff) still exist as a
 * convenience "starting template" when the Owner creates an employee, but
 * actual access control is driven by these individual boolean flags instead
 * of the role name - so the Owner can grant or take away exactly the
 * capabilities each employee needs, per the SmartPOS spec:
 *
 *   Manager  -> Dashboard, Sales History, manage Products, manage Inventory,
 *               manage Customers, manage Suppliers, manage Employees
 *   Cashier  -> Dashboard, Sales History, POS Terminal, manage Inventory
 *   Staff    -> Dashboard, Sales History, manage Inventory
 *
 * The Owner is never gated by this object - see requirePermission() in
 * middleware/auth.js, which always lets an Owner through. The Owner is also
 * the only account created directly by a paid registration
 * (see authController.registerBusiness), so ultimately every permission
 * granted to anyone else traces back to something the paying Owner chose
 * to hand out.
 */

// The full list of permission keys that exist in this system. Anything sent
// in a request body that isn't in this list is ignored (see userController.js)
// so a request can never smuggle in an unknown/typo'd permission flag.
const PERMISSION_KEYS = [
  'viewDashboard',
  'viewSalesHistory',
  'usePOS',
  'manageProducts',
  'manageInventory',
  'manageCustomers',
  'manageSuppliers',
  'manageEmployees',
];

// Every permission granted - used for the Owner's own (informational) record,
// and as the "ceiling" nothing can exceed.
const ALL_GRANTED = PERMISSION_KEYS.reduce((acc, key) => ({ ...acc, [key]: true }), {});

// Every permission denied - the safe default for a brand-new role with no template.
const NONE_GRANTED = PERMISSION_KEYS.reduce((acc, key) => ({ ...acc, [key]: false }), {});

// Sensible starting templates per role, applied when an Owner (or a Manager
// with manageEmployees rights) creates a new employee without specifying
// permissions explicitly. These are only a starting point - every checkbox
// stays fully editable, both at creation and later via "Edit".
const ROLE_TEMPLATES = {
  manager: {
    ...NONE_GRANTED,
    viewDashboard: true,
    viewSalesHistory: true,
    manageProducts: true,
    manageInventory: true,
    manageCustomers: true,
    manageSuppliers: true,
    manageEmployees: true,
  },
  cashier: {
    ...NONE_GRANTED,
    viewDashboard: true,
    viewSalesHistory: true,
    usePOS: true,
    manageInventory: true,
  },
  inventory_staff: {
    ...NONE_GRANTED,
    viewDashboard: true,
    viewSalesHistory: true,
    manageInventory: true,
  },
};

function defaultPermissionsForRole(role) {
  return { ...(ROLE_TEMPLATES[role] || NONE_GRANTED) };
}

/**
 * Given a set of requested permissions and the granter's own permission
 * ceiling, returns a sanitized permissions object that:
 *   - only contains recognized keys
 *   - never grants a permission the granter doesn't have themselves
 *     (privilege-escalation guard - an Owner has no ceiling, everyone else
 *     can only ever hand out a subset of what they were personally granted)
 */
function sanitizePermissions(requested, granterCeiling) {
  const ceiling = granterCeiling || ALL_GRANTED; // Owner calls this with no ceiling -> unrestricted
  const result = {};
  for (const key of PERMISSION_KEYS) {
    const requestedValue = !!(requested && requested[key]);
    const allowed = ceiling[key] !== false; // Owner ceiling is ALL_GRANTED, so this is always true for Owner
    result[key] = requestedValue && allowed;
  }
  return result;
}

module.exports = { PERMISSION_KEYS, ALL_GRANTED, NONE_GRANTED, ROLE_TEMPLATES, defaultPermissionsForRole, sanitizePermissions };
