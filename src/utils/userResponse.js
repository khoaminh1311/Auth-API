/**
 * Chuyển đổi user document hoặc user object thành Safe User object
 * Chỉ bao gồm: id, name, email, role
 * Loại bỏ: password, passwordChangedAt, __v, v.v.
 */
const formatSafeUser = (user) => {
  if (!user) return null;

  if (typeof user.toSafeObject === 'function') {
    return user.toSafeObject();
  }

  return {
    id: (user._id || user.id).toString(),
    name: user.name,
    email: user.email,
    role: user.role,
  };
};

module.exports = {
  formatSafeUser,
};
