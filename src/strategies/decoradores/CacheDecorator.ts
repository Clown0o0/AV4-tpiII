import type { Profissional } from '../../domain/entities/Profissional';
import type { CandidatoPontuado, ContextoEstrategia, RecomendacaoStrategy } from '../RecomendacaoStrategy';
import { ChaveDeRecomendacao } from './ChaveDeRecomendacao';
import { DecoradorDeRecomendacao } from './DecoradorDeRecomendacao';

export const TTL_CACHE_PADRAO_MS = 60_000;
export const TAMANHO_MAXIMO_CACHE_PADRAO = 256;

export interface OpcoesCache {
  ttlMs: number;
  tamanhoMaximo: number;
  relogio: () => number;
}

interface EntradaDoCache {
  ranking: readonly CandidatoPontuado[];
  expiraEm: number;
}

export class CacheDecorator extends DecoradorDeRecomendacao {
  private readonly opcoes: OpcoesCache;
  private readonly entradas = new Map<string, EntradaDoCache>();
  private readonly chaves = new ChaveDeRecomendacao();

  constructor(interno: RecomendacaoStrategy, opcoes: Partial<OpcoesCache> = {}) {
    super(interno);
    this.opcoes = { ttlMs: TTL_CACHE_PADRAO_MS, tamanhoMaximo: TAMANHO_MAXIMO_CACHE_PADRAO, relogio: Date.now, ...opcoes };
  }

  get tamanho(): number {
    return this.entradas.size;
  }

  recomendar(candidatos: readonly Profissional[], contexto: ContextoEstrategia): CandidatoPontuado[] {
    const chave = this.chaves.gerar(this.tipo, candidatos, contexto);
    const agora = this.opcoes.relogio();
    const guardada = this.entradas.get(chave);
    this.entradas.delete(chave);
    if (guardada && guardada.expiraEm > agora) {
      this.entradas.set(chave, guardada);
      return copiarRanking(guardada.ranking);
    }
    const ranking = this.interno.recomendar(candidatos, contexto);
    this.guardar(chave, { ranking: copiarRanking(ranking), expiraEm: agora + this.opcoes.ttlMs });
    return ranking;
  }

  private guardar(chave: string, entrada: EntradaDoCache): void {
    if (this.opcoes.tamanhoMaximo <= 0) return;
    this.entradas.set(chave, entrada);
    for (const maisAntiga of this.entradas.keys()) {
      if (this.entradas.size <= this.opcoes.tamanhoMaximo) break;
      this.entradas.delete(maisAntiga);
    }
  }
}

function copiarRanking(ranking: readonly CandidatoPontuado[]): CandidatoPontuado[] {
  return ranking.map((candidato) => ({ profissional: candidato.profissional, score: candidato.score, detalhes: { ...candidato.detalhes } }));
}
