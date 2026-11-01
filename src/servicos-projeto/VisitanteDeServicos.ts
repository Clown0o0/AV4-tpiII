import type { PacoteServico } from './PacoteServico';
import type { ServicoAtomico } from './ServicoAtomico';

export interface VisitanteDeServicos {
  visitarServicoAtomico(servico: ServicoAtomico): void;
  visitarPacoteServico(pacote: PacoteServico): void;
}
