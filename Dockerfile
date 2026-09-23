# ── Build ──────────────────────────────────────────────────────
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
# Variables públicas de Vite (quedan dentro del bundle; la anon key es pública
# por diseño, la seguridad la dan RLS y los triggers de supabase/schema.sql).
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL \
    VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY
RUN npm run build

# ── Runtime ────────────────────────────────────────────────────
FROM nginx:1.29-alpine
# Origen de Supabase permitido por la CSP (p. ej. https://abc.supabase.co o
# tu instancia autoalojada https://supabase.midominio.com).
ENV SUPABASE_ORIGIN=https://*.supabase.co \
    SUPABASE_WS_ORIGIN=wss://*.supabase.co
COPY nginx/default.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1/healthz || exit 1
