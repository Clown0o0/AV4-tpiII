import { RecomendadorPorTipo } from '../../strategies/RecomendadorPorTipo';

export const COMPETENCIAS_PUBLICITARIO = ['ritmo', 'color_grading', 'iluminacao'] as const;

export class RecomendadorPublicitario extends RecomendadorPorTipo {
  protected readonly competenciasValorizadas = COMPETENCIAS_PUBLICITARIO;
}
