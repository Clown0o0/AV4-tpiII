import type { ProjetoRepository } from './ProjetoRepository';

export interface CadastroDeProjetos extends ProjetoRepository {
  existe(id: string): Promise<boolean>;
  finalizar(id: string, em: Date): Promise<boolean>;
}
