const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const taskRoutes = require('./routes/tasks');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');
const db = require('./models');

const app = express();

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Liveness : répond dès que le process Express tourne, quel que soit
// l'état de la base. C'est cette route que le HEALTHCHECK Docker utilise,
// afin que le conteneur de l'API soit "healthy" indépendamment de Postgres.
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date() });
});

// Readiness : reflète l'état réel de la connexion à la base de données.
// Utile pour un load balancer / une orchestration qui veut savoir si
// l'API peut réellement traiter des requêtes qui touchent la DB.
app.get('/ready', (req, res) => {
  if (db.isReady) {
    return res.json({ status: 'ready', timestamp: new Date() });
  }
  res.status(503).json({ status: 'not ready', timestamp: new Date() });
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
app.use('/api/tasks', taskRoutes);

// 404 handler
app.use(notFoundHandler);

// Error handling
app.use(errorHandler);

const PORT = process.env.PORT || 4000;

// Ne démarre le serveur (et la connexion DB) que lorsque ce fichier est
// exécuté directement (node src/app.js / conteneur de prod), pas quand il
// est simplement require() par les tests d'intégration : ceux-ci pilotent
// l'app via supertest, sans vouloir d'un vrai listener réseau en plus.
if (require.main === module) {
  // Le serveur HTTP démarre immédiatement : il ne dépend pas de la
  // disponibilité de Postgres pour démarrer.
  app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📊 Database: ${process.env.DB_NAME || 'taskdb'}`);
  });

  // La connexion à la base se fait en arrière-plan, avec re-tentatives :
  // si Postgres n'est pas encore là, l'API reste up et /health reste OK ;
  // /ready et /api/* renverront 503 jusqu'à ce que la connexion réussisse.
  db.connectWithRetry();

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
