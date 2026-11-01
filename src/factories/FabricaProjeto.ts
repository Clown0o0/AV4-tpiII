import type { DadosProjeto, Projeto, TipoCaptacao } from '../domain/entities/Projeto';
import type { Observador } from '../events/RecomendacaoEventEmitter';
import type { LoggerEstruturado } from '../events/observadores/AuditoriaObservador';
import type { RecomendacaoStrategy } from '../strategies/RecomendacaoStrategy';
import type { ProjetoVisitor } from '../visitors/ProjetoVisitor';
import type { Relatorio } from '../visitors/RelatorioVisitor';
import type { ResultadoValidacao } from '../visitors/ValidacaoConsistenciaVisitor';

export interface FabricaProjeto {
  readonly tipo: TipoCaptacao;
  comEstrategia(base: RecomendacaoStrategy): FabricaProjeto;
  criarProjeto(dados: DadosProjeto): Projeto;
  criarValidador(dataReferencia?: Date): ProjetoVisitor<ResultadoValidacao>;
  criarRecomendador(): RecomendacaoStrategy;
  criarNotificador(): Observador;
  criarRelatorio(): ProjetoVisitor<Relatorio>;
}

export interface CatalogoFabricas {
  obter(tipo: TipoCaptacao): FabricaProjeto;
  tipos(): TipoCaptacao[];
}

export interface OpcoesFabrica {
  estrategiaBase: RecomendacaoStrategy;
  logger?: LoggerEstruturado;
}

export abstract class FabricaProjetoBase implements FabricaProjeto {
  abstract readonly tipo: TipoCaptacao;
  constructor(protected readonly opcoes: OpcoesFabrica) {}

  abstract comEstrategia(base: RecomendacaoStrategy): FabricaProjeto;

  protected opcoesComEstrategia(base: RecomendacaoStrategy): OpcoesFabrica {
    return { ...this.opcoes, estrategiaBase: base };
  }

  abstract criarProjeto(dados: DadosProjeto): Projeto;
  abstract criarValidador(dataReferencia?: Date): ProjetoVisitor<ResultadoValidacao>;
  abstract criarRecomendador(): RecomendacaoStrategy;
  abstract criarNotificador(): Observador;
  abstract criarRelatorio(): ProjetoVisitor<Relatorio>;
}
