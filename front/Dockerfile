# Image du service quiz-front.
#
# Contexte de build : ce dossier.
#   docker build -f front/Dockerfile -t <compte>/quiz-front:<sha> front/

FROM node:22-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production

COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./package.json
COPY server.js ./server.js
COPY public ./public

USER node
EXPOSE 3000

# Interroge la liveness, pas /sante : le conteneur ne doit pas etre declare
# malade parce que son API est tombee.
HEALTHCHECK --interval=10s --timeout=3s --start-period=15s \
  CMD wget -qO- http://localhost:3000/health || exit 1

CMD ["node", "server.js"]
