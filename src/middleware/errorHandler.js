const errorHandler = (err, req, res, next) => {

  // Log de l'erreur pour le serveur (pas envoyé au client)
  console.error(`[${new Date().toISOString()}] Error:`, {
    message: err.message,
    stack: err.stack,
    status: err.status || 500
  });

  // Déterminer le statut HTTP
  const statusCode = err.status || 500;

  // Construction de la réponse d'erreur
  const errorResponse = {
    success: false,
    message: err.message || 'Erreur interne du serveur',
    timestamp: new Date().toISOString()
  };

  // Ajouter des détails supplémentaires pour certaines erreurs
  if (err.status === 400 && err.details) {
    errorResponse.details = err.details;
  }

  // Ne jamais envoyer la stack trace au client
  res.status(statusCode).json(errorResponse);
};

const notFoundHandler = (req, res, next) => {
  const error = new Error(`Route non trouvée: ${req.method} ${req.originalUrl}`);
  error.status = 404;
  next(error);
};

module.exports = {
  errorHandler,
  notFoundHandler
};
