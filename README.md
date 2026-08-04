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
| `PORT` | Port d'écoute de `task_api` | `3000` |


## Endpoints

### `task_api` — `http://localhost:3000`

| Méthode | Route | Description |
|---|---|---|
| `GET` | `/health` | Vérifie que le service répond |
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
curl -X POST http://localhost:3000/api/tasks \
  -H "Content-Type: application/json" \
  -d '{"description":"Ma tâche test","status":"pending"}'

curl http://localhost:3000/api/tasks
curl http://localhost:8000/stats
```

## Structure du projet

```
.
├── src/
│   ├── routes/tasks.js
│   ├── models/task.js
│   ├── middleware/errorHandler.js
│   └── app.js
├── stats_api/
│   ├── main.py
│   ├── requirements.txt
│   └── Dockerfile
├── Dockerfile
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
|---|---|---|---|---|
| `task_api` |266MB | 17(160MB) | 0m7.312s / 0m1.036s| 
| `stats-api` | 210MB | 21(87.4MB) | 0m5.475s / 0m0.995s  | 


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



