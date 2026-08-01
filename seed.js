/**
 * Seeds a demo business with an owner, employees, categories, products,
 * customers and suppliers.
 *
 * Run:
 * npm run seed
 *
 * WARNING: this wipes ALL businesses/users/products/etc. in the database
 * before recreating the demo data - only run this against a dev database.
 */

require("dotenv").config();
const mongoose = require("mongoose");
const connectDB = require("../config/db");

const Business = require("../models/Business");
const User = require("../models/User");
const Category = require("../models/Category");
const Product = require("../models/Product");
const Customer = require("../models/Customer");
const Supplier = require("../models/Supplier");
const {
  ALL_GRANTED,
  defaultPermissionsForRole,
} = require("../utils/permissions");

const OWNER_EMAIL = "admin@smartpos.com";

const run = async () => {
  await connectDB();

  // Delete previous demo data
  const existingOwner = await User.findOne({ email: OWNER_EMAIL });

  if (existingOwner) {
    console.log("Removing previous demo data...");

    await Business.deleteMany({});
    await User.deleteMany({});
    await Category.deleteMany({});
    await Product.deleteMany({});
    await Customer.deleteMany({});
    await Supplier.deleteMany({});
  }

  // --- Create Business + Owner together ---
  // Business.ownerUser and User.business are BOTH required fields, so we
  // can't save either document first without the other already existing.
  // Fix: pre-generate the owner's _id, create the Business with it, THEN
  // create the User using that same _id. No circular save-then-patch needed.
  const ownerId = new mongoose.Types.ObjectId();

  const business = await Business.create({
    name: "SmartPOS Demo Cafe",
    ownerUser: ownerId,
    subscriptionPlan: "professional",
    subscriptionStatus: "active",
    // Give the demo account a normal-looking active subscription window
    // instead of leaving subscriptionExpiresAt empty, so the Settings ->
    // Subscription card shows a real "Renews on <date>" status.
    subscriptionExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    lastPaymentReference: "SEED-DEMO-DATA",
    lastPaymentAt: new Date(),
    maxUsers: 15,
    maxBranches: 3,
  });

  const owner = new User({
    _id: ownerId,
    business: business._id,
    name: "Admin User",
    email: OWNER_EMAIL,
    password: "password123",
    role: "owner",
    permissions: ALL_GRANTED,
  });

  await owner.save();

  // Create employees - each gets the standard starting-template permissions
  // for their role (fully editable afterward from Employees -> Edit in the app).
  await User.create([
    {
      business: business._id,
      name: "Jane Manager",
      email: "manager@smartpos.com",
      password: "password123",
      role: "manager",
      permissions: defaultPermissionsForRole("manager"),
      createdBy: owner._id,
    },
    {
      business: business._id,
      name: "Bob Cashier",
      email: "cashier@smartpos.com",
      password: "password123",
      role: "cashier",
      permissions: defaultPermissionsForRole("cashier"),
      createdBy: owner._id,
    },
    {
      business: business._id,
      name: "Alice Staff",
      email: "staff@smartpos.com",
      password: "password123",
      role: "inventory_staff",
      permissions: defaultPermissionsForRole("inventory_staff"),
      createdBy: owner._id,
    },
  ]);

  // Categories
  const categories = await Category.insertMany([
    { business: business._id, name: "Beverages", color: "#3b82f6" },
    { business: business._id, name: "Food", color: "#10b981" },
    { business: business._id, name: "Snacks", color: "#f59e0b" },
    { business: business._id, name: "Desserts", color: "#ec4899" },
  ]);

  const catId = (name) => categories.find((c) => c.name === name)._id;

  // Products
  await Product.insertMany([
    {
      business: business._id,
      name: "Classic Americano",
      sku: "BEV-001",
      barcode: "1234567890123",
      category: catId("Beverages"),
      costPrice: 35,
      sellingPrice: 85,
      unit: "cup",
      stock: 150,
      minStock: 20,
    },
    {
      business: business._id,
      name: "Caramel Macchiato",
      sku: "BEV-002",
      barcode: "1234567890124",
      category: catId("Beverages"),
      costPrice: 45,
      sellingPrice: 120,
      unit: "cup",
      stock: 100,
      minStock: 15,
    },
    {
      business: business._id,
      name: "Milk Tea Classic",
      sku: "BEV-004",
      barcode: "1234567890126",
      category: catId("Beverages"),
      costPrice: 30,
      sellingPrice: 75,
      unit: "cup",
      stock: 200,
      minStock: 30,
    },
    {
      business: business._id,
      name: "Club Sandwich",
      sku: "FOO-001",
      barcode: "1234567890128",
      category: catId("Food"),
      costPrice: 65,
      sellingPrice: 145,
      unit: "piece",
      stock: 45,
      minStock: 10,
    },
    {
      business: business._id,
      name: "French Fries",
      sku: "SNK-001",
      barcode: "1234567890130",
      category: catId("Snacks"),
      costPrice: 25,
      sellingPrice: 65,
      unit: "serving",
      stock: 95,
      minStock: 20,
    },
    {
      business: business._id,
      name: "Cheesecake",
      sku: "DES-002",
      barcode: "1234567890132",
      category: catId("Desserts"),
      costPrice: 65,
      sellingPrice: 165,
      unit: "slice",
      stock: 15,
      minStock: 5,
    },
    {
      business: business._id,
      name: "Brownie",
      sku: "DES-003",
      barcode: "1234567890135",
      category: catId("Desserts"),
      costPrice: 35,
      sellingPrice: 85,
      unit: "piece",
      stock: 0,
      minStock: 8,
    },
  ]);

  // Customers
  await Customer.insertMany([
    {
      business: business._id,
      name: "John Smith",
      email: "john@email.com",
      phone: "09171234567",
      membership: "platinum",
      points: 2580,
      totalSpent: 28500,
    },
    {
      business: business._id,
      name: "Sarah Johnson",
      email: "sarah@email.com",
      phone: "09181234567",
      membership: "gold",
      points: 1250,
      totalSpent: 18200,
    },
    {
      business: business._id,
      name: "Mike Davis",
      email: "mike@email.com",
      phone: "09191234567",
      membership: "silver",
      points: 450,
      totalSpent: 6500,
    },
  ]);

  // Suppliers
  await Supplier.insertMany([
    {
      business: business._id,
      name: "Coffee Beans Corp",
      company: "Coffee Beans Corporation",
      contactPerson: "Maria Santos",
      email: "maria@coffeebeans.com",
      phone: "09281234567",
      address: "123 Coffee Lane, Makati City",
    },
    {
      business: business._id,
      name: "Fresh Dairy Inc",
      company: "Fresh Dairy Incorporated",
      contactPerson: "Pedro Reyes",
      email: "pedro@freshdairy.com",
      phone: "09291234567",
      address: "456 Milk Street, Quezon City",
    },
  ]);

  console.log("\n=====================================");
  console.log("SmartPOS Demo Data Created!");
  console.log("=====================================");
  console.log("Owner Login");
  console.log("Email: admin@smartpos.com");
  console.log("Password: password123");
  console.log("=====================================");
  console.log("Manager:   manager@smartpos.com  / password123");
  console.log("Cashier:   cashier@smartpos.com   / password123");
  console.log("Inventory: staff@smartpos.com     / password123");
  console.log("=====================================");

  await mongoose.connection.close();
  process.exit(0);
};

run().catch(async (err) => {
  console.error(err);
  await mongoose.connection.close();
  process.exit(1);
});
