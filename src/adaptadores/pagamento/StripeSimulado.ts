import { GatewayPagamento } from './GatewayPagamento';
import type { Transacao } from './Transacao';

export const CENTAVOS_POR_REAL = 100;

export interface ParametrosPaymentIntent {
  readonly amount: number;
  readonly currency: string;
  readonly metadata: { readonly origem: string; readonly destino: string };
}

export interface PaymentIntentStripe {
  readonly id: string;
  readonly amount: number;
  readonly currency: string;
  readonly status: 'succeeded' | 'canceled';
}

export interface RecursoPaymentIntents {
  create(parametros: ParametrosPaymentIntent): Promise<PaymentIntentStripe>;
  cancel(id: string): Promise<PaymentIntentStripe | null>;
  retrieve(id: string): Promise<PaymentIntentStripe | null>;
}

export class StripeSimulado {
  readonly paymentIntents: RecursoPaymentIntents;
  private readonly gateway: GatewayPagamento;

  constructor(gateway: GatewayPagamento = new GatewayPagamento('pi_')) {
    this.gateway = gateway;
    this.paymentIntents = {
      create: (parametros) => this.criar(parametros),
      cancel: (id) => this.cancelar(id),
      retrieve: (id) => this.consultar(id),
    };
  }

  private async criar(parametros: ParametrosPaymentIntent): Promise<PaymentIntentStripe> {
    if (!Number.isInteger(parametros.amount)) throw new RangeError('amount deve ser um inteiro em centavos');
    const { origem, destino } = parametros.metadata;
    const transacao = await this.gateway.processarPagamento(parametros.amount / CENTAVOS_POR_REAL, {
      origem,
      destino,
      moeda: parametros.currency,
    });
    return paymentIntentDe(transacao);
  }

  private async cancelar(id: string): Promise<PaymentIntentStripe | null> {
    await this.gateway.estornarPagamento(id);
    return this.consultar(id);
  }

  private async consultar(id: string): Promise<PaymentIntentStripe | null> {
    const transacao = await this.gateway.obterTransacao(id);
    return transacao ? paymentIntentDe(transacao) : null;
  }
}

function paymentIntentDe(transacao: Transacao): PaymentIntentStripe {
  return {
    id: transacao.id,
    amount: Math.round(transacao.valor * CENTAVOS_POR_REAL),
    currency: transacao.dados.moeda,
    status: transacao.situacao === 'APROVADA' ? 'succeeded' : 'canceled',
  };
}
