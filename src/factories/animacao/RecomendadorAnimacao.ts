import { RecomendadorPorTipo } from '../../strategies/RecomendadorPorTipo';

export const COMPETENCIAS_ANIMACAO = ['vfx', 'animacao_3d', 'composicao'] as const;

export class RecomendadorAnimacao extends RecomendadorPorTipo {
  protected readonly competenciasValorizadas = COMPETENCIAS_ANIMACAO;
}
