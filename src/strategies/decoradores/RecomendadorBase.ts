import type { Profissional } from '../../domain/entities/Profissional';
import type { TipoEstrategia } from '../../domain/entities/Projeto';
import type { CandidatoPontuado, ContextoEstrategia, RecomendacaoStrategy } from '../RecomendacaoStrategy';

export class RecomendadorBase implements RecomendacaoStrategy {
  constructor(private readonly estrategia: RecomendacaoStrategy) {}

  get tipo(): TipoEstrategia {
    return this.estrategia.tipo;
  }

  get descricao(): string {
    return this.estrategia.descricao;
  }

  recomendar(candidatos: readonly Profissional[], contexto: ContextoEstrategia): CandidatoPontuado[] {
    return this.estrategia.recomendar(candidatos, contexto);
  }
}
