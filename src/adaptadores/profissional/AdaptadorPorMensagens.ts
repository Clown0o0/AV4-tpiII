import type { Profissional } from '../../domain/entities/Profissional';
import type { ClienteRpc } from '../../mensageria/ClienteRpc';
import { profissionaisDeJson, profissionalDeJson } from '../../mensageria/codecs/profissionalJson';
import { OPERACOES_PROFISSIONAIS } from '../../mensageria/filas';
import type { AdaptadorProfissional, AvaliacaoProfissional, CriteriosBusca } from './AdaptadorProfissional';

export class AdaptadorPorMensagens implements AdaptadorProfissional {
  constructor(private readonly cliente: ClienteRpc) {}

  async listarProfissionais(criterios: CriteriosBusca): Promise<Profissional[]> {
    const dados = criterios.ids ? { ids: [...criterios.ids] } : {};
    return profissionaisDeJson(await this.cliente.chamar(OPERACOES_PROFISSIONAIS.LISTAR, dados));
  }

  async detalharProfissional(id: string): Promise<Profissional> {
    return profissionalDeJson(await this.cliente.chamar(OPERACOES_PROFISSIONAIS.DETALHAR, { id }));
  }

  async registrarAvaliacao(id: string, avaliacao: AvaliacaoProfissional): Promise<void> {
    await this.cliente.chamar(OPERACOES_PROFISSIONAIS.AVALIAR, { id, avaliacao: { ...avaliacao } });
  }
}
