const Notification = require("../models/Notification");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");
const { success } = require("../utils/response");

function scope(req) {
  return { $or: [{ forUser: null }, { forUser: req.user._id }] };
}

// GET /notifications
exports.list = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20 } = req.query;
  const filter = scope(req);

  const [notifications, total] = await Promise.all([
    Notification.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit)),
    Notification.countDocuments(filter),
  ]);

  return success(res, "Get all notifications with pagination", {
    notifications,
    pagination: { page: Number(page), limit: Number(limit), total },
  });
});

// GET /notifications/:id
exports.getOne = asyncHandler(async (req, res) => {
  const notification = await Notification.findOne({ _id: req.params.id, ...scope(req) });
  if (!notification) throw new ApiError(404, "Notification not found.");
  return success(res, "Get notification details", { notification });
});

// PUT /notifications/:id/read
exports.markRead = asyncHandler(async (req, res) => {
  const notification = await Notification.findOneAndUpdate(
    { _id: req.params.id, ...scope(req) },
    { isRead: true },
    { new: true }
  );
  if (!notification) throw new ApiError(404, "Notification not found.");
  return success(res, "Mark a notification as Read", { notification });
});

// PUT /notifications/read-all
exports.markAllRead = asyncHandler(async (req, res) => {
  await Notification.updateMany(scope(req), { isRead: true });
  return success(res, "Mark all notifications as Read");
});

// DELETE /notifications/:id
exports.remove = asyncHandler(async (req, res) => {
  const notification = await Notification.findOneAndDelete({ _id: req.params.id, ...scope(req) });
  if (!notification) throw new ApiError(404, "Notification not found.");
  return success(res, "Delete a single notification");
});

// POST /notifications/delete-multiple
exports.removeMultiple = asyncHandler(async (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) throw new ApiError(422, "ids[] is required.");
  await Notification.deleteMany({ _id: { $in: ids }, ...scope(req) });
  return success(res, "Delete multiple selected notifications");
});

// GET /notifications/unread-count
exports.unreadCount = asyncHandler(async (req, res) => {
  const count = await Notification.countDocuments({ ...scope(req), isRead: false });
  return success(res, "Get unread notification count", { count });
});

// DELETE /notifications/clear-all
exports.clearAll = asyncHandler(async (req, res) => {
  await Notification.deleteMany(scope(req));
  return success(res, "Delete all notifications");
});
