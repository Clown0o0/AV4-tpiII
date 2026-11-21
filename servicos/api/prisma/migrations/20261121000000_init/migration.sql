CREATE SCHEMA IF NOT EXISTS "public";

CREATE TYPE "PapelTecnico" AS ENUM ('DIRETOR', 'DIRETOR_FOTOGRAFIA', 'SONOPLASTA', 'EDITOR', 'ROTEIRISTA', 'EFEITOS_VISUAIS');

CREATE TYPE "TipoEstrategia" AS ENUM ('COSSENO', 'FILTRAGEM_COLABORATIVA', 'ORCAMENTO_REDUZIDO');

CREATE TYPE "StatusRecomendacao" AS ENUM ('EM_ANDAMENTO', 'FINALIZADA', 'OBSOLETA');

CREATE TYPE "StatusMembro" AS ENUM ('SUGERIDO', 'CONVIDADO', 'CONFIRMADO', 'REJEITADO', 'RECUSADO', 'SUBSTITUIDO');

CREATE TYPE "StatusConvite" AS ENUM ('PENDENTE', 'ACEITO', 'RECUSADO', 'CANCELADO');

CREATE TABLE "Recomendacao" (
    "id" UUID NOT NULL,
    "projetoId" UUID NOT NULL,
    "estrategia" "TipoEstrategia" NOT NULL,
    "status" "StatusRecomendacao" NOT NULL DEFAULT 'EM_ANDAMENTO',
    "parcial" BOOLEAN NOT NULL DEFAULT false,
    "avisos" TEXT[],
    "rodadas" INTEGER NOT NULL DEFAULT 1,
    "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finalizadaEm" TIMESTAMP(3),

    CONSTRAINT "Recomendacao_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MembroRecomendado" (
    "id" UUID NOT NULL,
    "recomendacaoId" UUID NOT NULL,
    "papel" "PapelTecnico" NOT NULL,
    "profissionalId" UUID NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "custo" DECIMAL(12,2) NOT NULL,
    "status" "StatusMembro" NOT NULL,
    "rodada" INTEGER NOT NULL,
    "alternativas" JSONB NOT NULL,

    CONSTRAINT "MembroRecomendado_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Convite" (
    "id" UUID NOT NULL,
    "recomendacaoId" UUID NOT NULL,
    "projetoId" UUID NOT NULL,
    "profissionalId" UUID NOT NULL,
    "papel" "PapelTecnico" NOT NULL,
    "status" "StatusConvite" NOT NULL DEFAULT 'PENDENTE',
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondidoEm" TIMESTAMP(3),

    CONSTRAINT "Convite_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Recomendacao_projetoId_status_idx" ON "Recomendacao"("projetoId", "status");

CREATE INDEX "MembroRecomendado_recomendacaoId_idx" ON "MembroRecomendado"("recomendacaoId");

CREATE INDEX "Convite_recomendacaoId_idx" ON "Convite"("recomendacaoId");

CREATE INDEX "Convite_profissionalId_idx" ON "Convite"("profissionalId");

ALTER TABLE "MembroRecomendado" ADD CONSTRAINT "MembroRecomendado_recomendacaoId_fkey" FOREIGN KEY ("recomendacaoId") REFERENCES "Recomendacao"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Convite" ADD CONSTRAINT "Convite_recomendacaoId_fkey" FOREIGN KEY ("recomendacaoId") REFERENCES "Recomendacao"("id") ON DELETE CASCADE ON UPDATE CASCADE;
