# ============================================
# Stage de base : installation des dépendances
# ============================================
FROM node:22-alpine AS starter

#Répertoire de travail(Les commandes RUN, CMD, ENTRYPOINT, COPY et ADD seront exécutées dans ce répertoire)
WORKDIR /app

# Copie des fichiers de dépendances uniquement
COPY package*.json ./

#Installation des dépendances : On monte un cache pour les dépendances sur lequel va s'appuyer Docker afin d'accélérer les builds suivants
# npm ci pour installer les dépendances à partir du package-lock.json(pas de mise à jour) et on omet les dépendances de dev pour réduire la taille de l'image finale
RUN --mount=type=cache,target=/root/.npm npm ci --omit=dev


# ============================================
#Stage de production
# ============================================
FROM node:22-alpine AS production

WORKDIR /app

# Création d'un utilisateur non-root 
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001

# Copie des dépendances depuis le stage deps
COPY --from=starter --chown=nodejs:nodejs /app/node_modules ./node_modules

# Copie du code source (sans .git, node_modules, etc. grâce au .dockerignore)
COPY --chown=nodejs:nodejs . .

#Documentation du Port d'écoute de l'app(Le port n'est réelement ouvert que si on le mappe lors du lancement du conteneur)
EXPOSE 4000

# Utilisateur non-root
USER nodejs

#Définition du HEALTHCHECK pour le conteneur afin de s'assurer que l'app est en cours d'exécution et répond correctement aux requêtes HTTP
HEALTHCHECK --interval=30s --timeout=3s \
CMD node -e "require('http').get('http://localhost:4000/health', r => process.exit(r.statusCode === 200 ? 0 : 1))"

#Commande pour démarrer l'application
CMD ["node", "src/app.js"]








