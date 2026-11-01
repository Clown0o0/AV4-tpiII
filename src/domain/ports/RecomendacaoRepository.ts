import type { Recomendacao } from '../entities/Recomendacao';

export interface RecomendacaoRepository {
  salvarRecomendacao(recomendacao: Recomendacao): Promise<void>;
  buscarRecomendacao(id: string): Promise<Recomendacao | null>;
  buscarRecomendacaoVigente(projetoId: string): Promise<Recomendacao | null>;
}
