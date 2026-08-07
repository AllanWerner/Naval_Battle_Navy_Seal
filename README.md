# Quiz en direct - Flotte NavySeal

Projet de groupe du Jour 5, *La Bataille des Services*. Un quiz que la classe joue depuis son téléphone, porté par trois services conteneurisés qui tiennent chacun un carré au tableau de la promo.

La chaîne de livraison vient du fil rouge de la semaine (Docker, pipeline, machine cible, surveillance) ; seul le métier a changé.

## L'équipage

| | |
|---|---|
| Nom | **NavySeal** |
| Couleur | `#FF0000` |
| Carrés jurés | 3 |
| Tableau | https://services-battle.vercel.app |
| Pavillon | *à compléter* |

| Rôle | Qui |
|---|---|
| Images et composes | Yoann |
| Livraison (pipeline, machine cible) | Gabriel |
| État (base, volumes, pavillon) | Mouhammed  |
| Mesure (Prometheus, Grafana) | Joel |
| Astreinte (tableau, journal, runbook) | Allan |

## Ce que fait le projet

Une manche est ouverte à la fois : tout le monde répond à la même question, en même temps, et l'animateur fait avancer le quiz. Les scores se recalculent en continu.

## Les trois services

| Service | Rôle | Image | Port hôte | Carré |
|---|---|---|---|---|
| **`front`** | la page du quiz et la commande animateur | `quiz-front` | **3000** | oui |
| **`api`** | questions, réponses, décompte | `quiz-api` | 4000 *(interne)* | oui |
| **`scores`** | classement et taux de réussite | `quiz-scores` | **8000** | oui |
| `postgres` | persistance, volume nommé | `postgres:16.4-alpine` | aucun | non |

**La base n'a pas de carré** : elle ne parle pas HTTP, elle ne peut pas envoyer de pouls. Le jour où elle coule, c'est le carré de l'API qui s'éteint.

Tous les services communiquent sur le réseau `quiznet` par leur nom de service. **Postgres ne publie aucun port** : elle n'est joignable que depuis les autres conteneurs.

### Ce que chaque service expose

Les quatre routes que **tous les trois** implémentent :

| Route | Rôle |
|---|---|
| `GET /health` | liveness, **ne dépend de rien**. C'est elle que le `HEALTHCHECK` interroge |
| `GET /sante` | la sonde qui dit la vérité : elle interroge vraiment la dépendance |
| `GET /travail` | la route qui encaisse les coups du tableau, avec un travail réel |
| `GET /metrics` | métriques Prometheus, texte brut |

#### `front` - http://localhost:3000

| Méthode | Route | Description |
|---|---|---|
| `GET` | `/` | la page du quiz : pseudo, question, quatre choix, score |
| `GET` | `/animateur` | la commande animateur : manche en cours et bouton « question suivante » |
| `GET` | `/api/question` | relais vers l'API |
| `POST` | `/api/reponse` | relais vers l'API |
| `POST` | `/api/manche/suivante` | relais vers l'API |
| `GET` | `/api/score/:pseudo` | relais vers l'API |

Le navigateur ne parle **qu'au front** : l'API n'est pas exposée hors du réseau interne.

#### `api` - http://localhost:4000

| Méthode | Route | Description |
|---|---|---|
| `GET` | `/api/question` | la manche en cours, **sans la bonne réponse** |
| `POST` | `/api/reponse` | `{pseudo, choix}`, renvoie juste ou faux |
| `POST` | `/api/manche/suivante` | ouvre la manche suivante, revient à la première après la dernière |
| `GET` | `/api/score/:pseudo` | points et nombre de réponses d'un joueur |
| `POST` | `/pavillon` | hisse le pavillon, écrit dans un volume |
| `GET` | `/pavillon` | relit le pavillon |
| `GET` | `/ready` | readiness : la connexion à la base est-elle établie |

#### `scores` - http://localhost:8000

| Méthode | Route | Description |
|---|---|---|
| `GET` | `/classement` | le top N des joueurs, `?limite=20` |
| `GET` | `/stats` | taux de bonnes réponses par question |
| `GET` | `/docs` | documentation interactive, générée par FastAPI |

### Vérification rapide

```bash
curl -s localhost:3000/api/question
curl -s -X POST localhost:3000/api/reponse -H "Content-Type: application/json" -d '{"pseudo":"toi","choix":1}'
curl -s localhost:3000/api/score/toi
curl -s localhost:8000/classement
curl -s -X POST localhost:4000/pavillon -H "Content-Type: application/json" -d '{"message":"votre pavillon"}'
```

**Le test qui compte**, la dégradation gracieuse : `docker compose stop api`, puis recharger http://localhost:3000. La page s'affiche toujours, avec « Données indisponibles » à la place du quiz, et `/health` du front reste à `200`. **Une panne, un seul carré éteint.**

## Prérequis

- Docker Desktop (ou Docker Engine + Docker Compose)
- Un compte Docker Hub, uniquement pour publier et tirer les images

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

Puis remplir `.env`. Ce fichier n'est **jamais commité**.

### 3a. En développement, build depuis les sources

```bash
docker compose up -d --build
docker compose ps
```

Les quatre conteneurs doivent passer `healthy`. Compter une trentaine de secondes : l'API attend que Postgres accepte des connexions.

### 3b. En production, depuis les images publiées

```bash
docker compose -f docker-compose.prod.yml up -d
```

Fonctionne dans un dossier ne contenant que `docker-compose.prod.yml`, `.env`, `prometheus.yml` et `grafana/`. Aucun code source nécessaire.

### 4. Arrêter la stack

```bash
docker compose down          # conserve les données et le pavillon
docker compose down -v       # supprime aussi les volumes, irréversible
```

### Développement hors conteneur

```bash
npm run db:dev              # un Postgres jetable sur le port 5433
npm run dev                 # l'API sur 4000
cd front && npm run dev     # le front sur 3000
```

Décommenter le bloc « développement hors conteneur » de `.env` pour que l'API vise `localhost:5433`.

## Variables d'environnement

| Variable | Description | Exemple |
|---|---|---|
| `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` | initialisation de la base | `postgres` / *(à définir)* / `quizdb` |
| `DB_HOST`, `DB_PORT` | **forcés par le compose** à `postgres` et `5432` | `postgres` |
| `DB_NAME`, `DB_USER`, `DB_PASSWORD` | connexion applicative | `quizdb` |
| `PORT` | port d'écoute du service | `4000` / `3000` |
| `API_URL` | l'API vue depuis le front | `http://api:4000` |
| `PAVILLON_FICHIER` | où le pavillon est écrit | `/data/pavillon.txt` |
| `TABLEAU_URL`, `GROUPE`, `COULEUR` | le pouls vers le tableau de la classe | `https://services-battle.vercel.app` |
| `SERVICE`, `VERSION` | injectés par le compose, **un par service** | `front` / `api` / `scores` |
| `REGISTRY`, `TAG` | compte du registry et sha de l'image (production) | `gabrielmartin09` / `<sha>` |

## Volumes

| Volume | Monté sur | Rôle |
|---|---|---|
| `quizdata` | `postgres` | les données du quiz |
| `pavillon` | `api` en écriture, `front` et `scores` en **lecture seule** | le pavillon survit au redéploiement |

Un seul service écrit le pavillon. Trois conteneurs qui écrivent le même fichier, c'est une course à qui parle en dernier.

## Structure du projet

```
.
├── .github/workflows/
│   └── ci-cd.yml            # test → build (Docker Hub) → deploy (SSH, self-hosted)
├── docs/
│   ├── PROCEDURE_DEPLOIEMENT.md
├── src/                     # quiz-api
│   ├── routes/quiz.js
│   ├── models/question.js, reponse.js
│   ├── controllers/quizController.js
│   ├── metrics.js
│   ├── pouls.js
│   └── app.js
├── front/                   # quiz-front
│   ├── public/index.html, animateur.html
│   ├── server.js
│   ├── pouls.js
│   └── Dockerfile
├── stats_api/               # quiz-scores
│   ├── main.py
│   ├── pouls.py
│   ├── requirements.txt
│   └── Dockerfile
├── tests/
│   ├── setup.js
│   └── quiz.test.js
├── grafana/
├── Dockerfile               # quiz-api
├── Dockerfile.vm            # maquette de la machine cible (Docker-in-Docker + SSH)
├── prometheus.yml
├── docker-compose.yml       # dev, build depuis les sources
├── docker-compose.prod.yml  # prod, images tirées du registry
└── README.md
```

## Publication des images

Automatisée par la pipeline. En dépannage manuel :

```bash
docker compose build
docker tag navyseal-api    <compte>/quiz-api:<sha>
docker tag navyseal-front  <compte>/quiz-front:<sha>
docker tag navyseal-scores <compte>/quiz-scores:<sha>
docker push <compte>/quiz-api:<sha>
docker push <compte>/quiz-front:<sha>
docker push <compte>/quiz-scores:<sha>
```

Tailles mesurées : **273 Mo** pour l'API, **244 Mo** pour le front, **210 Mo** pour scores. La base `node:22-alpine` en représente 232 à elle seule.

## Pipeline CI/CD

`.github/workflows/ci-cd.yml`, déclenché sur chaque `push`, trois jobs enchaînés :

| Job | Runner | Rôle |
|---|---|---|
| `test` | `ubuntu-latest` | `npm test` contre une vraie Postgres de service |
| `build` | `ubuntu-latest` | build des trois images, taguées au sha du commit ; **poussées uniquement depuis la branche principale** |
| `deploy` | `self-hosted` | envoie `docker-compose.prod.yml`, `prometheus.yml` et `grafana/` par SSH, lance `TAG=<sha> docker compose up -d`, vérifie la santé de chaque service |

Une branche de travail fait tourner `test` et `build` sans rien publier ni déployer.

**Secrets du dépôt requis** :

| Secret | Usage |
|---|---|
| `DOCKERHUB_USERNAME`, `DOCKERHUB_TOKEN` | authentification Docker Hub (job `build`) |
| `DEPLOY_SSH_KEY` | clé privée, chargée dans un agent SSH éphémère, jamais écrite sur disque |
| `DEPLOY_HOST`, `DEPLOY_PORT`, `DEPLOY_USER` | coordonnées de la machine cible |

**Runner self-hosted** : la machine cible n'étant pas joignable par les runners de GitHub, une machine doit être enregistrée comme runner (`Settings > Actions > Runners`) avec `run.cmd` **laissé ouvert**. Sans lui, le job `deploy` reste `Queued` indéfiniment.

## Monitoring

Chaque service expose `/metrics` au format Prometheus :

| Métrique | Portée |
|---|---|
| `http_requests_total{method,route,status}` | les trois services |
| `http_request_duration_seconds` | les trois services, histogramme pour le p95 |
| `quiz_reponses_total{correcte}` | `api`, mesure métier |
| `quiz_front_api_joignable` | `front`, 0 ou 1 |
| `quiz_scores_base_joignable`, `quiz_scores_joueurs` | `scores` |

Les deux jauges en 0 ou 1 sont ce qui distingue, au tableau de bord, une panne du service d'une panne de sa dépendance.

Prometheus sur le port `9090`, Grafana sur le `3001`, provisionnés automatiquement.
