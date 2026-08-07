const request = require('supertest');
const app = require('../src/app');
const db = require('../src/models');

// Phase 7 : /travail est la route que le pouls appelle pour encaisser les
// coups du tableau. Elle doit coûter du vrai travail (lire la manche active,
// compter ses réponses en base) et dire la vérité : 200 seulement si le
// travail a abouti, 503 sinon — un coup raté ne se déguise jamais en succès.
describe('GET /travail — du vrai travail, pas un return 200', () => {
  test('encaisse un coup : lit la manche active et compte ses réponses', async () => {
    const res = await request(app).get('/travail');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    // Le seed active la première question : le coup lit une réalité précise.
    expect(res.body.data.ordre).toBe(1);
    expect(res.body.data.reponses).toBe(0);
  });

  test('le compte reflète la base, pas un compteur en mémoire', async () => {
    const question = await db.Question.findOne({ where: { active: true } });
    await db.Reponse.create({
      questionId: question.id,
      pseudo: 'testeur-travail',
      choix: 1,
      correcte: true
    });
    const res = await request(app).get('/travail');
    expect(res.body.data.reponses).toBe(1);
  });

  test('sans manche en cours, le coup ne peut pas être encaissé : 503 explicite', async () => {
    await db.Question.update({ active: false }, { where: {} });
    const res = await request(app).get('/travail');
    // On restaure la manche AVANT les assertions : un test qui échoue ne doit
    // pas laisser la base sans manche active pour les tests suivants.
    await db.Question.update({ active: true }, { where: { ordre: 1 } });
    expect(res.status).toBe(503);
    expect(res.body.message).toMatch(/aucune manche/);
  });

  test('base injoignable : 503, jamais un faux 200', async () => {
    const spy = jest.spyOn(db.Question, 'findOne').mockRejectedValueOnce(new Error('la base est tombée'));
    const res = await request(app).get('/travail');
    spy.mockRestore();
    expect(res.status).toBe(503);
    expect(res.body.success).toBe(false);
  });
});
