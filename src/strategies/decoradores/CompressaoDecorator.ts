import type { Profissional } from '../../domain/entities/Profissional';
import type { CandidatoPontuado, ContextoEstrategia } from '../RecomendacaoStrategy';
import { DecoradorDeRecomendacao } from './DecoradorDeRecomendacao';

const DETALHES_COMPRIMIDOS: Readonly<Record<string, number>> = Object.freeze({});

export class CompressaoDecorator extends DecoradorDeRecomendacao {
  recomendar(candidatos: readonly Profissional[], contexto: ContextoEstrategia): CandidatoPontuado[] {
    return this.interno
      .recomendar(candidatos, contexto)
      .map((candidato) => ({ profissional: candidato.profissional, score: candidato.score, detalhes: DETALHES_COMPRIMIDOS }));
  }
}
