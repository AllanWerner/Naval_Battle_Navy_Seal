# Procédure de déploiement — Task API

Ce document doit permettre à quelqu'un qui n'a jamais touché ce projet de déployer, vérifier et, si besoin, revenir en arrière, en ne s'appuyant que sur ce texte et le tableau de bord Grafana.

## 1. Prérequis

| Élément | Valeur / emplacement |
|---|---|
| Machine cible | adresse et port SSH fournis par le secret `DEPLOY_HOST` / `DEPLOY_PORT` du dépôt GitHub |
| Utilisateur SSH | secret `DEPLOY_USER` |
| Clé privée de déploiement | secret `DEPLOY_SSH_KEY` (jamais en clair sur disque en dehors de l'agent SSH de la pipeline) |
| Dossier applicatif sur la cible | `/srv/todo` |
| Fichiers attendus dans `/srv/todo` | `docker-compose.prod.yml`, `prometheus.yml`, `grafana/`, `.env` |
| `.env` | **copié une seule fois à la main** sur la machine cible à partir de `.env.example` — ne fait jamais partie du dépôt ni de ce que la pipeline envoie |
| Network/volume Docker externes | `tasknetwork` et `taskvolume` doivent exister sur la cible avant le premier déploiement (`docker network create tasknetwork`, `docker volume create taskvolume`) |
| Secrets Docker Hub | `DOCKERHUB_USERNAME`, `DOCKERHUB_TOKEN` (utilisés par le job `build`, pas par le déploiement lui-même) |
| Runner de la pipeline | une machine enregistrée comme "self-hosted" sur le dépôt (`Settings > Actions > Runners > New self-hosted runner`), avec `./run.sh` **lancé et laissé ouvert en continu** — si ce terminal est fermé, les déploiements restent "Queued" indéfiniment |

Ces prérequis ne sont à poser qu'une fois ; les déploiements suivants n'ont besoin que de la pipeline.

## 2. Déploiement (automatique, via la pipeline)

1. **Pousser sur `master`.**
   Vérification : dans l'onglet *Actions* du dépôt, un run apparaît avec les jobs `test`, `build`, `deploy`.

2. **Le job `test` tourne sur `ubuntu-latest`** contre une vraie Postgres de service.
   Vérification : le job est vert avant que `build` ne démarre (dépendance `needs: [test]`).

3. **Le job `build` construit et pousse les deux images** (`allanwer/task_api-api` et `allanwer/task_api-stats-api`) taguées avec le sha du commit et `latest`.
   Vérification : sur Docker Hub, un nouveau tag portant le sha apparaît pour les deux images.

4. **Le job `deploy` (self-hosted) envoie les fichiers puis lance le déploiement** :
   ```bash
   ssh -p "$DEPLOY_PORT" "$DEPLOY_USER@$DEPLOY_HOST" "mkdir -p /srv/todo"
   scp -P "$DEPLOY_PORT" docker-compose.prod.yml "$DEPLOY_USER@$DEPLOY_HOST:/srv/todo/"
   scp -P "$DEPLOY_PORT" prometheus.yml "$DEPLOY_USER@$DEPLOY_HOST:/srv/todo/"
   scp -P "$DEPLOY_PORT" -r grafana "$DEPLOY_USER@$DEPLOY_HOST:/srv/todo/"
   ssh -p "$DEPLOY_PORT" "$DEPLOY_USER@$DEPLOY_HOST" \
     "cd /srv/todo && TAG=$GITHUB_SHA docker compose -f docker-compose.prod.yml up -d"
   ```
   Vérification : `docker compose -f docker-compose.prod.yml ps` sur la cible montre `todo-api`, `todo-db`, `todo-stats-api`, `prometheus` et `grafana` à l'état `running` (`healthy` pour `todo-db`).

5. **La pipeline vérifie elle-même `/health`** (retries pendant ~30s) et échoue franchement si l'API ne répond pas — c'est le signal que le déploiement n'a *pas* réussi, avant même de regarder le tableau de bord.
   Vérification manuelle équivalente :
   ```bash
   curl -s http://<DEPLOY_HOST>:4000/health
   # {"status":"ok","timestamp":"..."}
   ```

**Durée attendue d'un déploiement normal (mesurée en local, cf. Journal de bord du README) : voir la ligne « Déploiement » du tableau de la Phase 5.**

## 3. Déploiement manuel (si la pipeline est indisponible)

Depuis `/srv/todo` sur la machine cible, avec un `.env` déjà en place :

```bash
cd /srv/todo
TAG=<sha_du_commit> docker compose -f docker-compose.prod.yml up -d
docker compose -f docker-compose.prod.yml ps
curl -s http://localhost:4000/health
```

## 4. Retour arrière

**Commande :**
```bash
cd /srv/todo
TAG=<sha_precedent> docker compose -f docker-compose.prod.yml up -d
```

**Critère de déclenchement** : `/health` ne répond pas dans les 30 secondes qui suivent un déploiement, OU le panneau *Erreurs* du dashboard Grafana explose sans justification métier (pas juste un pic de trafic normal), OU une régression fonctionnelle visible est constatée après déploiement.

**Qui décide** : la personne d'astreinte (celle qui a les mains sur la machine), après consultation du tableau de bord — pas besoin d'attendre une validation extérieure, le retour arrière est réversible et moins coûteux qu'un service resté en panne.

**Un retour arrière vers un tag qui n'existe pas sur Docker Hub échoue franchement** (`docker compose up -d` renvoie une erreur `pull access denied` / `manifest unknown` et ne touche pas aux conteneurs déjà en cours d'exécution) — vérifié en Phase 5.

## 5. Pannes connues et leur signature dans le tableau de bord

| # | Panne | Signature dans Grafana | Diagnostic |
|---|---|---|---|
| 1 | `todo-api` arrêté (`docker stop todo-api`) | Panneau **Disponibilité** (`up`) tombe à 0 en moins de 15s ; plus aucune donnée sur **Trafic**/**Erreurs**/**Latence** | `docker compose -f docker-compose.prod.yml up -d` (ou `docker start todo-api`) |
| 2 | `todo-db` arrêtée (`docker stop todo-db`) | `up{job="todo-api"}` reste à **1** (l'API répond toujours) mais **Erreurs** explose (5xx sur `/api/*`, cf. middleware de garde `db.isReady`) | `docker start todo-db`, attendre `healthy`, l'API se reconnecte seule (`connectWithRetry`) |
| 3 | Réseau de `todo-api` déconnecté (`docker network disconnect tasknetwork todo-api`) | Même signature que la panne 2 (erreurs qui explosent, `up` à 1) mais `todo-db` est `healthy` de son côté — se distingue en vérifiant `docker network inspect tasknetwork` | `docker network connect tasknetwork todo-api` |
| 4 | `todo-api` relancée sans configuration (`docker rm -f todo-api` puis `docker run` sans `--network`/`--env-file`) | `up` peut remonter à 1 mais **Erreurs** reste haut en continu (pas de DB joignable, pas de variables d'env) ; le conteneur n'est plus celui décrit par `docker-compose.prod.yml` | `docker rm -f todo-api` puis redéployer proprement : `docker compose -f docker-compose.prod.yml up -d` |
| 5 | Machine saturée (conteneurs `hog-*` qui consomment tout le CPU) | **Latence p95** explose sans que **Erreurs** ni **Disponibilité** ne bougent forcément | `docker ps` pour repérer les conteneurs `hog-*`, `docker rm -f hog-1 hog-2 hog-3 hog-4` |

## 6. Durée attendue d'un déploiement normal

À compléter avec la valeur mesurée lors du premier déploiement réel via la pipeline (voir README, Journal de bord). À titre de référence, le déploiement manuel mesuré en local (Phase 5) est noté dans le même tableau.
