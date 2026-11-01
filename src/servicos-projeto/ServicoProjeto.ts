import type { Elemento } from '../domain/entities/Visitante';
import type { VisitanteDeServicos } from './VisitanteDeServicos';

export interface ServicoProjeto extends Elemento<VisitanteDeServicos> {
  calcularCusto(): number;
  listarSubservicos(): readonly ServicoProjeto[];
  obterPrazo(): number;
  validar(): void;
}
