import { PacoteServico } from './PacoteServico';
import { ServicoAtomico } from './ServicoAtomico';
import type { ServicoProjeto } from './ServicoProjeto';
import { TransformadorDeServicos } from './TransformadorDeServicos';

export function clonarServico(servico: ServicoProjeto): ServicoProjeto {
  return TransformadorDeServicos.aplicar<ServicoProjeto>(servico, {
    atomico: (atomico) => new ServicoAtomico(atomico.dados()),
    pacote: (pacote, subservicos) => new PacoteServico(pacote.nome, subservicos),
  });
}
