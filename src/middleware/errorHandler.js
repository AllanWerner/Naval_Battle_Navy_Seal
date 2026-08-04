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
    const { title, description, status, priority, dueDate } = req.body;

    // === 1. VALIDATION DU CONTENT-TYPE ===
    if (!req.is('application/json')) {
      const error = new Error('Content-Type doit être application/json');
      error.status = 400;
      return next(error);
    }

    // === 2. VALIDATION DU CORPS DE LA REQUÊTE ===
    if (!req.body || typeof req.body !== 'object') {
      const error = new Error('Corps de la requête malformé');
      error.status = 400;
      return next(error);
    }

    // === 3. VALIDATION DU TITLE (NOUVEAU - OBLIGATOIRE) ===
    if (!title) {
      const error = new Error('Le titre est requis');
      error.status = 400;
      error.details = { field: 'title' };
      return next(error);
    }

    if (typeof title !== 'string') {
      const error = new Error('Le titre doit être une chaîne de caractères');
      error.status = 400;
      error.details = { field: 'title', type: typeof title };
      return next(error);
    }

    const trimmedTitle = title.trim();
    if (trimmedTitle.length === 0) {
      const error = new Error('Le titre ne peut pas être vide');
      error.status = 400;
      error.details = { field: 'title' };
      return next(error);
    }

    // Limiter la taille du titre (255 caractères max - correspond au modèle)
    if (trimmedTitle.length > 255) {
      const error = new Error('Le titre est trop long (maximum 255 caractères)');
      error.status = 400;
      error.details = { 
        field: 'title', 
        maxLength: 255, 
        currentLength: trimmedTitle.length 
      };
      return next(error);
    }

    // === 4. VALIDATION DE LA DESCRIPTION (OPTIONNELLE) ===
    if (description !== undefined && description !== null) {
      if (typeof description !== 'string') {
        const error = new Error('La description doit être une chaîne de caractères');
        error.status = 400;
        error.details = { field: 'description', type: typeof description };
        return next(error);
      }

      const trimmedDescription = description.trim();
      
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

      // Nettoyer la description
      req.body.description = trimmedDescription;
    }

    // === 5. VALIDATION DU STATUS (OPTIONNEL) ===
    if (status !== undefined && status !== null) {
      if (typeof status !== 'string') {
        const error = new Error('Le status doit être une chaîne de caractères');
        error.status = 400;
        error.details = { field: 'status', type: typeof status };
        return next(error);
      }

      // ✅ CORRECTION : Utiliser les valeurs exactes de l'enum du modèle
      const validStatuses = ['pending', 'in_progress', 'completed'];
      if (!validStatuses.includes(status)) {
        const error = new Error(`Status invalide. Valeurs acceptées: ${validStatuses.join(', ')}`);
        error.status = 400;
        error.details = { field: 'status', validValues: validStatuses };
        return next(error);
      }
    }

    // === 6. VALIDATION DU PRIORITY (OPTIONNEL) ===
    if (priority !== undefined && priority !== null) {
      if (typeof priority !== 'string') {
        const error = new Error('La priorité doit être une chaîne de caractères');
        error.status = 400;
        error.details = { field: 'priority', type: typeof priority };
        return next(error);
      }

      const validPriorities = ['low', 'medium', 'high'];
      if (!validPriorities.includes(priority)) {
        const error = new Error(`Priorité invalide. Valeurs acceptées: ${validPriorities.join(', ')}`);
        error.status = 400;
        error.details = { field: 'priority', validValues: validPriorities };
        return next(error);
      }
    }

    // === 7. VALIDATION DU dueDate (OPTIONNEL) ===
    if (dueDate !== undefined && dueDate !== null) {
      if (typeof dueDate !== 'string' && !(dueDate instanceof Date)) {
        const error = new Error('La date d\'échéance doit être une date valide');
        error.status = 400;
        error.details = { field: 'dueDate', type: typeof dueDate };
        return next(error);
      }

      // Vérifier que la date est valide
      const date = new Date(dueDate);
      if (isNaN(date.getTime())) {
        const error = new Error('La date d\'échéance n\'est pas une date valide');
        error.status = 400;
        error.details = { field: 'dueDate', value: dueDate };
        return next(error);
      }

      // Vérifier que la date n'est pas dans le passé (optionnel)
      if (date < new Date()) {
        const error = new Error('La date d\'échéance ne peut pas être dans le passé');
        error.status = 400;
        error.details = { field: 'dueDate', value: dueDate };
        return next(error);
      }

      // Nettoyer la date
      req.body.dueDate = date;
    }

    // === 8. NETTOYAGE FINAL ===
    req.body.title = trimmedTitle;
    // description déjà nettoyée plus haut
    // On conserve les autres champs tels quels

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