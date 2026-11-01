import type { Profissional } from '../../domain/entities/Profissional';
import type { ProfissionalRepository } from '../../domain/ports/ProfissionalRepository';
import { ApiProfissionalExterna } from './ApiProfissionalExterna';

export const PREFIXO_URN_LINKEDIN = 'urn:li:person:';
export const ESCALA_PROFICIENCIA_LINKEDIN = 100;
export const AUTOR_RECOMENDACAO_LINKEDIN = 'linkedin';

export interface PerfilLinkedIn {
  readonly urn: string;
  readonly localizedName: string;
  readonly email: string;
  readonly occupations: readonly string[];
  readonly skills: ReadonlyArray<{ readonly name: string; readonly proficiency: number }>;
  readonly positions: ReadonlyArray<{ readonly title: string }>;
  readonly location: { readonly city: string };
  readonly rate: { readonly currency: string; readonly minimum: number; readonly maximum: number };
  readonly availability: ReadonlyArray<{ readonly start: string; readonly end: string }>;
  readonly recommendations: ReadonlyArray<{ readonly author: string; readonly stars: number }>;
}

export interface PaginaLinkedIn {
  readonly elements: readonly PerfilLinkedIn[];
  readonly paging: { readonly total: number };
}

export class LinkedInSimulado {
  private readonly api: ApiProfissionalExterna<PerfilLinkedIn>;

  constructor(cadastroDaPlataforma: ProfissionalRepository) {
    this.api = new ApiProfissionalExterna(cadastroDaPlataforma, perfilLinkedInDe);
  }

  static urnDe(id: string): string {
    return `${PREFIXO_URN_LINKEDIN}${id}`;
  }

  static idDe(urn: string): string {
    return urn.startsWith(PREFIXO_URN_LINKEDIN) ? urn.slice(PREFIXO_URN_LINKEDIN.length) : urn;
  }

  async pesquisarPessoas(consulta: { readonly urns?: readonly string[] }): Promise<PaginaLinkedIn> {
    const ids = consulta.urns?.map(LinkedInSimulado.idDe);
    const elements = await this.api.buscarProfissionais(ids ? { ids } : {});
    return { elements, paging: { total: elements.length } };
  }

  obterPessoa(urn: string): Promise<PerfilLinkedIn | null> {
    return this.api.obterPerfil(LinkedInSimulado.idDe(urn));
  }

  recomendarPessoa(urn: string, recomendacao: { readonly stars: number }): Promise<void> {
    return this.api.avaliarProfissional(LinkedInSimulado.idDe(urn), recomendacao.stars);
  }
}

function perfilLinkedInDe(profissional: Profissional, estrelasRecebidas: readonly number[]): PerfilLinkedIn {
  return {
    urn: LinkedInSimulado.urnDe(profissional.id),
    localizedName: profissional.nome,
    email: profissional.email,
    occupations: [...profissional.especialidades],
    skills: profissional.competencias.map((c) => ({ name: c.nome, proficiency: c.nivel * ESCALA_PROFICIENCIA_LINKEDIN })),
    positions: profissional.historicoProjetos.map((title) => ({ title })),
    location: { city: profissional.localizacao },
    rate: { currency: 'BRL', minimum: profissional.precoMin, maximum: profissional.precoMax },
    availability: profissional.disponibilidade.map((j) => ({ start: j.inicio.toISOString(), end: j.fim.toISOString() })),
    recommendations: [
      ...profissional.avaliacoes.map((a) => ({ author: a.autorId, stars: a.nota })),
      ...estrelasRecebidas.map((stars) => ({ author: AUTOR_RECOMENDACAO_LINKEDIN, stars })),
    ],
  };
}
