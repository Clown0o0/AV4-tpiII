import type { Profissional } from '../domain/entities/Profissional';
import type { TipoEstrategia } from '../domain/entities/Projeto';
import {
  arredondar,
  ordenarRanking,
  type CandidatoPontuado,
  type ContextoEstrategia,
  type RecomendacaoStrategy,
} from './RecomendacaoStrategy';

export const PESO_AFINIDADE_TIPO = 0.2;

export abstract class RecomendadorPorTipo implements RecomendacaoStrategy {
  protected abstract readonly competenciasValorizadas: readonly string[];

  constructor(readonly base: RecomendacaoStrategy) {}

  get tipo(): TipoEstrategia {
    return this.base.tipo;
  }

  get descricao(): string {
    return this.base.descricao;
  }

  recomendar(candidatos: readonly Profissional[], contexto: ContextoEstrategia): CandidatoPontuado[] {
    return ordenarRanking(
      this.base.recomendar(candidatos, contexto).map((candidato) => {
        const afinidade = this.afinidade(candidato.profissional);
        return {
          profissional: candidato.profissional,
          score: arredondar((1 - PESO_AFINIDADE_TIPO) * candidato.score + PESO_AFINIDADE_TIPO * afinidade),
          detalhes: { ...candidato.detalhes, scoreBase: candidato.score, afinidadeTipo: arredondar(afinidade) },
        };
      }),
    );
  }

  private afinidade(profissional: Profissional): number {
    const vetor = profissional.vetorCompetencias();
    const soma = this.competenciasValorizadas.reduce((total, nome) => total + (vetor[nome] ?? 0), 0);
    return soma / this.competenciasValorizadas.length;
  }
}
