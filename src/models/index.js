const sequelize = require('../config/database');
const Question = require('./question');
const Reponse = require('./reponse');

const RETRY_DELAY_MS = 5000;

const db = {
  sequelize,
  Question,
  Reponse,
  // État de la connexion à la base, exposé pour la route /ready
  // et pour le middleware de garde des routes /api/*.
  isReady: false
};

Question.hasMany(Reponse, { foreignKey: 'questionId' });
Reponse.belongsTo(Question, { foreignKey: 'questionId' });

// Un quiz sans questions est un carré plein qui ne montre rien. Le seed ne
// tourne que si la table est vide : il ne réécrit jamais par-dessus des
// questions ajoutées ensuite, et il est donc rejouable sans risque.
const QUESTIONS_INITIALES = [
  {
    texte: 'Que fait "docker compose down -v" de plus que "docker compose down" ?',
    choix: ['Rien', 'Il supprime les volumes', 'Il supprime les images', 'Il force le rebuild'],
    bonneReponse: 1,
    ordre: 1
  },
  {
    texte: 'Dans un Dockerfile, à quoi sert EXPOSE ?',
    choix: ['À publier le port', 'À ouvrir le pare-feu', 'À documenter, rien de plus', 'À mapper vers l\'hôte'],
    bonneReponse: 2,
    ordre: 2
  },
  {
    texte: 'Quel objet Kubernetes maintient un nombre de copies en vie ?',
    choix: ['Le Pod', 'Le Service', 'Le Deployment', 'L\'Ingress'],
    bonneReponse: 2,
    ordre: 3
  },
  {
    texte: 'Une readiness probe qui échoue, que provoque-t-elle ?',
    choix: ['Le pod redémarre', 'Le pod quitte le Service', 'Le node est vidé', 'Rien du tout'],
    bonneReponse: 1,
    ordre: 4
  },
  {
    texte: 'Un Secret Kubernetes encode ses valeurs en base64. Est-ce du chiffrement ?',
    choix: ['Oui', 'Non, juste un encodage', 'Oui si le cluster est en TLS', 'Seulement en production'],
    bonneReponse: 1,
    ordre: 5
  },
  {
    texte: 'Où lit-on la cause d\'un conteneur tué pour dépassement mémoire ?',
    choix: ['Dans les logs', 'Dans les events', 'Dans "Last State" du describe', 'Dans kubectl top'],
    bonneReponse: 2,
    ordre: 6
  }
];

async function seedSiVide() {
  const total = await Question.count();
  if (total > 0) return;

  await Question.bulkCreate(
    QUESTIONS_INITIALES.map((q, index) => ({ ...q, active: index === 0 }))
  );
  console.log(`🌱 ${QUESTIONS_INITIALES.length} questions insérées`);
}

// Tente de se connecter à la base en boucle, sans jamais lancer d'exception
// ni faire planter le process : ainsi le conteneur de l'API peut démarrer
// (et rester démarré) même si Postgres n'est pas encore joignable.
db.connectWithRetry = async function connectWithRetry() {
  while (!db.isReady) {
    try {
      await sequelize.authenticate();
      console.log('✅ Database connection established successfully.');

      if (process.env.NODE_ENV !== 'production') {
        await sequelize.sync({ alter: true });
        console.log('✅ Database synchronized');
      } else {
        await sequelize.sync();
      }

      await seedSiVide();

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

db.seedSiVide = seedSiVide;

module.exports = db;
