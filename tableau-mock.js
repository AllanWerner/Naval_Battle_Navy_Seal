// Mock local du "tableau de la classe" (TABLEAU_URL) : recoit les POST
// /api/pulse envoyes par src/pouls.js et stats_api/pouls.py, et expose l'etat
// des carres sur GET /etat. Sert a rejouer pannes.sh (docs/PANNES.md) sans
// dependre du vrai serveur de la classe.
//
// A lancer sur la cible (vm-prod), sur le meme reseau que la stack :
//   docker run -d --name tableau --network quiznet -p 5050:5050 \
//     -v $(pwd)/tableau-mock.js:/server.js node:20-alpine node server.js
// Puis TABLEAU_URL=http://tableau:5050 dans le .env deploye.
const http = require('http');

const PORT = process.env.PORT || 5050;
const TIMEOUT_MS = 12000; // pas de pouls depuis 12s -> carre eteint

const carres = new Map(); // cle: groupe/service -> dernier pouls recu

function cle(groupe, service) {
  return `${groupe}/${service}`;
}

function etatDe(entree) {
  if (!entree) return 'inconnu';
  const age = Date.now() - entree.recu;
  return age > TIMEOUT_MS ? 'eteint' : 'allume';
}

const server = http.createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/api/pulse') {
    let corps = '';
    req.on('data', (chunk) => { corps += chunk; });
    req.on('end', () => {
      let donnees;
      try {
        donnees = JSON.parse(corps);
      } catch {
        res.writeHead(400).end('{"error":"json invalide"}');
        return;
      }
      const k = cle(donnees.groupe, donnees.service);
      carres.set(k, { ...donnees, recu: Date.now() });
      console.log(
        `[tableau] ${new Date().toISOString()} pouls ${k} pod=${donnees.pod} ` +
        `pavillon="${donnees.pavillon}" encaisses=${donnees.encaisses} total=${donnees.total_encaisse}`
      );
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ prochain_pouls_ms: 5000, coups_a_encaisser: 0 }));
    });
    return;
  }

  if (req.method === 'GET' && req.url === '/etat') {
    const vue = {};
    for (const [k, v] of carres.entries()) {
      vue[k] = {
        etat: etatDe(v),
        depuis_secondes: Math.round((Date.now() - v.recu) / 1000),
        pavillon: v.pavillon,
        couleur: v.couleur,
        version: v.version,
        pod: v.pod,
        total_encaisse: v.total_encaisse,
      };
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(vue, null, 2));
    return;
  }

  res.writeHead(404).end();
});

server.listen(PORT, () => console.log(`[tableau] mock en ecoute sur ${PORT}`));
