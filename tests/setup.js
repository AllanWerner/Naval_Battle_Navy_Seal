const db = require('../src/models');

// Le schéma doit exister avant que le premier test ne tourne :
// connectWithRetry() attend Postgres puis synchronise les modèles
// (voir src/models/index.js), exactement comme au démarrage de l'app.
beforeAll(async () => {
  await db.connectWithRetry();
});

// Chaque test repart d'un état de base connu. Les réponses partent, les
// questions du seed restent : elles sont la donnée de référence du quiz.
afterEach(async () => {
  await db.Reponse.destroy({ truncate: true, force: true });
});

afterAll(async () => {
  await db.sequelize.close();
});
