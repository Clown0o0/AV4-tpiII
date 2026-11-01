import type { Profissional } from '../../domain/entities/Profissional';

export interface CriteriosBusca {
  readonly ids?: readonly string[];
}

export interface AvaliacaoProfissional {
  readonly autorId: string;
  readonly nota: number;
  readonly comentario: string | null;
}

export interface AdaptadorProfissional {
  listarProfissionais(criterios: CriteriosBusca): Promise<Profissional[]>;
  detalharProfissional(id: string): Promise<Profissional>;
  registrarAvaliacao(id: string, avaliacao: AvaliacaoProfissional): Promise<void>;
}
