import { GatewayPagamento } from './GatewayPagamento';
import type { Transacao } from './Transacao';

export interface PedidoDeCobranca {
  readonly valor: { readonly emReais: number };
  readonly pagador: { readonly id: string };
  readonly recebedor: { readonly id: string };
}

export interface CobrancaPagSeguro {
  readonly codigo: string;
  readonly situacao: 'PAGA' | 'CANCELADA';
  readonly valor: { readonly emReais: number };
}

export interface RecursoCobranca {
  criar(pedido: PedidoDeCobranca): Promise<CobrancaPagSeguro>;
  cancelar(codigo: string): Promise<CobrancaPagSeguro | null>;
  consultar(codigo: string): Promise<CobrancaPagSeguro | null>;
}

const MOEDA_PAGSEGURO = 'BRL';

export class PagSeguroSimulado {
  readonly cobranca: RecursoCobranca;
  private readonly gateway: GatewayPagamento;

  constructor(gateway: GatewayPagamento = new GatewayPagamento('CHAR_')) {
    this.gateway = gateway;
    this.cobranca = {
      criar: (pedido) => this.criar(pedido),
      cancelar: (codigo) => this.cancelar(codigo),
      consultar: (codigo) => this.consultar(codigo),
    };
  }

  private async criar(pedido: PedidoDeCobranca): Promise<CobrancaPagSeguro> {
    const transacao = await this.gateway.processarPagamento(pedido.valor.emReais, {
      origem: pedido.pagador.id,
      destino: pedido.recebedor.id,
      moeda: MOEDA_PAGSEGURO,
    });
    return cobrancaDe(transacao);
  }

  private async cancelar(codigo: string): Promise<CobrancaPagSeguro | null> {
    await this.gateway.estornarPagamento(codigo);
    return this.consultar(codigo);
  }

  private async consultar(codigo: string): Promise<CobrancaPagSeguro | null> {
    const transacao = await this.gateway.obterTransacao(codigo);
    return transacao ? cobrancaDe(transacao) : null;
  }
}

function cobrancaDe(transacao: Transacao): CobrancaPagSeguro {
  return {
    codigo: transacao.id,
    situacao: transacao.situacao === 'APROVADA' ? 'PAGA' : 'CANCELADA',
    valor: { emReais: transacao.valor },
  };
}
