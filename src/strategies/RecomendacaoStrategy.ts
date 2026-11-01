import type { Profissional } from '../domain/entities/Profissional';
import type { PapelTecnico, Projeto, TipoEstrategia } from '../domain/entities/Projeto';
import type { VetorCompetencias } from '../domain/entities/Competencia';

export interface ContextoEstrategia {
  projeto: Projeto;
  papel: PapelTecnico;
  perfilDesejado: VetorCompetencias;
  orcamentoPapel: number;
  universo: readonly Profissional[];
}

export interface CandidatoPontuado {
  profissional: Profissional;
  score: number;
  detalhes: Readonly<Record<string, number>>;
}

export interface RecomendacaoStrategy {
  readonly tipo: TipoEstrategia;
  readonly descricao: string;
  recomendar(candidatos: readonly Profissional[], contexto: ContextoEstrategia): CandidatoPontuado[];
}

export interface CatalogoEstrategias {
  obter(tipo: TipoEstrategia): RecomendacaoStrategy;
  tipos(): TipoEstrategia[];
}

export function ordenarRanking(candidatos: CandidatoPontuado[]): CandidatoPontuado[] {
  return candidatos.sort(
    (a, b) =>
      b.score - a.score ||
      a.profissional.precoMin - b.profissional.precoMin ||
      a.profissional.id.localeCompare(b.profissional.id),
  );
}

export function arredondar(valor: number, casas = 4): number {
  const fator = 10 ** casas;
  return Math.round(valor * fator) / fator;
}
