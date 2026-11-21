CREATE SCHEMA IF NOT EXISTS "public";

CREATE TYPE "PapelTecnico" AS ENUM ('DIRETOR', 'DIRETOR_FOTOGRAFIA', 'SONOPLASTA', 'EDITOR', 'ROTEIRISTA', 'EFEITOS_VISUAIS');

CREATE TYPE "TipoCaptacao" AS ENUM ('DOCUMENTARIO', 'FICCAO', 'ANIMACAO', 'PUBLICITARIO');

CREATE TYPE "TipoEstrategia" AS ENUM ('COSSENO', 'FILTRAGEM_COLABORATIVA', 'ORCAMENTO_REDUZIDO');

CREATE TABLE "Projeto" (
    "id" UUID NOT NULL,
    "titulo" TEXT NOT NULL,
    "produtorId" TEXT NOT NULL,
    "produtorEmail" TEXT,
    "genero" TEXT NOT NULL,
    "duracaoEstimadaMin" INTEGER NOT NULL,
    "orcamentoTotal" DECIMAL(14,2) NOT NULL,
    "dataEntrega" TIMESTAMP(3) NOT NULL,
    "tipoCaptacao" "TipoCaptacao" NOT NULL,
    "localizacao" TEXT NOT NULL,
    "estrategia" "TipoEstrategia" NOT NULL DEFAULT 'COSSENO',
    "detalhes" JSONB,
    "servicoPrincipal" JSONB,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finalizadoEm" TIMESTAMP(3),

    CONSTRAINT "Projeto_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProjetoPapel" (
    "projetoId" UUID NOT NULL,
    "papel" "PapelTecnico" NOT NULL,
    "peso" DOUBLE PRECISION NOT NULL,
    "competenciasDesejadas" JSONB,

    CONSTRAINT "ProjetoPapel_pkey" PRIMARY KEY ("projetoId","papel")
);

CREATE INDEX "Projeto_produtorId_idx" ON "Projeto"("produtorId");

ALTER TABLE "ProjetoPapel" ADD CONSTRAINT "ProjetoPapel_projetoId_fkey" FOREIGN KEY ("projetoId") REFERENCES "Projeto"("id") ON DELETE CASCADE ON UPDATE CASCADE;
