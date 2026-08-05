const db = require('../src/models');

// Le schéma doit exister avant que le premier test ne tourne :
// connectWithRetry() attend Postgres puis synchronise les modèles
// (voir src/models/index.js), exactement comme au démarrage de l'app.
beforeAll(async () => {
  await db.connectWithRetry();
});

// Chaque test repart d'un état de base connu, qu'il tourne seul ou
// après d'autres tests (voir "points de vigilance" de la Phase 6).
afterEach(async () => {
  await db.Task.destroy({ truncate: true, force: true });
});

afterAll(async () => {
  await db.sequelize.close();
});
