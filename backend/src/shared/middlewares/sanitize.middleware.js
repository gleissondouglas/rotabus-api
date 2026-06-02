/**
 * Middleware para sanitizar os dados de entrada.
 * Remove espaços extras e caracteres potencialmente perigosos de strings.
 */

function sanitizeObject(obj) {
  if (typeof obj !== 'object' || obj === null) {
    if (typeof obj === 'string') {
      // Remove tags HTML/Script básicas e espaços extras
      return obj.replace(/<[^>]*>?/gm, '').trim();
    }
    return obj;
  }

  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      obj[key] = sanitizeObject(obj[key]);
    }
  }
  return obj;
}

function sanitizeMiddleware(req, res, next) {
  if (req.body) {
    // Não sanitiza o campo audioBase64 pois ele contém dados binários legítimos
    const { audioBase64, ...rest } = req.body;
    
    const sanitizedRest = sanitizeObject(rest);
    
    req.body = audioBase64 
      ? { ...sanitizedRest, audioBase64 } 
      : sanitizedRest;
  }
  
  if (req.query) {
    req.query = sanitizeObject(req.query);
  }
  
  if (req.params) {
    req.params = sanitizeObject(req.params);
  }

  next();
}

module.exports = { sanitizeMiddleware };
