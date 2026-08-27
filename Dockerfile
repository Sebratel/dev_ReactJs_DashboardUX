# Build com contexto na pasta frontend-react/ (nao precisa de outras pastas):
#   docker build -f frontend-react/Dockerfile -t consolidador-frontend frontend-react

# ---- Stage 1: build (Vite) ----
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .

# Vite le VITE_* do ambiente do processo de build (prioridade sobre .env.*),
# entao isso baked no bundle final. Default relativo (mesma origem) porque o
# nginx deste servico faz reverse proxy de /api pro BFF (ver nginx.conf) -
# so sobrescreva este ARG se o BFF nao estiver atras deste proxy.
ARG VITE_API_BASE_URL=/api
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
RUN npm run build

# ---- Stage 2: runtime (Nginx servindo os arquivos estaticos) ----
FROM nginx:1.27-alpine
COPY --from=build /app/dist /usr/share/nginx/html
# Template (nao .conf direto) - o entrypoint oficial da imagem roda envsubst
# nos arquivos de /etc/nginx/templates/*.template e escreve o resultado em
# /etc/nginx/conf.d/ ja no start do container, usando as env vars abaixo
# (sobrescreviveis via docker-compose.yml sem rebuildar a imagem).
COPY nginx.conf.template /etc/nginx/templates/default.conf.template
ENV API_UPSTREAM=186.219.134.246:3210 \
    AUTOMATION_UPSTREAM=186.219.134.246:3212 \
    VNC_UPSTREAM=186.219.134.246:6080
EXPOSE 3211
