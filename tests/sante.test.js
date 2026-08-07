const request = require('supertest');
const app = require('../src/app');
const db = require('../src/models');

// Phase 6 : deux niveaux à ne jamais confondre.
// "Le service répond" = /health (liveness, jamais dépendant de la base).
// "Le service fonctionne" = /sante (interroge VRAIMENT la base, maintenant).
// Une sonde bâtie sur un simple drapeau mentirait dès que la base tombe
// après la connexion — c'est le scénario verrouillé ici.
describe('GET /sante — la sonde qui dit la vérité', () => {
  test('base joignable : la sonde répond ok', async () => {
    const res = await request(app).get('/sante');
    expect(res.status).toBe(200);
    expect(res.body.base).toBe('joignable');
  });

  test('base tombée APRÈS la connexion : la sonde le voit quand même (503 dégradé)', async () => {
    // La connexion initiale a réussi (setup.js), le drapeau interne est au
    // vert : on tue seulement la requête — exactement une base qui meurt
    // en cours de route. Une sonde à drapeau répondrait encore ok ici.
    const spy = jest.spyOn(db.sequelize, 'query').mockRejectedValueOnce(new Error('la base est tombée'));
    const res = await request(app).get('/sante');
    spy.mockRestore();
    expect(res.status).toBe(503);
    expect(res.body.status).toBe('degrade');
    expect(res.body.base).toBe('injoignable');
  });

  test('pendant la même panne, /health reste 200 : le carré reste plein, seule la santé se dégrade', async () => {
    const spy = jest.spyOn(db.sequelize, 'query').mockRejectedValueOnce(new Error('la base est tombée'));
    const res = await request(app).get('/health');
    spy.mockRestore();
    expect(res.status).toBe(200);
  });

  test('la sonde se rétablit toute seule dès que la base revient', async () => {
    const spy = jest.spyOn(db.sequelize, 'query').mockRejectedValueOnce(new Error('la base est tombée'));
    await request(app).get('/sante');
    spy.mockRestore();
    // La panne est finie : aucun redémarrage, aucun état à purger.
    const res = await request(app).get('/sante');
    expect(res.status).toBe(200);
    expect(res.body.base).toBe('joignable');
  });
});
