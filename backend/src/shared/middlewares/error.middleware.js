const { captureException } = require("../../config/sentry");

function errorMiddleware(error, req, res, next) {
    const statusCode = error.statusCode || 500;
    const isServerError = statusCode >= 500;
    const message = isServerError
        ? 'Erro interno do servidor'
        : error.message || 'Não foi possível concluir a solicitação.';

    // Captura o erro no Sentry se for um erro 500
    if (isServerError) {
        captureException(error, {
            url: req.url,
            method: req.method,
            userId: req.user?.id
        });
    }

    return res.status(statusCode).json({
        error: true,
        message,
    });
}

module.exports = errorMiddleware;
