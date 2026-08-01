const asyncHandler = require('../utils/asyncHandler');
const Category = require('../models/Category');

const getCategories = asyncHandler(async (req, res) => {
  const categories = await Category.find({ business: req.business._id }).sort({ name: 1 });
  res.json({ success: true, count: categories.length, data: categories });
});

const createCategory = asyncHandler(async (req, res) => {
  const { name, color } = req.body;
  if (!name) {
    res.status(400);
    throw new Error('Category name is required');
  }
  const category = await Category.create({ business: req.business._id, name, color });
  res.status(201).json({ success: true, data: category });
});

const updateCategory = asyncHandler(async (req, res) => {
  const category = await Category.findOne({ _id: req.params.id, business: req.business._id });
  if (!category) {
    res.status(404);
    throw new Error('Category not found');
  }

  const editable = ['name', 'color'];
  for (const field of editable) {
    if (req.body[field] !== undefined) category[field] = req.body[field];
  }

  await category.save();
  res.json({ success: true, data: category });
});

const deleteCategory = asyncHandler(async (req, res) => {
  const category = await Category.findOne({ _id: req.params.id, business: req.business._id });
  if (!category) {
    res.status(404);
    throw new Error('Category not found');
  }
  await category.deleteOne();
  res.json({ success: true, message: 'Category deleted' });
});

module.exports = { getCategories, createCategory, updateCategory, deleteCategory };
