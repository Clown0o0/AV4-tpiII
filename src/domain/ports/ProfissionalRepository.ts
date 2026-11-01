import type { Avaliacao } from '../entities/Avaliacao';
import type { Profissional } from '../entities/Profissional';

export interface ProfissionalRepository {
  listarTodos(): Promise<Profissional[]>;
  buscarPorIds(ids: readonly string[]): Promise<Profissional[]>;
  buscarPorId(id: string): Promise<Profissional | null>;
  registrarAvaliacao(avaliacao: Avaliacao): Promise<void>;
}
