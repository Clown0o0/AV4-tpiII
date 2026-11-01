import type { AdaptadorProfissional } from '../../adaptadores/profissional/AdaptadorProfissional';
import type { PapelTecnico } from '../entities/Projeto';
import type { Profissional } from '../entities/Profissional';

export type OrigemDosProfissionais = 'REPOSITORIO' | 'CACHE' | 'INDISPONIVEL';

export interface FiltroCandidatos {
  papeis: readonly PapelTecnico[];
  disponivelDe: Date;
  disponivelAte: Date;
  precoMinMaximo?: number;
}

export interface ResultadoBusca {
  profissionais: Profissional[];
  fonte: OrigemDosProfissionais;
  erro?: string;
}

export interface FonteDeProfissionais {
  buscarCandidatos(filtro: FiltroCandidatos): Promise<ResultadoBusca>;
  buscarPorIds(ids: readonly string[]): Promise<ResultadoBusca>;
  invalidar(): void;
}

export interface CicloDeVidaDoCatalogo {
  iniciar(): Promise<void>;
  parar(): void;
  trocarOrigem(adaptador: AdaptadorProfissional): void;
}
