// En conteneur, les variables viennent du compose et gagnent sur le .env :
// dotenv n'ecrase jamais une variable deja definie.
require('dotenv').config();

const fs = require('node:fs');
const path = require('node:path');
const express = require('express');
const helmet = require('helmet');
const client = require('prom-client');

const PORT = process.env.PORT || 3000;
const API_URL = process.env.API_URL || 'http://api:4000';
const PAGE = path.join(__dirname, 'public', 'index.html');

const app = express();
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json());

// ---------------------------------------------------------------- metriques
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

// L'etat de la dependance, en 0 ou 1 : c'est ce qui distingue au tableau de
// bord une panne du front d'une panne de l'API (phase 12, panneau 3).
const apiJoignable = new client.Gauge({
  name: 'quiz_front_api_joignable',
  help: '1 si quiz-api repond, 0 sinon',
  registers: [register]
});

app.use((req, res, next) => {
  const finTimer = httpRequestDuration.startTimer();
  res.on('finish', () => {
    const labels = {
      method: req.method,
      route: req.route ? (req.baseUrl || '') + req.route.path : 'unmatched',
      status: res.statusCode
    };
    httpRequestsTotal.inc(labels);
    finTimer(labels);
  });
  next();
});

// ------------------------------------------------------------------ helpers
// Tout appel a l'API porte un delai court et ne leve jamais : le front doit
// rendre sa page meme quand son API est morte. C'est la degradation
// gracieuse, et elle vaut un carre plein au lieu de deux carres eteints.
async function appelerApi(chemin, options = {}) {
  const controleur = new AbortController();
  const minuteur = setTimeout(() => controleur.abort(), 2000);
  try {
    const reponse = await fetch(`${API_URL}${chemin}`, { ...options, signal: controleur.signal });
    apiJoignable.set(1);
    return { ok: reponse.ok, status: reponse.status, corps: await reponse.json() };
  } catch (erreur) {
    apiJoignable.set(0);
    return { ok: false, status: 503, corps: { success: false, message: 'API indisponible' } };
  } finally {
    clearTimeout(minuteur);
  }
}

// -------------------------------------------------------------------- pages
app.get('/', (req, res) => res.sendFile(PAGE));

// La commande de l'animateur vit sur une page a part, atteignable par la
// barre d'onglets. Elle n'est pas protegee : n'importe qui peut changer de
// manche. Un jeton dans l'URL suffirait a eviter le chahut, si besoin.
app.get('/animateur', (req, res) => res.sendFile(path.join(__dirname, 'public', 'animateur.html')));

app.use('/static', express.static(path.join(__dirname, 'public')));

// ---------------------------------------------------------------- proxy API
// Le navigateur ne parle qu'au front : l'API n'est pas exposee vers
// l'exterieur, seul le front la joint sur le reseau interne.
app.get('/api/question', async (req, res) => {
  const r = await appelerApi('/api/question');
  res.status(r.status).json(r.corps);
});

app.post('/api/reponse', async (req, res) => {
  const r = await appelerApi('/api/reponse', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req.body || {})
  });
  res.status(r.status).json(r.corps);
});

app.post('/api/manche/suivante', async (req, res) => {
  const r = await appelerApi('/api/manche/suivante', { method: 'POST' });
  res.status(r.status).json(r.corps);
});

app.get('/api/score/:pseudo', async (req, res) => {
  const r = await appelerApi(`/api/score/${encodeURIComponent(req.params.pseudo)}`);
  res.status(r.status).json(r.corps);
});

// ------------------------------------------------------------------- sondes
// Liveness : ne depend de rien d'autre que du process. Le carre du front
// reste plein quand l'API tombe, et c'est voulu.
app.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date() }));

// La sonde qui dit la verite : elle nomme l'etat de la dependance sans
// pretendre que le front est mort pour autant.
app.get('/sante', async (req, res) => {
  const r = await appelerApi('/health');
  if (r.ok) return res.json({ status: 'ok', api: 'joignable' });
  res.status(503).json({ status: 'degrade', api: 'injoignable' });
});

// La route qui encaisse les coups. Travail local et reel : relecture de la
// page sur le disque. Volontairement independante de l'API, sinon une panne
// de l'API ferait aussi palir le carre du front.
app.get('/travail', (req, res) => {
  try {
    const octets = fs.readFileSync(PAGE, 'utf8').length;
    res.json({ success: true, data: { octets } });
  } catch (erreur) {
    res.status(503).json({ success: false, message: erreur.message });
  }
});

app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

const serveur = app.listen(PORT, () => {
  console.log(`🚀 quiz-front sur le port ${PORT}, API sur ${API_URL}`);
});

// Sans ce gestionnaire, un port deja pris fait sortir Node sur une trace
// illisible, et "node --watch" n'affiche qu'un "Failed running server.js"
// qui ne dit pas pourquoi.
serveur.on('error', (erreur) => {
  if (erreur.code === 'EADDRINUSE') {
    console.error(
      `[demarrage] le port ${PORT} est deja utilise.\n` +
        `            Un autre quiz-front tourne encore, ou changez PORT dans front/.env.`
    );
  } else {
    console.error('[demarrage] impossible d\'ecouter :', erreur.message);
  }
  process.exit(1);
});
