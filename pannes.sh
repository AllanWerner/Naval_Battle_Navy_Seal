#!/usr/bin/env bash
# pannes.sh : tire une panne au hasard et l'applique sur la machine cible.
#
# A lancer depuis votre poste, la machine cible (vm-prod, cf. Dockerfile.vm)
# doit etre joignable en SSH sur le port 2222 avec deploy_key.
# Personne dans l'equipage ne regarde le numero qui sort, c'est tout
# l'interet : le diagnostic se fait depuis le tableau et les logs, jamais
# depuis ce script.
#
# Deux variables d'environnement optionnelles cassent volontairement cet
# anonymat, uniquement pour preparer/valider l'exercice avant de le lancer
# sur la classe :
#   VICTIME_FORCEE=front|api|scores
#   PANNE_FORCEE=0..5
# Ne pas les positionner pour un vrai tirage a l'aveugle.
set -u

CIBLE="ssh -i deploy_key -p 2222 -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null root@localhost"
COMPOSE="cd /srv/flotte && docker compose -f docker-compose.prod.yml"

SERVICES=(front api scores)
VICTIME=${VICTIME_FORCEE:-${SERVICES[$RANDOM % ${#SERVICES[@]}]}}
# Label du service compose, pas le nom du conteneur : "api" n'a volontairement
# pas de container_name fixe (ca casserait --scale api=N), donc "quiz-api"
# n'existe pas toujours. Le label, lui, est stable meme scale.
ID="docker ps -qf label=com.docker.compose.service=$VICTIME | head -1"

PANNE=${PANNE_FORCEE:-$((RANDOM % 6))}

case $PANNE in
0) $CIBLE "docker kill \$($ID)" ;;
1) $CIBLE "docker stop \$(docker ps -qf label=com.docker.compose.service=postgres | head -1)" ;;
2) $CIBLE "docker exec \$($ID) chmod 000 /data" ;;
3) $CIBLE "sed -i 's|^DB_PASSWORD=.*|DB_PASSWORD=|' /srv/flotte/.env && $COMPOSE up -d api" ;;
4) $CIBLE "sed -i 's|^TAG=.*|TAG=nexistepas|' /srv/flotte/.env && $COMPOSE up -d $VICTIME" ;;
5) $CIBLE "sed -i 's|^TABLEAU_URL=.*|TABLEAU_URL=http://127.0.0.1:1|' /srv/flotte/.env && $COMPOSE up -d $VICTIME" ;;
esac

echo "Le tableau va parler. Qu'est-ce qui s'est eteint, et pourquoi ?"
