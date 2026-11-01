import { PAPEIS_TECNICOS, type PapelTecnico } from '../../domain/entities/Projeto';

export function papeisReconhecidos(textos: readonly string[]): PapelTecnico[] {
  return textos.flatMap((texto) => PAPEIS_TECNICOS.filter((papel) => papel === texto));
}
