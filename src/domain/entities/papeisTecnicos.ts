import type { VetorCompetencias } from './Competencia';

export const PAPEIS_TECNICOS = [
  'DIRETOR',
  'DIRETOR_FOTOGRAFIA',
  'SONOPLASTA',
  'EDITOR',
  'ROTEIRISTA',
  'EFEITOS_VISUAIS',
] as const;
export type PapelTecnico = (typeof PAPEIS_TECNICOS)[number];

export interface PapelRequerido {
  readonly papel: PapelTecnico;
  readonly peso: number;
  readonly competenciasDesejadas?: VetorCompetencias;
}
