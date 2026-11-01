import type { DadosProjeto, Projeto, TipoCaptacao } from '../../domain/entities/Projeto';
import type { Observador } from '../../events/RecomendacaoEventEmitter';
import type { FabricaProjeto } from '../../factories/FabricaProjeto';
import type { ProjetoVisitor } from '../../visitors/ProjetoVisitor';
import type { Relatorio } from '../../visitors/RelatorioVisitor';
import type { ResultadoValidacao } from '../../visitors/ValidacaoConsistenciaVisitor';
import type { RecomendacaoStrategy } from '../RecomendacaoStrategy';
import type { RecomendadoresDecorados } from './RecomendadoresDecorados';

export class FabricaComRecomendadorDecorado implements FabricaProjeto {
  constructor(
    private readonly origem: FabricaProjeto,
    private readonly recomendadores: RecomendadoresDecorados,
    private readonly atual: FabricaProjeto = origem,
    private readonly base: RecomendacaoStrategy | null = null,
  ) {}

  get tipo(): TipoCaptacao {
    return this.atual.tipo;
  }

  comEstrategia(base: RecomendacaoStrategy): FabricaProjeto {
    return new FabricaComRecomendadorDecorado(this.origem, this.recomendadores, this.atual.comEstrategia(base), base);
  }

  criarProjeto(dados: DadosProjeto): Projeto {
    return this.atual.criarProjeto(dados);
  }

  criarValidador(dataReferencia?: Date): ProjetoVisitor<ResultadoValidacao> {
    return this.atual.criarValidador(dataReferencia);
  }

  criarRecomendador(): RecomendacaoStrategy {
    return this.recomendadores.obter(this.origem, this.base, () => this.atual.criarRecomendador());
  }

  criarNotificador(): Observador {
    return this.atual.criarNotificador();
  }

  criarRelatorio(): ProjetoVisitor<Relatorio> {
    return this.atual.criarRelatorio();
  }
}
