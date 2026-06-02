const jwt = require("jsonwebtoken");
const { findUserById } = require("../users/users.repository");
const env = require("../../config/env");

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

    if (!env.jwtSecret) {
      const error = new Error("JWT_SECRET não configurado.");
      error.statusCode = 500;
      throw error;
    }

    const decoded = jwt.verify(token, env.jwtSecret);

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
    if (error.name === "JsonWebTokenError") {
      error.message = "Token inválido.";
      error.statusCode = 401;
    }

    if (error.name === "TokenExpiredError") {
      error.message = "Token expirado.";
      error.statusCode = 401;
    }

    return next(error);
  }
}

module.exports = {
  authMiddleware,
};
