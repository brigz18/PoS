const asyncHandler = require('../utils/asyncHandler');
const Category = require('../models/Category');
const Product = require('../models/Product');

// @desc    List all categories for the logged-in business
// @route   GET /api/categories
// @access  Private (requires manageProducts permission, or Owner)
const getCategories = asyncHandler(async (req, res) => {
  const categories = await Category.find({ business: req.business._id }).sort({ name: 1 });
  res.json({ success: true, count: categories.length, data: categories });
});

// @desc    Create a category
// @route   POST /api/categories
// @access  Private (requires manageProducts permission, or Owner)
const createCategory = asyncHandler(async (req, res) => {
  const { name, color } = req.body;
  if (!name || !name.trim()) {
    res.status(400);
    throw new Error('Category name is required');
  }

  const category = await Category.create({
    business: req.business._id,
    name: name.trim(),
    color: color || undefined,
  });
  res.status(201).json({ success: true, data: category });
});

// @desc    Update a category
// @route   PUT /api/categories/:id
// @access  Private (requires manageProducts permission, or Owner)
const updateCategory = asyncHandler(async (req, res) => {
  const category = await Category.findOne({ _id: req.params.id, business: req.business._id });
  if (!category) {
    res.status(404);
    throw new Error('Category not found');
  }

  const { name, color } = req.body;
  if (name !== undefined) {
    if (!name.trim()) {
      res.status(400);
      throw new Error('Category name cannot be empty');
    }
    category.name = name.trim();
  }
  if (color !== undefined) category.color = color;

  await category.save();
  res.json({ success: true, data: category });
});

// @desc    Delete a category
// @route   DELETE /api/categories/:id
// @access  Private (requires manageProducts permission, or Owner)
const deleteCategory = asyncHandler(async (req, res) => {
  const category = await Category.findOne({ _id: req.params.id, business: req.business._id });
  if (!category) {
    res.status(404);
    throw new Error('Category not found');
  }

  // Refuse to orphan products that still point at this category - the
  // Owner has to reassign or remove those products first. Silently
  // nulling category on every affected product would be a surprising,
  // hard-to-notice side effect on a "delete category" click.
  const productsUsingIt = await Product.countDocuments({
    business: req.business._id,
    category: category._id,
  });
  if (productsUsingIt > 0) {
    res.status(400);
    throw new Error(
      `Cannot delete "${category.name}" - ${productsUsingIt} product(s) still use it. Reassign or delete them first.`
    );
  }

  await category.deleteOne();
  res.json({ success: true, message: 'Category deleted successfully' });
});

module.exports = { getCategories, createCategory, updateCategory, deleteCategory };
