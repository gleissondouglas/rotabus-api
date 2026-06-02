function adminMiddleware(req, res, next) {
  if (!req.user) {
    const error = new Error("Usuário não autenticado.");
    error.statusCode = 401;
    return next(error);
  }

  if (req.user.role !== "ADMIN") {
    const error = new Error("Acesso permitido apenas para administradores.");
    error.statusCode = 403;
    return next(error);
  }

  return next();
}

module.exports = {
  adminMiddleware,
};
