// Valores válidos do enum Role definido no schema.prisma
const VALID_ROLES = Object.freeze({ USER: 'USER', ADMIN: 'ADMIN' });

function adminMiddleware(req, res, next) {
  if (!req.user) {
    const error = new Error("Usuário não autenticado.");
    error.statusCode = 401;
    return next(error);
  }

  // Comparação estrita com o valor do enum — sem coerção de tipo
  if (req.user.role !== VALID_ROLES.ADMIN) {
    const error = new Error("Acesso permitido apenas para administradores.");
    error.statusCode = 403;
    return next(error);
  }

  return next();
}

module.exports = {
  adminMiddleware,
};
