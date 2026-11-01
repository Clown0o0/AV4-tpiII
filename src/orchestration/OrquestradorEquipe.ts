import type { Profissional } from '../domain/entities/Profissional';
import type { PapelTecnico, Projeto, TipoEstrategia } from '../domain/entities/Projeto';
import type { VetorCompetencias } from '../domain/entities/Competencia';
import type { CandidatoPontuado, RecomendacaoStrategy } from '../strategies/RecomendacaoStrategy';

export interface MembroFixo {
  papel: PapelTecnico;
  profissionalId: string;
  custo: number;
}

export function custoDosMembrosFixos(membros: readonly MembroFixo[] = []): number {
  return membros.reduce((soma, membro) => soma + membro.custo, 0);
}

export interface EntradaOrquestracao {
  projeto: Projeto;
  profissionais: readonly Profissional[];
  estrategia: RecomendacaoStrategy;
  dataReferencia: Date;
  papeisAlvo?: readonly PapelTecnico[];
  membrosFixos?: readonly MembroFixo[];
  excluidosPorPapel?: ReadonlyMap<PapelTecnico, ReadonlySet<string>>;
}

export interface PapelNormalizado {
  papel: PapelTecnico;
  pesoOriginal: number;
  peso: number;
  perfilDesejado: VetorCompetencias;
  orcamentoPapel: number;
  candidatos: Profissional[];
}

export interface EntradaNormalizada {
  projeto: Projeto;
  estrategia: RecomendacaoStrategy;
  dataReferencia: Date;
  orcamentoDisponivel: number;
  papeis: PapelNormalizado[];
  universo: Profissional[];
  avisos: string[];
}

export interface RankingPapel {
  papel: PapelNormalizado;
  ranking: CandidatoPontuado[];
}

export interface SelecaoPapel {
  papel: PapelTecnico;
  escolhido: CandidatoPontuado;
  custo: number;
  alternativas: Array<{ candidato: CandidatoPontuado; custo: number }>;
}

export interface ResultadoOrquestracao {
  estrategia: TipoEstrategia;
  selecionados: SelecaoPapel[];
  papeisSemCandidato: PapelTecnico[];
  custoTotal: number;
  orcamentoDisponivel: number;
  parcial: boolean;
  avisos: string[];
}

export abstract class OrquestradorEquipe {
  protected constructor() {
    this.impedirSobrescritaDoFluxo(new.target.name);
  }

  orquestrar(entrada: EntradaOrquestracao): ResultadoOrquestracao {
    this.validarRestricoes(entrada);
    const normalizada = this.normalizarDados(entrada);
    const rankings = this.aplicarEstrategia(normalizada);
    return this.posProcessar(rankings, normalizada);
  }

  protected abstract validarRestricoes(entrada: EntradaOrquestracao): void;
  protected abstract normalizarDados(entrada: EntradaOrquestracao): EntradaNormalizada;
  protected abstract aplicarEstrategia(entrada: EntradaNormalizada): RankingPapel[];
  protected abstract posProcessar(rankings: RankingPapel[], entrada: EntradaNormalizada): ResultadoOrquestracao;

  private impedirSobrescritaDoFluxo(subclasse: string): void {
    if (this.orquestrar !== OrquestradorEquipe.prototype.orquestrar) {
      throw new TypeError(`${subclasse} não pode sobrescrever o fluxo orquestrar() do OrquestradorEquipe`);
    }
  }
}

Object.defineProperty(OrquestradorEquipe.prototype, 'orquestrar', { writable: false, configurable: false });
