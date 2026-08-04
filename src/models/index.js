const sequelize = require('../config/database');
const Task = require('./task');

const RETRY_DELAY_MS = 5000;

const db = {
  sequelize,
  Task,
  // État de la connexion à la base, exposé pour la route /ready
  // et pour le middleware de garde des routes /api/*.
  isReady: false
};

// Tente de se connecter à la base en boucle, sans jamais lancer d'exception
// ni faire planter le process : ainsi le conteneur de l'API peut démarrer
// (et rester démarré) même si Postgres n'est pas encore joignable.
db.connectWithRetry = async function connectWithRetry() {
  while (!db.isReady) {
    try {
      await sequelize.authenticate();
      console.log('✅ Database connection established successfully.');

      // Synchroniser les modèles (en développement uniquement)
      if (process.env.NODE_ENV !== 'production') {
        await sequelize.sync({ alter: true });
        console.log('✅ Database synchronized');
      } else {
        await sequelize.sync();
      }

      db.isReady = true;
    } catch (error) {
      console.error(
        `❌ Unable to connect to the database, retrying in ${RETRY_DELAY_MS / 1000}s:`,
        error.message
      );
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
    }
  }
};

module.exports = db;
