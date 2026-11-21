CREATE SCHEMA IF NOT EXISTS "public";

CREATE TYPE "PapelTecnico" AS ENUM ('DIRETOR', 'DIRETOR_FOTOGRAFIA', 'SONOPLASTA', 'EDITOR', 'ROTEIRISTA', 'EFEITOS_VISUAIS');

CREATE TABLE "Profissional" (
    "id" UUID NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "especialidades" "PapelTecnico"[],
    "precoMin" DECIMAL(12,2) NOT NULL,
    "precoMax" DECIMAL(12,2) NOT NULL,
    "localizacao" TEXT NOT NULL,
    "historicoProjetos" TEXT[],

    CONSTRAINT "Profissional_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Disponibilidade" (
    "id" UUID NOT NULL,
    "profissionalId" UUID NOT NULL,
    "inicio" TIMESTAMP(3) NOT NULL,
    "fim" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Disponibilidade_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Competencia" (
    "id" UUID NOT NULL,
    "profissionalId" UUID NOT NULL,
    "nome" TEXT NOT NULL,
    "nivel" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "Competencia_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Avaliacao" (
    "id" UUID NOT NULL,
    "profissionalId" UUID NOT NULL,
    "autorId" TEXT NOT NULL,
    "projetoId" TEXT,
    "nota" INTEGER NOT NULL,
    "comentario" TEXT,
    "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Avaliacao_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Profissional_email_key" ON "Profissional"("email");

CREATE INDEX "Profissional_especialidades_idx" ON "Profissional" USING GIN ("especialidades");

CREATE INDEX "Profissional_precoMin_idx" ON "Profissional"("precoMin");

CREATE INDEX "Disponibilidade_profissionalId_inicio_fim_idx" ON "Disponibilidade"("profissionalId", "inicio", "fim");

CREATE UNIQUE INDEX "Competencia_profissionalId_nome_key" ON "Competencia"("profissionalId", "nome");

CREATE INDEX "Avaliacao_profissionalId_idx" ON "Avaliacao"("profissionalId");

CREATE INDEX "Avaliacao_autorId_idx" ON "Avaliacao"("autorId");

ALTER TABLE "Disponibilidade" ADD CONSTRAINT "Disponibilidade_profissionalId_fkey" FOREIGN KEY ("profissionalId") REFERENCES "Profissional"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Competencia" ADD CONSTRAINT "Competencia_profissionalId_fkey" FOREIGN KEY ("profissionalId") REFERENCES "Profissional"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Avaliacao" ADD CONSTRAINT "Avaliacao_profissionalId_fkey" FOREIGN KEY ("profissionalId") REFERENCES "Profissional"("id") ON DELETE CASCADE ON UPDATE CASCADE;
