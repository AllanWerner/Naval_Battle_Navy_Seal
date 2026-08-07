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

// Mesure metier : nombre de reponses envoyees depuis le demarrage, ventile
// par justesse. Deux series au total, la cardinalite reste bornee.
const reponsesTotal = new client.Counter({
  name: 'quiz_reponses_total',
  help: 'Nombre de reponses enregistrees depuis le demarrage',
  labelNames: ['correcte'],
  registers: [register]
});

const baseJoignable = new client.Gauge({
  name: 'quiz_api_base_joignable',
  help: '1 si quiz-api joint Postgres, 0 sinon',
  registers: [register]
});

const serviceVersionInfo = new client.Gauge({
  name: 'service_version_info',
  help: 'Version applicative exposee par le service',
  labelNames: ['service', 'version'],
  registers: [register]
});

baseJoignable.set(0);
serviceVersionInfo.labels(process.env.SERVICE || 'api', process.env.VERSION || process.env.TAG || 'dev').set(1);

// L'identifiant d'une question ne doit jamais devenir un label (cardinalite
// non bornee). On utilise le pattern de route matché par Express
// (ex. "/api/score/:pseudo"), pas l'URL brute. Pour les 404 "route inconnue"
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
  reponsesTotal,
  baseJoignable
};
