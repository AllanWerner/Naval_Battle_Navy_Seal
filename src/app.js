const fs = require('node:fs');
const path = require('node:path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const quizRoutes = require('./routes/quiz');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');
const db = require('./models');
const { register, metricsMiddleware } = require('./metrics');
const { demarrerLePouls } = require('./pouls');

const app = express();

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Monté avant toutes les routes pour mesurer chaque requête, y compris
// les 404 non matchées (sinon les erreurs sont invisibles côté Prometheus).
app.use(metricsMiddleware);

// Route Prometheus : texte brut, pas JSON.
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

// Liveness : répond dès que le process Express tourne, quel que soit
// l'état de la base. C'est cette route que le HEALTHCHECK Docker utilise.
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date() });
});

// Readiness : reflète l'état de la connexion, sans interroger la base.
app.get('/ready', (req, res) => {
  if (db.isReady) {
    return res.json({ status: 'ready', timestamp: new Date() });
  }
  res.status(503).json({ status: 'not ready', timestamp: new Date() });
});

// La sonde qui dit la vérité (phase 6). Contrairement à /health, elle
// interroge réellement la base : un serveur HTTP qui répond ne prouve pas
// que le service rend le service attendu.
app.get('/sante', async (req, res) => {
  try {
    await db.sequelize.query('SELECT 1');
    res.json({ status: 'ok', base: 'joignable' });
  } catch (error) {
    res.status(503).json({ status: 'degrade', base: 'injoignable', detail: error.message });
  }
});

// La route qui encaisse les coups (phase 7). Elle doit coûter un peu et
// toucher à la réalité du service : ici une vraie lecture en base.
app.get('/travail', async (req, res) => {
  try {
    const question = await db.Question.findOne({ where: { active: true } });
    if (!question) {
      return res.status(503).json({ success: false, message: 'aucune manche en cours' });
    }
    const reponses = await db.Reponse.count({ where: { questionId: question.id } });
    res.json({ success: true, data: { ordre: question.ordre, reponses } });
  } catch (error) {
    // 503 et pas 500 : le travail n'a pas pu être fait, le service n'est pas
    // cassé pour autant, et l'appelant peut réessayer.
    res.status(503).json({ success: false, message: error.message });
  }
});

// Le pavillon (phase 5). Écrit sur le disque, et relu ensuite par le service
// qui parle au tableau. L'emplacement décide de sa survie : dans un volume, il
// traverse le redéploiement ; dans le conteneur, il s'efface au prochain push.
const PAVILLON_FICHIER = process.env.PAVILLON_FICHIER || '/data/pavillon.txt';

app.post('/pavillon', (req, res, next) => {
  const message = typeof req.body?.message === 'string' ? req.body.message.trim() : '';

  if (message.length === 0) {
    const error = new Error('Le pavillon ne peut pas être vide');
    error.status = 400;
    return next(error);
  }

  try {
    fs.mkdirSync(path.dirname(PAVILLON_FICHIER), { recursive: true });
    fs.writeFileSync(PAVILLON_FICHIER, message.slice(0, 140), 'utf8');
    res.status(201).json({ success: true, data: { pavillon: message.slice(0, 140) } });
  } catch (error) {
    next(error);
  }
});

app.get('/pavillon', (req, res) => {
  try {
    res.json({ success: true, data: { pavillon: fs.readFileSync(PAVILLON_FICHIER, 'utf8').trim() } });
  } catch {
    res.json({ success: true, data: { pavillon: '' } });
  }
});

// Tant que la base n'est pas prête, on répond 503 plutôt que de laisser
// Sequelize échouer avec une erreur de connexion peu explicite.
app.use('/api', (req, res, next) => {
  if (!db.isReady) {
    return res.status(503).json({
      success: false,
      message: 'Service indisponible : connexion à la base de données en cours.'
    });
  }
  next();
});

// Routes
app.use('/api', quizRoutes);

// 404 handler
app.use(notFoundHandler);

// Error handling
app.use(errorHandler);

const PORT = process.env.PORT || 4000;

// Ne démarre le serveur (et la connexion DB) que lorsque ce fichier est
// exécuté directement, pas quand il est require() par les tests.
if (require.main === module) {
  const serveur = app.listen(PORT, () => {
    console.log(`🚀 quiz-api sur le port ${PORT}`);
    console.log(`📊 Database: ${process.env.DB_NAME || 'quizdb'}`);
  });

  // Sans ce gestionnaire, un port deja pris sort sur une trace illisible,
  // et "node --watch" n'affiche qu'un "Failed running src/app.js".
  serveur.on('error', (erreur) => {
    if (erreur.code === 'EADDRINUSE') {
      console.error(
        `[demarrage] le port ${PORT} est deja utilise.\n` +
          `            Une autre quiz-api tourne encore, ou changez PORT dans .env.`
      );
    } else {
      console.error('[demarrage] impossible d\'ecouter :', erreur.message);
    }
    process.exit(1);
  });

  db.connectWithRetry();

  // Pouls vers le tableau de la classe : indépendant de la DB, ne bloque pas
  // le démarrage du serveur.
  demarrerLePouls();

  // Gestion des erreurs non capturées (bugs applicatifs réels, pas les
  // erreurs de connexion DB qui sont gérées par connectWithRetry)
  process.on('uncaughtException', (err) => {
    console.error('💥 Uncaught Exception:', err);
    process.exit(1);
  });

  process.on('unhandledRejection', (reason) => {
    console.error('💥 Unhandled Rejection:', reason);
    process.exit(1);
  });
}

module.exports = app;
