const request = require('supertest');
const app = require('../src/app');
const db = require('../src/models');

describe('API quiz', () => {
  test('sert la question en cours sans jamais livrer la bonne réponse', async () => {
    const res = await request(app).get('/api/question');

    expect(res.status).toBe(200);
    expect(typeof res.body.data.texte).toBe('string');
    expect(res.body.data.choix).toHaveLength(4);
    // Le point qui compte : la réponse ne doit pas fuiter au client.
    expect(res.body.data.bonneReponse).toBeUndefined();
  });

  test('enregistre une réponse et dit si elle est juste', async () => {
    const question = await db.Question.findOne({ where: { active: true } });

    const juste = await request(app)
      .post('/api/reponse')
      .send({ pseudo: 'moussaillon', choix: question.bonneReponse });

    expect(juste.status).toBe(201);
    expect(juste.body.data.correcte).toBe(true);
  });

  test('refuse une deuxième réponse du même joueur sur la même manche', async () => {
    const question = await db.Question.findOne({ where: { active: true } });

    await request(app).post('/api/reponse').send({ pseudo: 'doublon', choix: 0 });
    const seconde = await request(app)
      .post('/api/reponse')
      .send({ pseudo: 'doublon', choix: (question.bonneReponse + 1) % 4 });

    expect(seconde.status).toBe(409);
  });

  test('refuse une entrée invalide en 400', async () => {
    const sansPseudo = await request(app).post('/api/reponse').send({ choix: 1 });
    const choixHorsBornes = await request(app)
      .post('/api/reponse')
      .send({ pseudo: 'zoe', choix: 42 });

    expect(sansPseudo.status).toBe(400);
    expect(choixHorsBornes.status).toBe(400);
  });

  test('compte le score d\'un joueur', async () => {
    const question = await db.Question.findOne({ where: { active: true } });
    await request(app)
      .post('/api/reponse')
      .send({ pseudo: 'championne', choix: question.bonneReponse });

    const res = await request(app).get('/api/score/championne');

    expect(res.status).toBe(200);
    expect(res.body.data.points).toBe(1);
    expect(res.body.data.repondues).toBe(1);
  });

  test('la route de travail fait une vraie lecture et répond 200', async () => {
    const res = await request(app).get('/travail');

    expect(res.status).toBe(200);
    expect(typeof res.body.data.reponses).toBe('number');
  });
});
