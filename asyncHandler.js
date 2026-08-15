// Wraps an async route/controller function so any rejected promise (thrown
// error) is forwarded to Express's error-handling middleware instead of
// crashing the process or hanging the request. Saves a try/catch in every
// single controller.
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = asyncHandler;
