/**
 * Middleware genérico para validação de dados usando Zod.
 * Permite validar req.body, req.query ou req.params.
 */
const validate = (schema, location = 'body') => (req, res, next) => {
  try {
    // Valida e normaliza os dados (ex: trim, lowercase, transformações)
    const validatedData = schema.parse(req[location]);

    // Substitui os dados originais pelos dados validados/normalizados
    req[location] = validatedData;

    next();
  } catch (error) {
    // Se for um erro do Zod, converte para o formato esperado pelo error.middleware
    if (error.name === 'ZodError') {
      const firstIssue = error.issues[0];
      
      // Cria um erro compatível com o padrão ValidationError do projeto
      const validationError = new Error(firstIssue.message);
      validationError.statusCode = 400;
      validationError.name = 'ValidationError';
      
      return next(validationError);
    }

    // Passa outros tipos de erro para o middleware de erro global
    next(error);
  }
};

module.exports = { validate };
