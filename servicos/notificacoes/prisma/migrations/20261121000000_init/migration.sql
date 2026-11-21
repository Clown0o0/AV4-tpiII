CREATE SCHEMA IF NOT EXISTS "public";

CREATE TYPE "OrigemNotificacao" AS ENUM ('PROJETOS', 'RECOMENDACOES');

CREATE TABLE "notificacoes" (
    "id" UUID NOT NULL,
    "evento" TEXT NOT NULL,
    "origem" "OrigemNotificacao" NOT NULL,
    "projetoId" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "texto" TEXT NOT NULL,
    "destinatarios" TEXT[],
    "ocorridoEm" TIMESTAMP(3) NOT NULL,
    "recebidaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notificacoes_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "notificacoes_projetoId_idx" ON "notificacoes"("projetoId");
