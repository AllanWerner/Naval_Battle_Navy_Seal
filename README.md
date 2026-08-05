# Todo API — Projet fil rouge DevOps / Docker

Projet réalisé dans le cadre de la formation *Initiation à la méthodologie DevOps, GitLab CI/CD et conteneurisation Docker*. L'objectif : dockeriser, mettre en pipeline et déployer une API de gestion de tâches, de bout en bout.

## Ce que fait le projet

Une API REST de gestion de tâches (CRUD complet) écrite en Node.js, connectée à une base PostgreSQL persistante, accompagnée d'un second service en Python qui expose des statistiques en lecture. Toute la stack est conteneurisée, orchestrée par Docker Compose, configurée entièrement par variables d'environnement, et publiée sur un registry pour un redéploiement sans code source local.

## Stack technique

| Composant | Rôle |
|---|---|
| `task_api` | API Node.js / Express — CRUD de tâches |
| `postgres` | PostgreSQL — persistance des tâches (volume nommé) |
| `stats-api` | API Python / FastAPI — statistiques en lecture (tâches par statut) |


Tous les services communiquent sur un network Docker custom (`tasknetwork`) ; seuls `task_api` et `stats-api` publient un port vers l'hôte, jamais `postgres`.

## Prérequis

- Docker Desktop (ou Docker Engine + Docker Compose)
- Un compte Docker Hub (uniquement pour publier/récupérer les images en production)

## Installation et lancement

### 1. Cloner le dépôt

```bash
git clone <url-du-depot>
cd <nom-du-dossier>
```

### 2. Configurer les variables d'environnement

```bash
cp .env.example .env
```

Puis remplir `.env` avec ses propres valeurs (voir tableau ci-dessous). Ce fichier n'est **jamais commité**.

### 3a. Lancer en développement (build depuis les sources)

```bash
docker compose up -d --build
```

Devrait afficher le démarrage du network, du volume, et des trois conteneurs. Vérifier :

```bash
docker compose ps
```

Les trois services doivent être à l'état `running` (`healthy` pour `postgres`).

### 3b. Lancer en production (depuis les images publiées, sans code source)

```bash
docker compose -f docker-compose.prod.yml up -d
```

Fonctionne dans un dossier ne contenant que `docker-compose.prod.yml` et `.env` — aucune ligne de code source nécessaire, les images étant tirées depuis le registry.

### 4. Arrêter la stack

```bash
docker compose down          # conserve les données (volume intact)
docker compose down -v       # ⚠️ supprime aussi les données, irréversible
```

## Variables d'environnement

| Variable | Description | Exemple |
|---|---|---|
| `DB_HOST` | Nom du service Postgres sur le network | `db` |
| `DB_PORT` | Port interne Postgres | `5432` |
| `DB_NAME` | Nom de la base | `taskdb` |
| `DB_USER` | Utilisateur Postgres | `postgres` |
| `DB_PASSWORD` | Mot de passe Postgres | *(à définir)* |
| `PORT` | Port d'écoute de `task_api` | `4000` |


## Endpoints

### `task_api` — `http://localhost:4000`

| Méthode | Route | Description |
|---|---|---|
| `GET` | `/health` | Vérifie que le service répond (liveness) |
| `GET` | `/ready` | Vérifie que la base est joignable (readiness) |
| `GET` | `/metrics` | Métriques Prometheus (texte brut) |
| `POST` | `/api/tasks` | Crée une tâche |
| `GET` | `/api/tasks` | Liste toutes les tâches |
| `GET` | `/api/tasks/:id` | Récupère une tâche |
| `PUT` | `/api/tasks/:id` | Modifie une tâche |
| `DELETE` | `/api/tasks/:id` | Supprime une tâche |

### `stats-api` — `http://localhost:8000`

| Méthode | Route | Description |
|---|---|---|
| `GET` | `/health` | Vérifie que le service répond (indépendant de Postgres) |
| `GET` | `/stats` | Nombre de tâches par statut |

Exemple de vérification manuelle :

```bash
curl -X POST http://localhost:4000/api/tasks \
  -H "Content-Type: application/json" \
  -d '{"title":"Ma tâche test","status":"pending"}'

curl http://localhost:4000/api/tasks
curl http://localhost:4000/metrics
curl http://localhost:8000/stats
```

## Structure du projet

```
.
├── .github/workflows/
│   └── ci-cd.yml            # test → build (Docker Hub) → deploy (SSH, self-hosted)
├── docs/
│   └── PROCEDURE_DEPLOIEMENT.md
├── src/
│   ├── routes/tasks.js
│   ├── models/task.js
│   ├── middleware/errorHandler.js
│   ├── metrics.js           # instrumentation Prometheus
│   └── app.js
├── stats_api/
│   ├── main.py
│   ├── requirements.txt
│   └── Dockerfile
├── tests/
│   ├── setup.js
│   └── tasks.test.js
├── grafana/
│   ├── provisioning/        # datasource + provider chargés au démarrage
│   └── dashboards/todo-api.json
├── Dockerfile
├── Dockerfile.vm            # maquette de la machine cible (Docker-in-Docker + SSH)
├── prometheus.yml
├── .dockerignore
├── .gitignore
├── .env.example
├── docker-compose.yml
├── docker-compose.prod.yml
├── package.json
└── README.md
```

## Publication des images

```bash
docker compose build
docker images                                          # vérifier le nom réel généré par Compose
docker tag <nom-genere-task_api>  allanwer/task_api-api:1.0.0
docker tag <nom-genere-stats-api> allanwer/task_api-stats-api:1.0.0
docker push allanwer/task_api-api:1.0.0
docker push allanwer/task_api-stats-api:1.0.0
```

Depuis le Chapitre 11, cette publication est automatisée par la pipeline (voir ci-dessous) : ces commandes ne servent plus qu'en dépannage manuel.

## Pipeline CI/CD

`.github/workflows/ci-cd.yml`, déclenché sur chaque `push`, trois jobs enchaînés :

| Job | Runner | Rôle |
|---|---|---|
| `test` | `ubuntu-latest` | `npm test` contre une vraie Postgres de service (healthcheck) |
| `build` | `ubuntu-latest` | build des images `task_api-api` et `task_api-stats-api`, taguées au sha du commit + `latest` ; **poussées sur Docker Hub uniquement sur `master`** |
| `deploy` | `self-hosted` | uniquement sur `master`, après `build` : envoie `docker-compose.prod.yml` / `prometheus.yml` / `grafana/` par SSH vers `/srv/todo`, lance `TAG=<sha> docker compose up -d`, vérifie `/health` |

Une branche de travail fait donc tourner `test` et `build` (sans rien publier ni déployer) ; seul un push sur `master` va jusqu'au déploiement.

**Secrets du dépôt requis** (`Settings > Secrets and variables > Actions`) :

| Secret | Usage |
|---|---|
| `DOCKERHUB_USERNAME`, `DOCKERHUB_TOKEN` | authentification Docker Hub (job `build`) |
| `DEPLOY_SSH_KEY` | clé privée de déploiement, chargée dans un agent SSH éphémère (job `deploy`) — jamais écrite en clair |
| `DEPLOY_HOST`, `DEPLOY_PORT`, `DEPLOY_USER` | coordonnées de la machine cible |

**Runner self-hosted** : la machine cible de déploiement n'étant pas joignable par les runners hébergés par GitHub, une machine doit être enregistrée comme runner self-hosted (`Settings > Actions > Runners`) avec `./run.sh` **laissé ouvert en continu** — sans lui, le job `deploy` reste `Queued` indéfiniment. Détails dans [`docs/PROCEDURE_DEPLOIEMENT.md`](docs/PROCEDURE_DEPLOIEMENT.md).

## Monitoring

- `task_api` expose `GET /metrics` (texte brut, format Prometheus) : `http_requests_total{method,route,status}`, `http_request_duration_seconds` (histogramme, pour le p95), et `tasks_created_total` (mesure métier).
- `prometheus.yml` scrape l'API toutes les 5s.
- Grafana est **pré-configuré** (`grafana/provisioning/`) : datasource Prometheus et dashboard `todo-api.json` chargés automatiquement au démarrage, aucun clic manuel nécessaire.
- Sur la machine cible (stack `docker-compose.prod.yml`) : Prometheus sur le port `9090`, Grafana sur le port `3001`.

Dashboard (4 golden signals + 1 panneau métier) :

| Panneau | Requête | Question |
|---|---|---|
| Disponibilité | `up{job="todo-api"}` | La cible répond-elle ? |
| Trafic | `sum(rate(http_requests_total{job="todo-api"}[5m]))` | Combien de requêtes/s ? |
| Erreurs | `sum(rate(http_requests_total{job="todo-api",status=~"5.."}[5m]))` | Part d'erreurs serveur ? |
| Latence p95 | `histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket{job="todo-api"}[5m])) by (le))` | p95 du temps de réponse |
| Tâches créées (bonus) | `tasks_created_total{job="todo-api"}` | Combien de tâches créées depuis le démarrage ? |

## Journal de bord

### Chapitre 5 — Le socle (Todo API)

CRUD testé avec les 3 cas demandés (création + lecture, 404 sur ID inexistant, 400 sur entrée invalide).


### Chapitre 6 — Dockerfile de production, Networks et Volumes

- Base Postgres branchée sur son propre conteneur, volume nommé dédié à la persistance des données.
- Réseau custom (`tasknetwork`) créé pour que l'API joigne la base par son nom de conteneur plutôt que par IP.
- Port `5432` retiré de la configuration Postgres : la base n'est plus joignable depuis la machine hôte, uniquement depuis les autres conteneurs du network.

**Mission A — persistance.** Volume nommé créé pour la base, conteneur Postgres lancé dessus :

```bash
docker volume create taskvolume

docker run -d \
  --name postgres-db \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=changeme \
  -e POSTGRES_DB=taskdb \
  -v taskvolume:/var/lib/postgresql/data \
  -p 5432:5432 \
  postgres:16-alpine
```

À ce stade, sans network custom, `postgres-db` atterrit sur le bridge par défaut : l'API ne peut le joindre que par IP (`docker inspect postgres-db`), pas encore par son nom. C'est volontaire, corrigé par la Mission B.

*Test de persistance :*

```bash
curl -X POST http://localhost:3000/api/tasks \
  -H "Content-Type: application/json" \
  -d '{"description":"Tâche persistante","status":"pending"}'

docker stop postgres-db
docker start postgres-db
curl http://localhost:3000/api/tasks   # → la tâche est toujours présente
```

Confirme que le volume `taskvolume` vit indépendamment du conteneur : la tâche survit à sa suppression complète, seule une suppression explicite du volume (`docker volume rm taskvolume`) l'effacerait.

**Mission B — isolation réseau.** Network custom créé, port `5432` retiré de la commande de lancement :

```bash
docker network create tasknetwork

docker rm -f postgres-db

docker run -d \
  --name postgres-db \
  --network tasknetwork \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=changeme \
  -e POSTGRES_DB=taskdb \
  -v taskvolume:/var/lib/postgresql/data \
  postgres:16-alpine
```

*Vérification que l'API joint bien la base par son nom :* l'API, reconfigurée avec `DB_HOST=postgres-db`, répond normalement sur `GET /api/tasks` sans jamais connaître d'adresse IP.

Résultat attendu : `tasknetwork` liste bien `postgres-db` (et le conteneur de l'API une fois qu'il rejoint le même network) via `docker network inspect tasknetwork`, et plus aucun client externe au network ne peut atteindre Postgres.

### Chapitre 7 — Docker Compose et configuration

Toute la stack décrite dans un seul `docker-compose.yml`, configuration externalisée dans `.env` (jamais commité) avec `.env.example` comme template pour l'équipe. Plus aucun identifiant de base en dur dans le code source.

**Réconciliation des noms créés à la main au chapitre 6.** Le network `tasknetwork` et le volume `taskvolume` existaient déjà, créés manuellement. Deux options : les laisser tels quels et les déclarer comme *externes* dans `docker-compose.yml`, ou laisser Compose en créer de nouveaux à son nom par défaut (`<projet>_default`). Choix retenu : garder les noms du chapitre 6, pour ne pas perdre les données déjà présentes dans `taskvolume`.

```yaml
networks:
  tasknetwork:
    external: true

volumes:
  taskvolume:
    external: true
```

Sans `external: true`, Compose aurait tenté de créer un nouveau network/volume portant ce nom et aurait échoué avec un conflit (`network with name tasknetwork already exists`), ou aurait silencieusement créé un doublon préfixé selon la version de Compose. Vérification après `docker compose up -d` :

```bash
docker network inspect tasknetwork   # → liste bien postgres, task_api, stats-api
docker volume inspect taskvolume     # → toujours le même volume, données du chapitre 6 intactes
```

**Healthcheck Postgres.** Configuré ainsi dans le service `postgres` :

```yaml
healthcheck:
  test: ["CMD", "pg_isready", "-U", "postgres", "-d", "taskdb"]
  interval: 5s
  timeout: 3s
  retries: 5
```

Mesure au démarrage :

```bash
docker compose up -d
docker compose ps
# postgres passe de "starting" à "healthy" en ~6 secondes (2 tentatives d'interval 5s après le démarrage du process Postgres)
```

`task_api`, avec `depends_on: postgres: condition: service_healthy`, reste en `created` pendant cette fenêtre puis démarre une fois `postgres` `healthy` — sans ce couplage, l'API aurait tenté sa première connexion avant que Postgres accepte des requêtes, et aurait planté ou tourné en boucle de redémarrage (`restart: unless-stopped`).

**Ce qui a dû être ajusté** : le nom du service dans `docker-compose.yml` (`postgres`) est devenu le nom d'hôte pour la résolution DNS interne, remplaçant `postgres-db` utilisé à la main au chapitre 6 dans la configuration de l'API.


### Chapitre 8 — Service Python (stats-api)

Service `stats-api` branché sur la même base Postgres que `task_api`, en lecture seule (`GET /stats`, agrégation par statut).

**Ce qui a cassé** : le premier appel à `/stats` renvoyait une erreur `500 Internal Server Error` brute (alors que `/health` répondait correctement, car indépendant de la base). Cause identifiée via `docker compose logs stats-api` : la table réelle s'appelle `Tasks` (T majuscule), créée avec des guillemets côté Node (donc sensible à la casse pour Postgres), alors que `TABLE_NAME = "tasks"` dans `main.py` était en minuscule et interpolé sans guillemets SQL — Postgres repliait donc silencieusement la valeur en minuscule et ne trouvait pas de table correspondante (`UndefinedTable`), une erreur non catchée qui remontait en 500 générique plutôt qu'en 503 propre.

**Correction** : `TABLE_NAME = "Tasks"` avec la casse exacte, **et** ajout de guillemets doubles dans la requête SQL elle-même (`FROM "Tasks"`, `SELECT "status"`), sans quoi Postgres continue de lowercaser l'identifiant au moment de l'exécution.


### Chapitre 9 — Publication et redéploiement

Images `task_api` et `stats-api` taguées puis poussées sur Docker Hub. Fichier `docker-compose.prod.yml` créé, référençant les images publiées (`image:`) au lieu de les construire depuis les sources (`build:`).

**Ce qui a cassé** : tentative de `docker tag` sur un nom d'image supposé (`task_api:latest`) avant tout build — l'image n'existait pas encore, donc Docker Compose ne l'avait pas non plus créée sous ce nom, résultat `Error response from daemon: No such image`. Rappel retenu : Compose nomme les images buildées selon le nom du dossier projet et du service (ex. `task_api-task_api`), jamais un nom fixe deviné à l'avance — l'ordre correct est `docker compose build` puis `docker images` pour lire le nom réel avant de tagger.

**Test de redéploiement sans code source.** Dans un dossier vide, avec uniquement `docker-compose.prod.yml` et un `.env` reconstruit à partir de `.env.example` :

```bash
mkdir /tmp/test-redeploy && cd /tmp/test-redeploy
# copie manuelle de docker-compose.prod.yml et .env, rien d'autre
docker compose -f docker-compose.prod.yml up -d
docker compose -f docker-compose.prod.yml ps
```

Résultat attendu : les trois services (`postgres`, `task_api`, `stats-api`) démarrent normalement, tirés directement du registry (`Pulling`, pas `Building` dans la sortie), sans qu'aucun fichier de code source ne soit présent dans le dossier. Vérification fonctionnelle :

```bash
curl http://localhost:3000/api/tasks
curl http://localhost:8000/stats
```

Les deux répondent normalement, preuve que le redéploiement depuis les seules images publiées reconstitue une stack fonctionnelle.

**Vérification `docker history` — absence de secret dans les images publiées :**

```bash
docker history --no-trunc allanwer/task_api-api:1.0.0
docker history --no-trunc allanwer/task_api-stats-api:1.0.0
```

Résultat attendu : aucune ligne ne doit faire apparaître de valeur issue du `.env` (mot de passe Postgres, clé quelconque). Point de vigilance particulier sur les couches `COPY` : si un `.env` avait été copié par erreur avant d'être supprimé dans une instruction suivante, il resterait lisible dans la couche `COPY` malgré sa suppression apparente — d'où l'importance du `.dockerignore` (qui exclut `.env` du build context) plutôt que de compter sur un `RUN rm .env` a posteriori.

Aucune trace de secret trouvée dans les deux images à ce contrôle : seules des couches `RUN npm ci` / `RUN pip install`, `COPY` du code applicatif et `WORKDIR`/`USER`/`EXPOSE`/`HEALTHCHECK` apparaissent dans l'historique.

### Chapitre 10 — Mesurer et optimiser


| Image | Taille | Couches (poids max) | Build froid / chaud | 
|---|---|---|---|
| `task_api` |266MB | 17(160MB) | 0m7.312s / 0m1.036s| 
| `stats-api` | 210MB | 21(87.4MB) | 0m5.475s / 0m0.995s| 


 Temps 1ère réponse HTTP = 0.711835s

Commandes de référence :

```bash
# Pour obtenir la taille des images
docker images | grep -E "task_api*" 

# Pour obtenir le nombre de couches
docker history --format "{{.ID}}" task_api-api | wc -l   
docker history --format "{{.ID}}" task_api-stats-api | wc -l 

# Pour obtenir le poids de la plus lourde
docker history --no-trunc --format "{{.Size}}\t{{.CreatedBy}}" task_api-api | sort -rh | head -n 1
docker history --no-trunc --format "{{.Size}}\t{{.CreatedBy}}" task_api-stats-api | sort -rh | head -n 1

# Build Froid
docker system prune -f && time docker build --no-cache -t task_api-api .
docker system prune -f && time docker build --no-cache -t task_api-stats-api .

# Buid Chaud
time docker build -t task_api-api .
time docker build -t task_api-stats-api .

# Lancement du script
chmod +x script_mesure.sh
./script_mesure.sh
```

### Chapitre 11 — La pipeline déménage sur Task API

`.github/workflows/ci-cd.yml` créé avec les trois jobs `test` / `build` / `deploy` (détails dans la section [Pipeline CI/CD](#pipeline-cicd) plus haut). Règle de déclenchement : `test` et `build` tournent sur tout push ; `build` ne pousse sur Docker Hub que si `github.ref == 'refs/heads/master'` (ce dépôt garde `master` comme branche par défaut, jamais renommée en `main`) ; `deploy` n'est déclenché que sur `master`, après succès de `build`.

### Chapitre 12 — La VM cible (Docker-in-Docker + SSH)

`Dockerfile.vm` construit et lancé localement (`vm-prod`, conteneur privilégié avec son propre Docker et son propre `sshd`), pour servir de machine de production de substitution.

**Ce qui a cassé** : redéfinir `ENTRYPOINT` dans `Dockerfile.vm` sans redéfinir `CMD` fait perdre le `CMD ["dockerd"]` hérité de l'image de base `docker:28-dind` — le conteneur démarrait puis s'arrêtait aussitôt (`docker-entrypoint.sh: parameter not set`). Corrigé en redéclarant `CMD ["dockerd"]` explicitement après l'`ENTRYPOINT`.

**Vérifications passées** :
- Connexion SSH avec `deploy_key` réussie, `docker run --rm hello-world` exécuté à l'intérieur de la VM.
- La même connexion sans `-i deploy_key` : refusée (`Permission denied (publickey,password,keyboard-interactive)`).
- `docker restart vm-prod` puis reconnexion : les images déjà tirées (`hello-world`) sont toujours là — seul `/var/lib/docker` est persisté par le volume nommé `vm-prod-data`, pas `/srv/todo` (attendu : `/srv/todo` vit sur la couche writable du conteneur, effacée si le conteneur est recréé avec `docker rm` + `docker run`, contrairement à un simple `docker restart`).

### Chapitre 13 — Runner self-hosted et job de déploiement

Le job `deploy` du workflow est écrit (`runs-on: self-hosted`, agent SSH, `scp` vers `/srv/todo`, `docker compose up -d`, vérification `/health`). Ce qui reste à faire *en dehors de ce dépôt*, à la charge de l'astreinte :
1. Enregistrer une machine comme runner self-hosted (`Settings > Actions > Runners > New self-hosted runner`) et laisser `./run.sh` ouvert.
2. Créer les 6 secrets listés dans la section [Pipeline CI/CD](#pipeline-cicd).
3. Faire le premier `git push` réel sur `master` pour valider la chaîne complète bout en bout.

### Chapitre 14 — Rejouer, et revenir en arrière

Cycle rejoué manuellement sur `vm-prod` (déploiement SSH + `docker compose`, exactement les commandes que la pipeline exécute) pour obtenir de vraies mesures avant le premier déploiement piloté par GitHub Actions :

| Étape | Commande | Durée mesurée |
|---|---|---|
| Déploiement normal (images déjà présentes localement) | `TAG=sha-A docker compose -f docker-compose.prod.yml up -d` puis `/health` OK | **7,6 s** |
| Redéploiement identique (idempotence) | même commande, même `TAG` | **0,85 s**, tous les conteneurs restent `Running` (aucune recréation) |
| Déploiement d'une régression volontaire | `TAG=sha-B ...` (image dont le process plante au démarrage) | `todo-api` part en `Restarting` en boucle, `up{job="todo-api"}` passe à **0**, `/health` ne répond plus |
| Retour arrière | `TAG=sha-A docker compose -f docker-compose.prod.yml up -d` | **3,0 s** jusqu'à `/health` de nouveau `200` ; la tâche créée avant la régression est toujours présente (persistance du volume `taskvolume` non touchée) |
| Retour arrière vers un tag inexistant | `TAG=sha-inexistant ...` | échoue franchement (`manifest unknown`, code de sortie 1), **aucun conteneur en cours n'est touché** — `todo-api` reste sain pendant l'échec |

La régression utilisée ici est volontairement grossière (process qui `throw` immédiatement) pour obtenir une panne nette et reproductible ; le [script d'incident de la passation](docs/PROCEDURE_DEPLOIEMENT.md#5-pannes-connues-et-leur-signature-dans-le-tableau-de-bord) couvre des pannes plus variées.

### Chapitre 15 — Les tests qui touchent la base, dans la pipeline

`jest` + `supertest`, contre une vraie Postgres (service de la pipeline, ou conteneur jetable en local). Les 4 cas demandés, tous verts :

```
√ crée une tâche puis la relit par son identifiant
√ renvoie un 404 propre pour une tâche inexistante
√ renvoie un 400 sur un corps de requête invalide
√ supprime une tâche et vérifie qu'elle a disparu
```

**Ce qui a nécessité un ajustement** : `src/app.js` appelait `app.listen()` et `db.connectWithRetry()` de façon inconditionnelle au chargement du module. En important `app` depuis les tests (`supertest` n'a pas besoin d'un vrai listener réseau), cela ouvrait un second serveur HTTP en plus de celui de `supertest`, laissant un handle ouvert après les tests. Corrigé en encadrant ce bloc d'un `if (require.main === module)` : le comportement en production (`node src/app.js`) est inchangé, les tests peuvent `require()` l'app sans effet de bord réseau.

`tests/setup.js` synchronise le schéma avant le premier test (`connectWithRetry`) et purge la table `Task` après chaque test (`truncate: true, force: true`) pour repartir d'un état connu.

### Chapitre 16 — Rendre l'API mesurable

`src/metrics.js` (prom-client) : compteur `http_requests_total{method,route,status}`, histogramme `http_request_duration_seconds` (p95), compteur métier `tasks_created_total`. Middleware monté avant toutes les routes, y compris pour les 404 non matchées.

**Piège du sujet vérifié** : appeler 3 fois `GET /api/tasks` fait bien augmenter `http_requests_total{method="GET",route="/api/tasks/",status="200"}` de 3, ni plus ni moins. Les routes non trouvées (`GET /route/inconnue`) sont comptées sous un label fixe (`unmatched`), jamais sous l'URL brute — et l'identifiant d'une tâche n'apparaît jamais comme valeur de label (`route="/api/tasks/:id"` pour toutes les tâches, quel que soit leur id).

### Chapitre 17 — Prometheus et Grafana sur la machine cible

Stack complète (`todo-api`, `todo-db`, `todo-stats-api`, `prometheus`, `grafana`) déployée sur `vm-prod` via le `docker-compose.prod.yml` de ce dépôt. Grafana provisionné automatiquement (datasource + dashboard, aucun clic).

**Ce qui a cassé** : le premier mapping de port choisi pour Grafana au lancement de `vm-prod` (`-p 3001:3000`) supposait que Grafana écoutait directement sur le port 3000 *à l'intérieur* de la VM. En réalité, le `docker-compose.prod.yml` publie déjà Grafana sur le port **3001** de la VM (`"3001:3000"` dans le service `grafana`) — il fallait donc mapper le port externe de la VM vers ce même 3001 (`-p 3001:3001`), pas vers 3000. Corrigé ; noté dans `docs/PROCEDURE_DEPLOIEMENT.md` pour la prochaine personne qui relance `vm-prod`.

Relevé (requêtes interrogées directement sur l'API HTTP de Prometheus, mêmes valeurs que les panneaux Grafana) :

| Moment | `up` | Requêtes/s | Taux d'erreur (5xx/s) | p95 |
|---|---|---|---|---|
| Au repos | 1 | 0,24 | 0 | 4,8 ms |
| Pendant la charge (boucle de trafic, 300 requêtes) | 1 | 7,75 | 2,37 (dues aux appels volontaires sur `/api/tasks/inexistant`) | 5,0 ms |
| Pendant l'incident (`docker stop todo-api`) | **0** (basculé en 0,15 s, largement sous les 15 s attendues) | — | — | — |
| Pendant une panne base (`docker stop todo-db`) | 1 (l'API elle-même reste vivante) | — | en hausse (`ENOTFOUND postgres`, 500) | — |

Signature bien différente entre les deux pannes testées : arrêt de l'API → `up` à 0 côté Prometheus ; arrêt de la base → `up` reste à 1 mais les requêtes `/api/*` échouent en 5xx. Les deux se rétablissent seules dès que le conteneur arrêté est relancé (`todo-api` en redémarrant, `todo-db` grâce à `connectWithRetry` côté API).

### Chapitre 18 — Procédure de déploiement

Rédigée dans [`docs/PROCEDURE_DEPLOIEMENT.md`](docs/PROCEDURE_DEPLOIEMENT.md) : prérequis, étapes numérotées avec vérification après chacune, retour arrière (commande, critère de déclenchement, qui décide), signature des 5 pannes du script d'incident dans le tableau de bord, durée attendue d'un déploiement (7,6 s à froid une fois les images présentes, cf. Chapitre 14).

### Chapitre 19 — La passation d'astreinte

*À compléter après l'exercice en binôme (nécessite un camarade et le tirage au sort du script d'incident — non simulable en solo).*

| Rôle | Panne tirée | Panneau du dashboard le plus utile | Ligne de procédure manquante | Temps panne → rétablissement |
|---|---|---|---|---|
| Pilote | — | — | — | — |
| Mains | — | — | — | — |


