const client = require('prom-client');

const register = new client.Registry();
client.collectDefaultMetrics({ register });

const httpRequestsTotal = new client.Counter({
  name: 'http_requests_total',
  help: 'Nombre total de requetes HTTP servies',
  labelNames: ['method', 'route', 'status'],
  registers: [register]
});

const httpRequestDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duree des requetes HTTP en secondes',
  labelNames: ['method', 'route', 'status'],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
  registers: [register]
});

// Mesure metier : nombre de taches creees depuis le demarrage (incremente
// par taskController.createTask, uniquement en cas de succes).
const tasksCreatedTotal = new client.Counter({
  name: 'tasks_created_total',
  help: 'Nombre de taches creees depuis le demarrage',
  registers: [register]
});

// L'identifiant d'une tache ne doit jamais devenir un label (cardinalite
// non bornee). On utilise le pattern de route matché par Express
// (ex. "/api/tasks/:id"), pas l'URL brute. Pour les 404 "route inconnue"
// (aucune Route Express ne matche), req.route reste undefined : on les
// regroupe sous un label fixe "unmatched" plutôt que l'URL demandée,
// sinon un client qui martèle des routes aléatoires ferait exploser le
// nombre de séries.
function resolveRouteLabel(req) {
  if (req.route) {
    return (req.baseUrl || '') + req.route.path;
  }
  return 'unmatched';
}

// Doit être monté avant les routes pour mesurer toutes les requêtes, y
// compris les 404 non matchées (sinon les erreurs restent invisibles).
function metricsMiddleware(req, res, next) {
  const endTimer = httpRequestDuration.startTimer();
  res.on('finish', () => {
    // Lu ici (après le traitement de la requête, avant la fermeture de la
    // réponse) : req.route n'est renseigné par Express qu'une fois la
    // route effectivement matchée, ce qui est déjà le cas à ce stade.
    const labels = {
      method: req.method,
      route: resolveRouteLabel(req),
      status: res.statusCode
    };
    httpRequestsTotal.inc(labels);
    endTimer(labels);
  });
  next();
}

module.exports = {
  register,
  metricsMiddleware,
  tasksCreatedTotal
};
