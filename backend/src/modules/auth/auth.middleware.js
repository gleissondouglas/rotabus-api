const tokenProvider = require("../../shared/providers/token.provider");
const { findUserById } = require("../users/users.repository");

async function authMiddleware(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      const error = new Error("Token não informado.");
      error.statusCode = 401;
      throw error;
    }

    const [scheme, token] = authHeader.split(" ");

    if (scheme !== "Bearer" || !token) {
      const error = new Error("Formato do token inválido.");
      error.statusCode = 401;
      throw error;
    }

    const decoded = tokenProvider.verifyToken(token);

    const user = await findUserById(decoded.sub);

    if (!user) {
      const error = new Error("Usuário não encontrado.");
      error.statusCode = 401;
      throw error;
    }

    req.user = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    };

    return next();
  } catch (error) {
    // Erros do tokenProvider já vêm com statusCode e message corretos
    return next(error);
  }
}

module.exports = {
  authMiddleware,
};
