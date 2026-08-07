// Copie conforme de src/pouls.js.
//
// Les deux images se construisent avec des contextes de build separes
// (./front et la racine, cf. la matrice de .github/workflows/ci-cd.yml) : un
// Dockerfile ne peut pas COPY hors de son contexte, donc le module ne peut
// pas etre partage sans transformer le depot en monorepo a paquets. Toute
// correction faite ici est a reporter dans src/pouls.js, et inversement.

const fs = require('fs');
const os = require('os');

const TABLEAU = process.env.TABLEAU_URL;
const GROUPE = process.env.GROUPE;
const COULEUR = process.env.COULEUR || '#888888';
const SERVICE = process.env.SERVICE;
const VERSION = process.env.VERSION || 'dev';
const PAVILLON = process.env.PAVILLON_FICHIER || '/data/pavillon.txt';
const MOI = process.env.URL_INTERNE || 'http://localhost:3000';

let totalEncaisse = 0; // depuis le démarrage de ce process, affiché sur le carré
let aDeclarer = 0;     // encaissés depuis le dernier pouls, ce que le tableau attend

// Le pavillon est relu du disque à chaque pouls : s'il vit dans un volume, il
// traverse le redéploiement, sinon il disparaît du tableau devant toute la classe.
// Ici le volume est monté en lecture seule : le front affiche le pavillon, c'est
// l'API qui l'écrit.
function lirePavillon() {
  try {
    return fs.readFileSync(PAVILLON, 'utf8').trim();
  } catch {
    return '';
  }
}

// Un coup, c'est une vraie requête sur sa propre route de travail. Les coups partent
// par paquets de dix en parallèle, sinon un gros retard bloquerait le pouls suivant.
async function encaisser(nombre) {
  const aFaire = Math.min(nombre, 300);
  for (let debut = 0; debut < aFaire; debut += 10) {
    const paquet = [];
    for (let i = debut; i < Math.min(debut + 10, aFaire); i++) {
      paquet.push(
        fetch(`${MOI}/travail`)
          .then((reponse) => {
            if (reponse.ok) {
              totalEncaisse++;
              aDeclarer++;
            }
          })
          .catch(() => {})
      );
    }
    await Promise.all(paquet);
  }
}

async function envoyerPouls() {
  let attente = 5000;
  const declares = aDeclarer;
  try {
    const reponse = await fetch(`${TABLEAU}/api/pulse`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        groupe: GROUPE,
        couleur: COULEUR,
        service: SERVICE,
        pod: os.hostname(),
        version: VERSION,
        pavillon: lirePavillon(),
        encaisses: declares,
        total_encaisse: totalEncaisse,
      }),
    });
    // Les coups déclarés ne sont retirés du compteur local qu'une fois le tableau
    // au courant : si l'appel échoue, ils repartiront dans le pouls suivant.
    aDeclarer -= declares;
    const ordre = await reponse.json();
    attente = ordre.prochain_pouls_ms || 5000;
    if (ordre.coups_a_encaisser > 0) await encaisser(ordre.coups_a_encaisser);
  } catch (erreur) {
    console.error('[pouls] tableau injoignable :', erreur.message);
  }
  setTimeout(envoyerPouls, attente);
}

function demarrerLePouls() {
  if (!TABLEAU || !GROUPE || !SERVICE) {
    console.error('[pouls] TABLEAU_URL, GROUPE et SERVICE sont obligatoires');
    return;
  }
  console.log(`[pouls] ${GROUPE}/${SERVICE} vers ${TABLEAU}`);
  envoyerPouls();
}

module.exports = { demarrerLePouls };
