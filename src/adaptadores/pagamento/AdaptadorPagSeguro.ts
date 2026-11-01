import type { AdaptadorPagamento, StatusPagamento } from './AdaptadorPagamento';
import type { CobrancaPagSeguro, PagSeguroSimulado } from './PagSeguroSimulado';
import { pagamentoInexistente } from './pagamentoInexistente';

const STATUS_POR_SITUACAO_PAGSEGURO: Readonly<Record<CobrancaPagSeguro['situacao'], StatusPagamento>> = {
  PAGA: 'APROVADO',
  CANCELADA: 'CANCELADO',
};

export class AdaptadorPagSeguro implements AdaptadorPagamento {
  constructor(private readonly pagSeguro: PagSeguroSimulado) {}

  async efetuarPagamento(valor: number, origem: string, destino: string): Promise<string> {
    const cobranca = await this.pagSeguro.cobranca.criar({
      valor: { emReais: valor },
      pagador: { id: origem },
      recebedor: { id: destino },
    });
    return cobranca.codigo;
  }

  async cancelarPagamento(id: string): Promise<boolean> {
    if ((await this.obter(id)).situacao === 'CANCELADA') return false;
    await this.pagSeguro.cobranca.cancelar(id);
    return true;
  }

  async verificarPagamento(id: string): Promise<StatusPagamento> {
    return STATUS_POR_SITUACAO_PAGSEGURO[(await this.obter(id)).situacao];
  }

  private async obter(codigo: string): Promise<CobrancaPagSeguro> {
    const cobranca = await this.pagSeguro.cobranca.consultar(codigo);
    if (!cobranca) throw pagamentoInexistente(codigo);
    return cobranca;
  }
}
