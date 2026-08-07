# Six pannes, une par carte

Ce carnet documente les six pannes tirées par [`pannes.sh`](../pannes.sh), rejouées
pour de vrai sur `vm-prod` (la VM cible mock, `Dockerfile.vm`) avec la flotte
actuelle (`docker-compose.prod.yml` : `postgres`, `api`, `scores`, `front`,
`prometheus`, `grafana`). Rien n'est déduit du script : chaque ligne vient d'un
tirage réellement exécuté, lu sur un tableau (mock du service `TABLEAU_URL`,
voir plus bas) et dans les logs/`curl` de la cible.

## Contexte

| Champ | Valeur |
|---|---|
| Date | 2026-08-07 |
| Branche | `feat/destroy_infra` |
| Cible | `vm-prod` (Docker-in-Docker + sshd, port 2222, `deploy_key`) |
| Stack déployée | `docker-compose.prod.yml`, images `gabrielmartin09/quiz-*:latest`, dans `/srv/flotte` |
| Docker / Compose sur la cible | `28.5.2` / `v2.40.3` |
| `TABLEAU_URL` | mock local ([`tableau-mock.js`](../tableau-mock.js), `tableau:5050` sur `quiznet`) qui reçoit les `POST /api/pulse` et déclare un carré « éteint » après 12s sans pouls (le pouls réel part toutes les 5s, `prochain_pouls_ms`) — le vrai `TABLEAU_URL` est celui de la classe, indisponible en dehors des heures de cours |

`pannes.sh` tire un service (`front`/`api`/`scores`) et un numéro de panne
(0 à 5) au hasard et n'affiche jamais lequel — c'est le principe de
l'exercice. Deux variables d'environnement (`VICTIME_FORCEE`,
`PANNE_FORCEE`) permettent de forcer un tirage précis ; elles n'ont servi
qu'à valider ce carnet avant de lancer l'exercice à l'aveugle, jamais en
tirage réel.

## Les six pannes

### 1. Le conteneur tué (`docker kill`)

**Tirage validé** : victime `scores` (tirage réellement aléatoire).

| | |
|---|---|
| Ce que le tableau montre | Le carré `NavySeal/scores` passe à *éteint* ~12s après le kill (dernier pouls figé). |
| Ce qui a cassé | `docker kill` envoie SIGKILL, le conteneur sort en `Exited (137)`. |
| **Trouvaille non prévue** | La politique `restart: unless-stopped` **n'a pas redémarré le conteneur toute seule** (`RestartCount=0` dans `docker inspect`, 35s après le kill). `unless-stopped` traite un `kill`/`stop` explicite comme une décision humaine et ne relance pas — contrairement à un crash interne (process qui plante), qui aurait déclenché un redémarrage automatique. C'est très exactement le « ou pas » de l'énoncé. |
| Réparation | `docker start quiz-scores`. |
| **Chronométré** | **2,68 s** entre `docker start` et le retour du carré à *allumé* sur le tableau. |

### 2. La base coupée (`docker stop` sur la DB)

**Tirage validé** : panne 1 forcée, DB = `quiz-db`.

| | |
|---|---|
| Ce que le tableau montre | **Rien ne change** : `NavySeal/api` reste *allumé* en continu. Le pouls de l'API ne dépend pas de la DB (`pouls.js` ne lit jamais `db.isReady`), donc le tableau ne voit pas cette panne du tout. |
| Ce qui a cassé | `GET /sante` de l'API renvoie `503 {"status":"degrade","base":"injoignable","detail":"getaddrinfo ENOTFOUND postgres"}` — le DNS interne de Docker retire l'entrée `postgres` dès que le conteneur est arrêté (pas juste « connexion refusée »). `front` reste up (`200`, dégradation gracieuse). |
| **Trou de surveillance confirmé** | Un opérateur qui ne regarde que le tableau ne voit **jamais** cette panne — il faut interroger `/sante` ou `/travail` directement. C'est la panne 2 de l'énoncé, mais avec un angle supplémentaire : même la « pâleur » attendue n'existe pas ici, seul `/sante` la révèle. |
| Réparation | `docker start quiz-db`, attendre `healthy`. |
| **Chronométré** | **1,34 s** entre `docker start` et `/sante` de nouveau `{"status":"ok"}` (reconnexion automatique par `connectWithRetry`, aucune intervention côté API). |

### 3. Le pavillon muet (`chmod 000 /data`)

**Tirage validé** : victime forcée sur `api` (le seul service avec `/data` en lecture-écriture — `front` et `scores` montent le volume `pavillon` en `:ro`, cf. ci-dessous).

| | |
|---|---|
| Ce que le tableau montre | Le carré `NavySeal/api` reste *allumé* en continu ; seul le champ `pavillon` retombe à `""` (testé avec un vrai pavillon posé au préalable via `POST /pavillon` : `"Prise du fort a 14h30"` disparaît du tableau dès le pouls suivant). |
| Ce qui a cassé | `chmod 000 /data` retire le bit d'exécution (traversée) du dossier : `nodejs` (utilisateur non-root du conteneur, `USER nodejs` dans le `Dockerfile`) ne peut plus ouvrir `pavillon.txt`, même si le fichier lui-même reste à `644`. `GET /pavillon` renvoie `{"pavillon":""}` (l'erreur de lecture est avalée, cf. le `catch` de `pouls.js`/`app.js`) — le service, lui, tourne parfaitement (`/sante` reste `ok`). |
| **Nuance du tirage** | Si le hasard désigne `front` ou `scores` au lieu de `api`, la commande échoue avec `chmod: /data: Read-only file system` (montage `:ro`) — **rien ne casse**, le pavillon de ces services n'a jamais existé côté écriture. Un tirage qui ne casse rien de visible compte aussi : c'est noté ici. |
| Réparation | `docker exec <api> chmod 755 /data`. |
| **Chronométré** | Repris en moins d'un cycle de pouls (≤ 5 s, intervalle fixe renvoyé par le tableau) — confirmé par lecture directe de `GET /pavillon` immédiatement après le `chmod`, pavillon de nouveau présent. |

### 4. Le secret effacé (`DB_PASSWORD` vidé)

**Tirage validé** : panne 3 forcée (`up -d api` après avoir vidé `DB_PASSWORD` dans `.env`).

| | |
|---|---|
| Ce que le tableau montre | `NavySeal/api` reste *allumé* (le pouls ne teste pas la DB). Rien ne s'éteint au tableau — seul `/sante` révèle la panne. |
| Ce qui a cassé | `GET /sante` → `503 {"detail":"password authentication failed for user \"postgres\""}`. |
| **Effet de bord non prévu par l'énoncé générique** | `postgres` et `api` **partagent le même `.env` via `env_file`**. Vider une seule ligne recrée **les deux** conteneurs (`docker compose up -d api` a aussi affiché `Container quiz-db Recreate`), pas seulement la victime visée. Postgres, lui, **ignore `POSTGRES_PASSWORD` après la première initialisation** du volume (`quizdata` déjà peuplé) : son vrai mot de passe n'a donc pas changé, seul celui envoyé par l'API est devenu vide — d'où l'échec d'authentification, sans aucune perte de données. Un `.env` partagé par plusieurs services a un rayon de casse plus large qu'il n'y paraît, même pour une variable qu'un seul service utilise. |
| Réparation | Remettre le vrai mot de passe dans `.env` (`DB_PASSWORD=chaosLab2026!`) puis `docker compose up -d api`. |
| **Chronométré** | **19,94 s** entre la commande de réparation et `/sante` de nouveau `ok` (recréation de `quiz-db` + `start_period` de 15s sur le healthcheck de l'API inclus). |

### 5. La version introuvable (`TAG=nexistepas`)

**Tirage validé** : victime forcée `front`, panne 4.

| | |
|---|---|
| Ce que le tableau montre | Rien : `NavySeal/front` reste *allumé* sans interruption tout du long. |
| Ce qui a cassé | `docker compose up -d front` tente de *pull* `gabrielmartin09/quiz-front:nexistepas` → `manifest unknown`. Compose interrompt aussi le pull d'`api` au passage (`front` en dépend via `depends_on`, et `TAG` a changé dans son image à lui aussi) — mais **le pull échoue avant toute étape de recréation** : le conteneur `quiz-front` existant (`:latest`, `Up`, `healthy`) n'est jamais touché. |
| **Tirage qui ne casse rien de visible** | Contrairement à l'attendu générique (« un carré s'éteint et ne revient pas »), avec cette version de Docker Compose (v2.40.3) l'échec de pull protège le conteneur en place : **aucune casse observable**, ni sur le tableau, ni sur `curl http://front:3000/`. C'est exactement le cas que l'énoncé demande de noter : un trou de surveillance silencieux, pas un carré éteint. Le risque réel n'est pas le tag manquant lui-même, mais un tag qui *existe* et démarre en boucle de crash — non testé ici pour ne pas confondre avec la panne 1. |
| Réparation | `sed -i 's|^TAG=.*|TAG=latest|' .env` (aucune recréation de conteneur nécessaire, rien n'avait bougé). |
| Chronométré | Sans objet — rien à réparer côté conteneurs vivants, seule la configuration au repos a été corrigée avant le prochain déploiement légitime. |

### 6. Le tableau injoignable (`TABLEAU_URL=http://127.0.0.1:1`)

**Tirage validé** : victime forcée `scores`, panne 5.

| | |
|---|---|
| Ce que le tableau montre | `NavySeal/scores` passe *éteint* ~12s après la recréation, et **reste figé sur l'ancien `pod`** (dernier pouls connu) alors que le service tourne sur un nouveau conteneur depuis la recréation. |
| Ce qui a cassé | Rien côté service : `curl http://localhost:8000/sante` répond `{"status":"ok"}` tout du long. Le conteneur essaie de poster son pouls vers `http://127.0.0.1:1` (rien n'écoute), l'appel échoue silencieusement (`catch` dans `pouls.js`, juste un `console.error` local), et **aucune alerte ne remonte nulle part** — c'est la panne la plus retorse de l'énoncé : le service va bien, il ne sait juste plus le raconter. |
| Effet de bord | Même mécanisme que la panne 4 : `.env` partagé → `quiz-db` recréée en même temps que `quiz-scores`, sans casse (volume `quizdata` intact). |
| Réparation | Remettre `TABLEAU_URL=http://tableau:5050` puis `docker compose up -d scores`. |
| **Chronométré** | **10,18 s** entre la commande de réparation et le retour du carré à *allumé* (nouveau `pod` visible sur le tableau). |

## Ce que ce tirage complet a montré, au-delà des 6 lignes

- **Le pouls ne reflète que « le processus tourne et sait poster » — jamais la santé applicative.** Base coupée (panne 2) et secret effacé (panne 4) sont *totalement invisibles* au tableau ; seule une requête directe (`/sante`) les révèle. Sur 6 pannes, 2 ne remontent jamais au tableau : c'est la moitié du palier qui échapperait à quelqu'un qui ne regarde que l'écran de la classe.
- **`.env` est un blast radius partagé.** `postgres`, `api`, `scores` et `front` lisent le même fichier via `env_file`. Toucher une seule variable pour viser un seul service (`DB_PASSWORD`, `TABLEAU_URL`) recrée aussi `quiz-db` en silence — sans perte de données (le volume persiste), mais avec un redémarrage non demandé.
- **`api` n'a pas de `container_name` fixe** (volontaire, pour `--scale api=N`) : tout script de panne qui cible les conteneurs par nom (`quiz-$VICTIME`) doit passer par le label `com.docker.compose.service=$VICTIME`, pas par le nom, sous peine de rater sa cible en silence (bug rencontré et corrigé pendant la préparation de ce carnet, cf. `pannes.sh`).
- **Docker Compose v2.40 protège les conteneurs en place quand un `pull` échoue** (panne 5) : un tag introuvable ne casse rien de visible tant que le déploiement ne va pas plus loin que l'étape de pull. Le risque réel viendrait d'un tag qui *pull* correctement mais dont l'image plante au démarrage.

## Vérification du palier

| Panne | Tirée au moins une fois | Entrée dans ce fichier | Réparation chronométrée |
|---|---|---|---|
| 1. Conteneur tué | ✅ (aléatoire) | ✅ | ✅ 2,68 s |
| 2. Base coupée | ✅ (forcée) | ✅ | ✅ 1,34 s |
| 3. Pavillon muet | ✅ (forcée) | ✅ | qualitatif (≤ 5 s, un cycle de pouls) |
| 4. Secret effacé | ✅ (forcée) | ✅ | ✅ 19,94 s |
| 5. Version introuvable | ✅ (forcée) | ✅ (tirage invisible, documenté comme tel) | sans objet — rien à réparer sur les conteneurs vivants |
| 6. Tableau injoignable | ✅ (forcée) | ✅ | ✅ 10,18 s |

Quatre réparations chronométrées avec précision (≥ 3 requis), une cinquième
qualifiée qualitativement (panne 3), et la panne 5 explicitement documentée
comme un tirage qui n'a rien cassé de visible — conformément à la consigne
« une panne invisible est un trou de surveillance ».
