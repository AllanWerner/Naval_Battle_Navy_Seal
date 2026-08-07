const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

// PAVILLON_FICHIER est lu par app.js au moment du require : on le pointe
// vers un dossier temporaire AVANT d'importer l'app. En prod, ce chemin vit
// dans le volume "pavillon" monté sur /data (voir docker-compose.prod.yml) —
// c'est lui qui fait survivre le message aux redéploiements.
const DOSSIER = fs.mkdtempSync(path.join(os.tmpdir(), 'pavillon-'));
const FICHIER = path.join(DOSSIER, 'data', 'pavillon.txt');
process.env.PAVILLON_FICHIER = FICHIER;

const request = require('supertest');
const app = require('../src/app');

// Phase 5 : le pavillon ("On est là") doit se hisser, se relire, survivre,
// et refuser proprement ce qui n'est pas hissable.
describe('le pavillon', () => {
  test('absent, il se lit comme une chaîne vide, jamais une erreur', async () => {
    const res = await request(app).get('/pavillon');
    expect(res.status).toBe(200);
    expect(res.body.data.pavillon).toBe('');
  });

  test('se hisse et part sur le disque, dossier créé au passage', async () => {
    const res = await request(app).post('/pavillon').send({ message: 'On est là' });
    expect(res.status).toBe(201);
    expect(res.body.data.pavillon).toBe('On est là');
    expect(fs.readFileSync(FICHIER, 'utf8')).toBe('On est là');
  });

  test('se relit : exactement ce que le pouls enverra au tableau', async () => {
    await request(app).post('/pavillon').send({ message: 'On est là' });
    const res = await request(app).get('/pavillon');
    expect(res.status).toBe(200);
    expect(res.body.data.pavillon).toBe('On est là');
  });

  test('vide ou fait d\'espaces, il est refusé avec un 400 clair', async () => {
    const resVide = await request(app).post('/pavillon').send({ message: '' });
    expect(resVide.status).toBe(400);
    const resEspaces = await request(app).post('/pavillon').send({ message: '   ' });
    expect(resEspaces.status).toBe(400);
  });

  test('sans champ message du tout, refusé aussi — jamais un crash', async () => {
    const res = await request(app).post('/pavillon').send({ pasLeBonChamp: 'x' });
    expect(res.status).toBe(400);
  });

  test('au-delà de 140 caractères, il est tronqué à 140 exactement (le contrat affiché)', async () => {
    const res = await request(app).post('/pavillon').send({ message: 'x'.repeat(200) });
    expect(res.status).toBe(201);
    expect(res.body.data.pavillon).toHaveLength(140);
    expect(fs.readFileSync(FICHIER, 'utf8')).toHaveLength(140);
  });

  test('survit à un "nouveau conteneur" : une autre instance relit le même fichier (la sémantique du volume)', async () => {
    await request(app).post('/pavillon').send({ message: 'On est là' });
    // Nouvelle instance de l'app : même fichier, comme un conteneur remplacé
    // qui remonte le même volume. Si le message est là, l'emplacement est bon.
    jest.resetModules();
    const appNeuve = require('../src/app');
    const res = await request(appNeuve).get('/pavillon');
    expect(res.body.data.pavillon).toBe('On est là');
  });
});
