FROM node:24-alpine

RUN apk add --no-cache curl openssl

WORKDIR /usr/src/app

COPY package.json package-lock.json ./
COPY servicos/api/prisma ./servicos/api/prisma
COPY servicos/profissionais/prisma ./servicos/profissionais/prisma
COPY servicos/projetos/prisma ./servicos/projetos/prisma
COPY servicos/notificacoes/prisma ./servicos/notificacoes/prisma
RUN npm ci

COPY tsconfig.json tsconfig.build.json ./
COPY src ./src
RUN npm run build && chown -R node:node /usr/src/app

USER node

ENV PORT=3002
EXPOSE 3002

CMD ["sh", "-c", "./node_modules/.bin/prisma migrate deploy --schema servicos/projetos/prisma/schema.prisma && exec node dist/entradas/projetos.js"]
