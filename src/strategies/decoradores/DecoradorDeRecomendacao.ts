import type { Profissional } from '../../domain/entities/Profissional';
import type { TipoEstrategia } from '../../domain/entities/Projeto';
import type { CandidatoPontuado, ContextoEstrategia, RecomendacaoStrategy } from '../RecomendacaoStrategy';

export abstract class DecoradorDeRecomendacao implements RecomendacaoStrategy {
  constructor(protected readonly interno: RecomendacaoStrategy) {}

  get tipo(): TipoEstrategia {
    return this.interno.tipo;
  }

  get descricao(): string {
    return this.interno.descricao;
  }

  abstract recomendar(candidatos: readonly Profissional[], contexto: ContextoEstrategia): CandidatoPontuado[];
}
