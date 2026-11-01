import type { AdaptadorPagamento, StatusPagamento } from '../adaptadores/pagamento/AdaptadorPagamento';
import type { PapelTecnico, Projeto } from '../domain/entities/Projeto';
import type { MembroRecomendadoLeitura, Recomendacao } from '../domain/entities/Recomendacao';
import { ErroEstadoInvalido, ErroNaoEncontrado } from '../domain/errors';
import type { FonteDeProfissionais } from '../domain/ports/FonteDeProfissionais';

export interface SituacaoDoPagamento {
  pagamentoId: string;
  status: StatusPagamento;
}

export interface PagamentoDoMembro extends SituacaoDoPagamento {
  recomendacaoId: string;
  papel: PapelTecnico;
  valor: number;
  origem: string;
  destino: string;
}

export interface ServicoDePagamentos {
  pagarMembro(adaptador: AdaptadorPagamento, projeto: Projeto, recomendacao: Recomendacao, papel: PapelTecnico): Promise<PagamentoDoMembro>;
  consultar(adaptador: AdaptadorPagamento, pagamentoId: string): Promise<SituacaoDoPagamento>;
  cancelar(adaptador: AdaptadorPagamento, pagamentoId: string): Promise<SituacaoDoPagamento>;
}

export class GestorDePagamentos implements ServicoDePagamentos {
  constructor(private readonly profissionais: FonteDeProfissionais) {}

  async pagarMembro(
    adaptador: AdaptadorPagamento,
    projeto: Projeto,
    recomendacao: Recomendacao,
    papel: PapelTecnico,
  ): Promise<PagamentoDoMembro> {
    projeto.papelRequerido(papel);
    const membro = membroConfirmado(recomendacao, papel);
    const valor = await this.precoDoProfissional(membro.profissionalId);
    const origem = projeto.produtorId;
    const destino = membro.profissionalId;
    const pagamentoId = await adaptador.efetuarPagamento(valor, origem, destino);
    const status = await adaptador.verificarPagamento(pagamentoId);
    return { pagamentoId, status, recomendacaoId: recomendacao.id, papel, valor, origem, destino };
  }

  async consultar(adaptador: AdaptadorPagamento, pagamentoId: string): Promise<SituacaoDoPagamento> {
    return { pagamentoId, status: await adaptador.verificarPagamento(pagamentoId) };
  }

  async cancelar(adaptador: AdaptadorPagamento, pagamentoId: string): Promise<SituacaoDoPagamento> {
    const cancelado = await adaptador.cancelarPagamento(pagamentoId);
    if (!cancelado) throw new ErroEstadoInvalido(`Pagamento ${pagamentoId} já está cancelado`);
    return this.consultar(adaptador, pagamentoId);
  }

  private async precoDoProfissional(profissionalId: string): Promise<number> {
    const { profissionais } = await this.profissionais.buscarPorIds([profissionalId]);
    const profissional = profissionais[0];
    if (!profissional) throw new ErroNaoEncontrado(`Profissional ${profissionalId} não encontrado`);
    return profissional.precoMin;
  }
}

function membroConfirmado(recomendacao: Recomendacao, papel: PapelTecnico): MembroRecomendadoLeitura {
  const membro = recomendacao.membroAtivo(papel);
  if (membro?.status !== 'CONFIRMADO') {
    throw new ErroEstadoInvalido(`O membro do papel ${papel} precisa estar CONFIRMADO para receber pagamento`);
  }
  return membro;
}
