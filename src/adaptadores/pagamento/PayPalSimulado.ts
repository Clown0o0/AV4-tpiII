import { GatewayPagamento } from './GatewayPagamento';
import type { Transacao } from './Transacao';

export const CASAS_DECIMAIS_PAYPAL = 2;

export interface UnidadeDeCompra {
  readonly reference_id: string;
  readonly amount: { readonly currency_code: string; readonly value: string };
  readonly payee: { readonly merchant_id: string };
}

export interface PedidoPayPal {
  readonly intent: 'CAPTURE';
  readonly payer: { readonly payer_id: string };
  readonly purchase_units: readonly UnidadeDeCompra[];
}

export interface OrderPayPal {
  readonly id: string;
  readonly status: 'COMPLETED' | 'VOIDED';
  readonly purchase_units: readonly UnidadeDeCompra[];
}

export interface RecursoOrders {
  create(pedido: PedidoPayPal): Promise<OrderPayPal>;
  void(id: string): Promise<OrderPayPal | null>;
  get(id: string): Promise<OrderPayPal | null>;
}

export class PayPalSimulado {
  readonly orders: RecursoOrders;
  private readonly gateway: GatewayPagamento;

  constructor(gateway: GatewayPagamento = new GatewayPagamento('PAYID-')) {
    this.gateway = gateway;
    this.orders = {
      create: (pedido) => this.criar(pedido),
      void: (id) => this.anular(id),
      get: (id) => this.consultar(id),
    };
  }

  private async criar(pedido: PedidoPayPal): Promise<OrderPayPal> {
    const [unidade] = pedido.purchase_units;
    if (!unidade || pedido.purchase_units.length > 1) throw new RangeError('O pedido deve ter exatamente uma purchase_unit');
    const transacao = await this.gateway.processarPagamento(Number(unidade.amount.value), {
      origem: pedido.payer.payer_id,
      destino: unidade.payee.merchant_id,
      moeda: unidade.amount.currency_code,
    });
    return orderDe(transacao);
  }

  private async anular(id: string): Promise<OrderPayPal | null> {
    await this.gateway.estornarPagamento(id);
    return this.consultar(id);
  }

  private async consultar(id: string): Promise<OrderPayPal | null> {
    const transacao = await this.gateway.obterTransacao(id);
    return transacao ? orderDe(transacao) : null;
  }
}

function orderDe(transacao: Transacao): OrderPayPal {
  return {
    id: transacao.id,
    status: transacao.situacao === 'APROVADA' ? 'COMPLETED' : 'VOIDED',
    purchase_units: [
      {
        reference_id: transacao.id,
        amount: { currency_code: transacao.dados.moeda, value: transacao.valor.toFixed(CASAS_DECIMAIS_PAYPAL) },
        payee: { merchant_id: transacao.dados.destino },
      },
    ],
  };
}
