import type { RecomendacaoStrategy } from '../RecomendacaoStrategy';
import type { NomeDecorador } from './nomesDosDecoradores';
import { RecomendadorBase } from './RecomendadorBase';

export type CriadorDeDecorador = (interno: RecomendacaoStrategy) => RecomendacaoStrategy;

export type CriadoresDeDecoradores = Readonly<Record<NomeDecorador, CriadorDeDecorador>>;

export class MontadorDePilhaDeDecoradores {
  constructor(private readonly criadores: CriadoresDeDecoradores) {}

  montar(estrategia: RecomendacaoStrategy, nomes: readonly NomeDecorador[]): RecomendacaoStrategy {
    return nomes.reduce<RecomendacaoStrategy>((interno, nome) => this.criadores[nome](interno), new RecomendadorBase(estrategia));
  }
}
