# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# LesPaniersDe — Dockerfile Next.js 15 production
# Build multi-étape : deps → builder → runner
# Image finale allégée, utilisateur non-root, port 3000
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

# ─── Etape 1 : Installation des dépendances ───────────────────
FROM node:20-alpine AS deps

# libc6-compat est nécessaire pour certains modules natifs sur Alpine
RUN apk add --no-cache libc6-compat

WORKDIR /app

# Copier uniquement les fichiers de dépendances pour profiter du cache Docker
# Si package.json ne change pas, cette étape est réutilisée du cache
COPY package.json package-lock.json* ./

RUN npm ci --only=production --ignore-scripts

# ─── Etape 2 : Build de l'application ─────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Récupérer les dépendances de l'étape précédente
COPY --from=deps /app/node_modules ./node_modules

# Copier le code source
COPY . .

# Désactiver la télémétrie Next.js pendant le build
ENV NEXT_TELEMETRY_DISABLED=1

# Variables d'environnement publiques nécessaires au build
# Elles sont "baked" dans le bundle côté client
ARG NEXT_PUBLIC_APP_URL
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY

ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY

# Build de production Next.js
RUN npm run build

# ─── Etape 3 : Image de production finale ─────────────────────
FROM node:20-alpine AS runner

WORKDIR /app

# Mode production
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Créer un groupe et un utilisateur non-root pour la sécurité
# L'application ne tourne jamais en root en production
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copier les fichiers publics
COPY --from=builder /app/public ./public

# Créer le dossier .next avec les bonnes permissions
# Nécessaire pour le cache de rendu Next.js
RUN mkdir .next
RUN chown nextjs:nodejs .next

# Copier le build optimisé Next.js (standalone)
# Next.js crée un dossier .next/standalone avec uniquement les fichiers nécessaires
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Passer à l'utilisateur non-root
USER nextjs

# Port exposé par l'application
EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Démarrer l'application via le serveur standalone Next.js
# Plus léger que `npm start` car il n'embarque pas npm
CMD ["node", "server.js"]
