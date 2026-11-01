import { RecomendadorPorTipo } from '../../strategies/RecomendadorPorTipo';

export const COMPETENCIAS_DOCUMENTARIO = ['pesquisa', 'narrativa', 'captacao_som'] as const;

export class RecomendadorDocumentario extends RecomendadorPorTipo {
  protected readonly competenciasValorizadas = COMPETENCIAS_DOCUMENTARIO;
}
