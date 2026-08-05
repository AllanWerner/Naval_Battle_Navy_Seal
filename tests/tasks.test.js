const request = require('supertest');
const app = require('../src/app');

describe('API /api/tasks', () => {
  test('crée une tâche puis la relit par son identifiant', async () => {
    const payload = {
      title: 'Réviser la procédure de déploiement',
      description: 'Relire avant la passation',
      priority: 'high'
    };

    const createRes = await request(app)
      .post('/api/tasks')
      .set('Content-Type', 'application/json')
      .send(payload);

    expect(createRes.status).toBe(201);
    expect(createRes.body.data.title).toBe(payload.title);
    const taskId = createRes.body.data.id;

    const readRes = await request(app).get(`/api/tasks/${taskId}`);

    expect(readRes.status).toBe(200);
    expect(readRes.body.data.id).toBe(taskId);
    expect(readRes.body.data.title).toBe(payload.title);
    expect(readRes.body.data.description).toBe(payload.description);
    expect(readRes.body.data.priority).toBe(payload.priority);
  });

  test('renvoie un 404 propre pour une tâche inexistante', async () => {
    const res = await request(app).get('/api/tasks/00000000-0000-0000-0000-000000000000');

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  test('renvoie un 400 sur un corps de requête invalide', async () => {
    const res = await request(app)
      .post('/api/tasks')
      .set('Content-Type', 'application/json')
      .send({ title: '' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  test('supprime une tâche et vérifie qu’elle a disparu', async () => {
    const createRes = await request(app)
      .post('/api/tasks')
      .set('Content-Type', 'application/json')
      .send({ title: 'Tâche à supprimer' });
    const taskId = createRes.body.data.id;

    const deleteRes = await request(app).delete(`/api/tasks/${taskId}`);
    expect(deleteRes.status).toBe(200);
    expect(deleteRes.body.success).toBe(true);

    const readRes = await request(app).get(`/api/tasks/${taskId}`);
    expect(readRes.status).toBe(404);
  });
});
