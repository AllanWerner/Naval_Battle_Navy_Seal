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

// Middleware de validation pour les requêtes POST et PUT
const validateTaskInput = (req, res, next) => {
  try {
    const { description, status } = req.body;

    // Vérifier que la requête est un JSON valide
    if (!req.is('application/json')) {
      const error = new Error('Content-Type doit être application/json');
      error.status = 400;
      return next(error);
    }

    // Vérifier si le corps de la requête est vide ou malformé
    if (!req.body || typeof req.body !== 'object') {
      const error = new Error('Corps de la requête malformé');
      error.status = 400;
      return next(error);
    }

    // Valider la description
    if (!description) {
      const error = new Error('La description est requise');
      error.status = 400;
      error.details = { field: 'description' };
      return next(error);
    }

    if (typeof description !== 'string') {
      const error = new Error('La description doit être une chaîne de caractères');
      error.status = 400;
      error.details = { field: 'description', type: typeof description };
      return next(error);
    }

    const trimmedDescription = description.trim();
    if (trimmedDescription.length === 0) {
      const error = new Error('La description ne peut pas être vide');
      error.status = 400;
      error.details = { field: 'description' };
      return next(error);
    }

    // Limiter la taille de la description (10 000 caractères max)
    if (trimmedDescription.length > 10000) {
      const error = new Error('La description est trop longue (maximum 10000 caractères)');
      error.status = 400;
      error.details = { 
        field: 'description', 
        maxLength: 10000, 
        currentLength: trimmedDescription.length 
      };
      return next(error);
    }

    // Valider le status (optionnel)
    if (status !== undefined && typeof status !== 'string') {
      const error = new Error('Le status doit être une chaîne de caractères');
      error.status = 400;
      error.details = { field: 'status', type: typeof status };
      return next(error);
    }

    // Les status valides (si fourni)
    if (status !== undefined) {
      const validStatuses = ['pending', 'in-progress', 'completed'];
      if (!validStatuses.includes(status)) {
        const error = new Error(`Status invalide. Valeurs acceptées: ${validStatuses.join(', ')}`);
        error.status = 400;
        error.details = { field: 'status', validValues: validStatuses };
        return next(error);
      }
    }

    // Nettoyer les données
    req.body.description = trimmedDescription;
    next();
  } catch (error) {
    // Capturer les erreurs de parsing JSON, etc.
    const err = new Error('Erreur de validation: ' + error.message);
    err.status = 400;
    next(err);
  }
};

// Middleware pour les routes non trouvées (404)
const notFoundHandler = (req, res, next) => {
  const error = new Error(`Route non trouvée: ${req.method} ${req.originalUrl}`);
  error.status = 404;
  next(error);
};

module.exports = {
  errorHandler,
  validateTaskInput,
  notFoundHandler
};