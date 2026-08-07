# Carnet de la flotte - Phase 8

Objectif : mesurer avant de dupliquer, puis mesurer apres duplication. Un
chiffre seul ne prouve rien ; ce carnet garde le contexte, les commandes et
les ecarts observes.

## Contexte

| Champ | Valeur |
|---|---|
| Date | 2026-08-07 |
| Branche | feature/scale-carnet |
| Commit mesure | `3267c58` + branche `feature/scale-carnet` |
| Machine | Poste local Windows / Docker Desktop |
| Compose utilise | `docker-compose.prod.yml` |
| Service scale | `api` |
| Route mesuree | `http://api:4000/travail` |
| Nombre de coups par salve | `300` |
| Concurrence locale | `20` |

## Commandes de mesure

PowerShell :

```powershell
.\script_mesure.ps1 -ComposeFile docker-compose.prod.yml -EnvFile .env -Requests 300 -Concurrency 20 -Scales "1,3"
```

Bash :

```bash
SCALES="1 3" REQUESTS=300 CONCURRENCY=20 ./script_mesure.sh
```

Mesure de taille des images :

```bash
docker images --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}" | grep -E "quiz-(api|front|scores)"
```

## Releve phase 8

| Ce qu'on mesure | Avant | Apres | Ce qui a change entre les deux |
|---|---:|---:|---|
| Taille image `quiz-api` | 187 MB | 187 MB | Le scaling ne change pas la taille de l'image |
| Taille image `quiz-front` | 171 MB | 171 MB | Le scaling ne change pas la taille de l'image |
| Taille image `quiz-scores` | 142 MB | 142 MB | Le scaling ne change pas la taille de l'image |
| Duree entre `up -d` et dernier conteneur healthy | Non mesure | Non mesure | A chronometrer pendant un vrai redeploiement |
| Coups reussis sur une salve locale | 300/300 | 300/300 | Aucun echec dans les deux cas |
| Requetes `/travail` reussies par seconde | 260.94 | 349.52 | +34 %, loin de x3 car la DB reste partagee |
| Nombre de coups avant que le carre palisse | A completer | A completer | A mesurer avec le tableau de classe |
| Temps de retour a un carre plein apres 1000 coups | A completer | A completer | A mesurer avec le tableau de classe |

## Resultats script

Coller ici la table imprimee par `script_mesure.ps1` ou `script_mesure.sh`.

| scale | total | ok | failed | seconds | ok/s |
|---:|---:|---:|---:|---:|---:|
| 1 | 300 | 300 | 0 | 1.15 | 260.94 |
| 3 | 300 | 300 | 0 | 0.858 | 349.52 |

## Lecture attendue

- Si `api=3` ne fait pas mieux que `api=1`, regarder la base : elle n'a pas
  ete dupliquee et peut devenir le point limitant.
- Ici, `api=3` fait mieux que `api=1`, mais seulement de 34 %. Le gain est
  reel, mais la route `/travail` lit Postgres, donc la base reste un goulot.
- Si le nombre d'echecs augmente avec `api=3`, verifier que le service ne
  garde pas d'etat en memoire et que les routes passent bien par la base.
- Si le front reste stable pendant les salves, la degradation gracieuse et le
  decouplage front/API sont corrects.
