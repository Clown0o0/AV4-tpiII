import { Avaliacao } from '../../domain/entities/Avaliacao';
import type { Profissional } from '../../domain/entities/Profissional';
import type { ProfissionalRepository } from '../../domain/ports/ProfissionalRepository';
import type { AdaptadorProfissional, AvaliacaoProfissional, CriteriosBusca } from './AdaptadorProfissional';
import { profissionalInexistente } from './profissionalInexistente';

export class AdaptadorInterno implements AdaptadorProfissional {
  constructor(private readonly cadastro: ProfissionalRepository) {}

  listarProfissionais(criterios: CriteriosBusca): Promise<Profissional[]> {
    return criterios.ids ? this.cadastro.buscarPorIds(criterios.ids) : this.cadastro.listarTodos();
  }

  async detalharProfissional(id: string): Promise<Profissional> {
    const profissional = await this.cadastro.buscarPorId(id);
    if (!profissional) throw profissionalInexistente(id);
    return profissional;
  }

  async registrarAvaliacao(id: string, avaliacao: AvaliacaoProfissional): Promise<void> {
    const profissional = await this.detalharProfissional(id);
    await this.cadastro.registrarAvaliacao(
      new Avaliacao({ profissionalId: profissional.id, autorId: avaliacao.autorId, nota: avaliacao.nota, comentario: avaliacao.comentario }),
    );
  }
}
