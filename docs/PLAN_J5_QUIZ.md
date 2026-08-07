# Plan J5 : la flotte « Quiz en direct »

Plan de bascule de l'application existante (task-api) vers un **quiz en direct**, et répartition des rôles à cinq.

Contexte : [partie5_cours.md](partie5_cours.md) pour les règles, [partie5_exercices.md](partie5_exercices.md) pour les phases.

---

## 1. La cible

Un quiz que **la classe joue depuis son téléphone** pendant notre passage. C'est ce qui rend la charge réelle au lieu d'être simulée.

- une page projetée montre la question en cours et le score qui monte,
- chacun répond depuis son navigateur,
- un classement se recalcule en continu.

Trois services tiennent un carré, la base n'en tient pas.

| Brique | Nom | Rôle | Carré |
|---|---|---|---|
| Front | `quiz-front` | la page web : question en cours, choix, score | oui |
| API métier | `quiz-api` | les questions, les réponses, le décompte | oui |
| Service annexe | `quiz-scores` | le classement, agrégé en continu | oui |
| Base | `quiz-db` | PostgreSQL | non |

Le service annexe est bien **différent** des deux autres : il ne sert ni la page ni les écritures, il agrège. C'est la contrainte du support, et c'est exactement ce que faisait déjà `stats_api`.

---

## 2. Ce qu'on garde, ce qu'on remplace

**La chaîne reste, le métier part.** C'est tout l'intérêt de repartir d'un dépôt de J3.

| Existant | Sort |
|---|---|
| `Dockerfile`, `Dockerfile.vm` | **gardés**, adaptés au nom des services |
| `.github/workflows/ci-cd.yml` (job SSH vers `vm-prod`) | **gardé**, étendu à trois images |
| `docker-compose.prod.yml`, réseau, volumes, healthchecks | **gardés**, renommés |
| `prometheus.yml`, `grafana/` | **gardés**, une cible par service |
| `src/metrics.js`, `/health`, `/ready`, `connectWithRetry` | **gardés tels quels**, ils valent de l'or aujourd'hui |
| `docs/PROCEDURE_DEPLOIEMENT.md` | **gardé**, réécrit en phase 10 |
| `src/models/task.js`, `src/routes/tasks.js`, `src/controllers/taskController.js` | **remplacés** |
| `stats_api/main.py` (comptage par statut) | **remplacé** par le classement |
| Noms `todo-api`, `todo-db`, `task_api-*` | **renommés** en `quiz-*` |

> ⛔ Le support interdit de rendre une Todo App. Le renommage n'est pas cosmétique : `container_name: todo-api` dans le compose et `allanwer/task_api-api` sur Docker Hub doivent disparaître.

**Trois atouts déjà en place**, à ne surtout pas casser :

- `connectWithRetry` plus le 503 sur `/api/*` tant que la base n'est pas prête. C'est **la dégradation gracieuse** que la phase 6 demande, à moitié écrite.
- `/health` indépendant de la base et `/ready` qui la teste : la distinction « le service répond » contre « le service fonctionne » existe déjà.
- `metricsMiddleware` monté avant les routes, donc les 404 sont comptés.

---

## 3. Le modèle de données

Trois tables, volontairement minimales. Le code métier d'un quiz tient en quelques dizaines de lignes.

```
Question   id, texte, choix (JSON: 4 items), bonne_reponse (0-3), ordre, active
Reponse    id, question_id, pseudo, choix, correcte (bool), created_at
Manche     id, question_id, ouverte_a, fermee_a       (optionnel, pour l'historique)
```

Sequelize est déjà en place, la migration se fait par `sync()` comme aujourd'hui.

**Le seed compte autant que le schéma** : prévoir une dizaine de questions insérées au démarrage si la table est vide. Une démo devant la classe avec une base vide, c'est un carré plein qui ne montre rien.

---

## 4. Les routes, service par service

### `quiz-api` (Node, port 4000)

| Route | Rôle |
|---|---|
| `GET /api/question` | la question en cours, **sans la bonne réponse** |
| `POST /api/reponse` | `{pseudo, choix}`, écrit en base, renvoie juste / faux |
| `POST /api/manche/suivante` | passe à la question suivante (bouton de l'animateur) |
| `GET /api/score/:pseudo` | le score d'un joueur |
| **`POST /pavillon`** | écrit le pavillon dans `PAVILLON_FICHIER`, 201, 400 si vide |
| **`GET /travail`** | le coup encaissé : lecture réelle en base, 200 ou 503 |
| **`GET /sante`** | la sonde qui **teste la base**, pas seulement le serveur HTTP |
| `GET /health`, `/ready`, `/metrics` | déjà là |

### `quiz-scores` (Python, port 8000)

| Route | Rôle |
|---|---|
| `GET /classement` | top N des pseudos par score, calculé en SQL |
| `GET /stats` | réponses par question, taux de bonnes réponses |
| **`GET /travail`** | recalcul du classement, du vrai travail mesurable |
| **`GET /sante`** | teste la connexion Postgres |
| `GET /health`, `/metrics` | `/health` existe, `/metrics` à ajouter |

### `quiz-front` (nouveau service, port 3000)

Le seul service à créer de zéro. Un Express minimal qui sert une page statique et appelle `quiz-api`.

| Route | Rôle |
|---|---|
| `GET /` | la page : question, quatre boutons, score, classement |
| **`GET /travail`** | rend la page ou un fragment, travail léger mais réel |
| **`GET /sante`** | teste que `quiz-api` répond |
| `GET /health`, `/metrics` | à écrire |

> **La règle qui rapporte le plus, en phase 6** : si `quiz-api` tombe, le front **affiche quand même sa page**, avec « résultats indisponibles » à la place de la zone dynamique. Son carré reste plein. Un front qui plante avec son API donne deux carrés éteints pour une seule panne.

### Sur les trois services

Le `pouls.js` fourni par le support, importé tel quel, plus les variables `TABLEAU_URL`, `GROUPE`, `COULEUR`, `SERVICE`, `VERSION`, `URL_INTERNE`, `PAVILLON_FICHIER`, injectées par le compose.

---

## 5. Répartition des rôles, à cinq

**Contrainte du support, à vérifier avant de figer** : personne ne tient le rôle sur lequel il est le plus fort (le 2 en pipeline ne touche pas au workflow), et jamais deux 2 sur le même axe dans l'équipe. Remplir les cartes de compétences **avant** ce tableau.

| Rôle | Qui | Territoire exclusif | Ce qu'il livre aujourd'hui |
|---|---|---|---|
| **Images** | | les trois `Dockerfile` | trois images multi-stage non-root, tailles avant/après au carnet |
| **Livraison** | | `ci-cd.yml`, `vm-prod`, le runner | un push livre les trois services, le job échoue si l'un ne répond pas |
| **État** | | volumes, base, pavillon | schéma + seed, `POST /pavillon`, le pavillon survit au push |
| **Mesure** | | Prometheus, Grafana, le carnet | une cible par service, quatre panneaux, point de bascule mesuré |
| **Astreinte** | | le tableau, le journal, le runbook | une entrée par panne, `RUNBOOK_FLOTTE.md`, la prise de parole |

**Le saboteur** : à cinq, chacun tient un rôle et personne n'est libre à plein temps. On le traite donc comme **une mission chronométrée** plutôt qu'un poste : la personne en astreinte casse la flotte pendant une fenêtre définie avant l'ouverture du feu. Son rôle est calme le matin et saturé l'après-midi, c'est le bon créneau.

**Le code métier n'appartient à personne.** Les rôles décrivent des territoires d'infrastructure. Les routes du quiz se répartissent librement, une pull request par service :

| Service | Écrit par | Relu par |
|---|---|---|
| `quiz-api` | État + un renfort | Images |
| `quiz-scores` | Mesure | État |
| `quiz-front` | Images + un renfort | Livraison |

Personne ne fusionne sa propre PR.

### Qui pilote quelle phase

| Phase | Pilote | En appui |
|---|---|---|
| 1. Repo de groupe et machine cible | Livraison | tous, pour tester leurs droits |
| 2. Un service, et son pouls | Images | Astreinte, qui lit le tableau |
| 3. Les trois services | Images | une PR par service |
| 4. Le push qui livre la flotte | Livraison | seul dans le workflow |
| 5. Le pavillon | État | Images en relecture |
| 6. Les sondes qui disent vrai | Mesure | État pour les dépendances |
| 7. Route de travail et saturation | État | Mesure pour les chiffres |
| 8. Exemplaires et carnet | Mesure | Livraison pour le `--scale` |
| 9. Les six pannes | Astreinte | tous autour du tableau |
| 10. Le runbook | Astreinte | Livraison en relecture |
| 11. Métriques de la flotte | Mesure | |
| 12. Les quatre panneaux | Mesure + Astreinte | |
| 13. Manifestes du cluster | Livraison | État pour le stockage |
| 14. Livrer pendant le feu | Livraison | Astreinte au chronomètre |

---

## 6. L'ordre d'exécution

### Bloc A : ce qui débloque tout le monde (à faire en premier, en parallèle)

| # | Qui | Quoi | Terminé quand |
|---|---|---|---|
| A1 | Livraison | repo, droits, `vm-prod` démarrée, SSH testé, runner enregistré | `ssh ... 'docker ps'` répond, runner `Listening for Jobs` |
| A2 | Tous | contrat annoncé : nom, couleur `#xxxxxx`, pavillon, carrés jurés, repo | annoncé au formateur |
| A3 | État | schéma des trois tables + seed de dix questions | `sync()` crée les tables au démarrage |
| A4 | Images | `pouls.js` déposé à la racine, variables ajoutées à `.env.example` | importable depuis n'importe quel service |

> A1 est sur le chemin critique de tout le reste. Si le runner ou le SSH coince, tout le monde attend à 15h.

### Bloc B : le premier carré (phase 2)

Un seul service, le plus simple à faire tourner : **`quiz-api`**, puisque son squelette Express existe déjà.

1. remplacer `routes/tasks.js` par `routes/quiz.js`, le modèle et le contrôleur ;
2. ajouter `GET /travail`, même vide, et l'appel `demarrerLePouls()` ;
3. lancer en local, **le carré doit apparaître en moins de dix secondes**.

Les trois contrôles du support, dans l'ordre : le carré apparaît, il disparaît en 8 s quand on coupe le service, il **se rallume tout seul** après vingt secondes de wifi coupé.

**Commit à la seconde où le carré s'allume**, avant de toucher à autre chose.

### Bloc C : la flotte et la livraison (phases 3 et 4)

En parallèle, trois pull requests :

- `quiz-scores` : réécriture de `main.py`, le classement à la place du comptage par statut ;
- `quiz-front` : nouveau service, page + dégradation gracieuse dès l'écriture ;
- `compose.prod.yml` : un bloc par service, **chacun écrit le sien**.

Puis la pipeline, par la seule personne en charge de la livraison : trois images en parallèle taguées au même sha, `scp` du compose, `pull` + `up -d`, et la vérification de santé qui fait échouer le job.

> Le compose et le workflow sont **les deux fichiers qui créent tous les conflits**. Un bloc par personne dans le compose, une personne à la fois dans le workflow, `git pull --rebase origin master` avant chaque PR.

### Bloc D : ce qui se joue après (phases 5 à 14)

Détaillé dans [partie5_exercices.md](partie5_exercices.md), résumé ici pour l'ordre :

| Phase | L'essentiel | Le piège |
|---|---|---|
| 5. Pavillon | volume nommé monté sur `quiz-api` | écrit dans le conteneur, il disparaît au push, en public |
| 6. Sondes | `/sante` interroge vraiment la base | le front doit rester plein quand l'API tombe |
| 7. Travail | `/travail` coûte quelques ms de vrai travail | un `return 200` immédiat ne prouve rien |
| 8. Exemplaires | `--scale api=3`, carnet rempli avant/après | un port fixe empêche de dupliquer |
| 9. Six pannes | `pannes.sh`, une entrée de journal chacune | la panne 6 : le service va bien, le carré est éteint |
| 10. Runbook | remontée depuis zéro sur une autre machine | écrit pour un autre équipage, pas pour soi |
| 11-12. Mesure | une cible par service, quatre panneaux | un dashboard non exporté en JSON n'existe pas |
| 13-14. Cluster | manifestes, rolling update pendant le feu | à ne tenter que si les paliers 1 à 6 sont tenus |

**Arbitrage à poser dès maintenant** : les paliers 1 à 6 valent 85 % de la grille. Le palier 7 est un bonus. Une flotte propre sur `vm-prod` bat une flotte à moitié portée sur le cluster.

---

## 7. Ce qui casse la journée si personne ne s'en occupe

| Risque | Coût | Qui le porte |
|---|---|---|
| Runner non enregistré **sur ce repo** | job en *Queued* pour toujours, sans erreur | Livraison, dès A1 |
| Secrets Docker Hub non recréés | `build` rouge, ou pire, image vide sans erreur | Livraison, dès A1 |
| Noms `todo-*` laissés partout | le rendu ressemble à une Todo App interdite | Images, au renommage |
| Pavillon écrit hors volume | disparaît pendant la démo, devant la classe | État, phase 5 |
| Front qui plante avec l'API | deux carrés éteints pour une panne | qui écrit le front, dès l'écriture |
| Conflits sur compose et workflow | une heure perdue pour tout le monde | tous, discipline de branches |
| Base vide le jour de la démo | un carré plein qui ne montre rien | État, seed dès A3 |

---

## 8. À décider en cinq minutes, maintenant

- [ ] **Nom de l'équipage** et **couleur** hexadécimale
- [ ] **Pavillon**, la phrase sous les carrés
- [ ] **Nombre de carrés jurés** : trois, sauf si les cinq rôles sont tenus et A1 bouclé avant 11h
- [ ] **Compte Docker Hub** et préfixe des images (`<compte>/quiz-front`, `-api`, `-scores`)
- [ ] **Qui héberge `vm-prod`** et fait donc tourner le runner
- [ ] Les cinq rôles attribués, **carte de compétences remplie d'abord**
