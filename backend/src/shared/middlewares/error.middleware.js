const { captureException } = require("../../config/sentry");

function errorMiddleware(error, req, res, next) {
  const statusCode = error.statusCode || 500;
  const message = error.message || "Erro interno do servidor";

  // Captura o erro no Sentry se for um erro 500
  if (statusCode >= 500) {
    captureException(error, {
      url: req.url,
      method: req.method,
      body: req.body,
      userId: req.user?.id,
    });
  }

  return res.status(statusCode).json({
    error: true,
    message,
  });
}

module.exports = errorMiddleware;
