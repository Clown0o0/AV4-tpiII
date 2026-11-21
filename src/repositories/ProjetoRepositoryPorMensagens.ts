import type { Projeto } from '../domain/entities/Projeto';
import type { FinalizadorDeProjetos } from '../domain/ports/FinalizadorDeProjetos';
import type { ProjetoRepository } from '../domain/ports/ProjetoRepository';
import type { CatalogoFabricas } from '../factories/FabricaProjeto';
import type { ClienteRpc } from '../mensageria/ClienteRpc';
import { projetoDeJson, projetoParaJson } from '../mensageria/codecs/projetoJson';
import { OPERACOES_PROJETOS } from '../mensageria/filas';

export class ProjetoRepositoryPorMensagens implements ProjetoRepository, FinalizadorDeProjetos {
  constructor(
    private readonly cliente: ClienteRpc,
    private readonly fabricas: CatalogoFabricas,
  ) {}

  async salvar(projeto: Projeto): Promise<void> {
    await this.cliente.chamar(OPERACOES_PROJETOS.SALVAR, { projeto: projetoParaJson(projeto) });
  }

  async buscarPorId(id: string): Promise<Projeto | null> {
    const resultado = await this.cliente.chamar(OPERACOES_PROJETOS.BUSCAR, { id });
    return resultado === null ? null : projetoDeJson(resultado, this.fabricas);
  }

  async finalizar(projetoId: string): Promise<void> {
    await this.cliente.chamar(OPERACOES_PROJETOS.FINALIZAR, { id: projetoId });
  }
}
