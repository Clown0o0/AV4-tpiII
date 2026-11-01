import type { Profissional } from '../../domain/entities/Profissional';
import type { ProfissionalRepository } from '../../domain/ports/ProfissionalRepository';
import { ApiProfissionalExterna } from './ApiProfissionalExterna';

export const ESCALA_HABILIDADE_INDEED = 10;
export const PONTOS_POR_ESTRELA_INDEED = 2;
export const REVISOR_EXTERNO_INDEED = 'indeed';

export interface CandidatoIndeed {
  readonly candidateId: string;
  readonly name: string;
  readonly email: string;
  readonly jobTitles: readonly string[];
  readonly salary: { readonly min: number; readonly max: number; readonly currency: string };
  readonly city: string;
  readonly skills: Readonly<Record<string, number>>;
  readonly workHistory: readonly string[];
  readonly availability: ReadonlyArray<{ readonly from: number; readonly to: number }>;
  readonly ratings: ReadonlyArray<{ readonly reviewer: string; readonly score: number }>;
}

export interface ResultadoIndeed {
  readonly results: readonly CandidatoIndeed[];
  readonly totalResults: number;
}

export class IndeedSimulado {
  private readonly api: ApiProfissionalExterna<CandidatoIndeed>;

  constructor(cadastroDaPlataforma: ProfissionalRepository) {
    this.api = new ApiProfissionalExterna(cadastroDaPlataforma, candidatoIndeedDe);
  }

  async searchCandidates(consulta: { readonly candidateIds?: readonly string[] }): Promise<ResultadoIndeed> {
    const results = await this.api.buscarProfissionais(consulta.candidateIds ? { ids: consulta.candidateIds } : {});
    return { results, totalResults: results.length };
  }

  getCandidate(candidateId: string): Promise<CandidatoIndeed | null> {
    return this.api.obterPerfil(candidateId);
  }

  rateCandidate(candidateId: string, avaliacao: { readonly score: number }): Promise<void> {
    return this.api.avaliarProfissional(candidateId, avaliacao.score);
  }
}

function candidatoIndeedDe(profissional: Profissional, pontuacoesRecebidas: readonly number[]): CandidatoIndeed {
  return {
    candidateId: profissional.id,
    name: profissional.nome,
    email: profissional.email,
    jobTitles: [...profissional.especialidades],
    salary: { min: profissional.precoMin, max: profissional.precoMax, currency: 'BRL' },
    city: profissional.localizacao,
    skills: Object.fromEntries(profissional.competencias.map((c) => [c.nome, c.nivel * ESCALA_HABILIDADE_INDEED])),
    workHistory: [...profissional.historicoProjetos],
    availability: profissional.disponibilidade.map((j) => ({ from: j.inicio.getTime(), to: j.fim.getTime() })),
    ratings: [
      ...profissional.avaliacoes.map((a) => ({ reviewer: a.autorId, score: a.nota * PONTOS_POR_ESTRELA_INDEED })),
      ...pontuacoesRecebidas.map((score) => ({ reviewer: REVISOR_EXTERNO_INDEED, score })),
    ],
  };
}
