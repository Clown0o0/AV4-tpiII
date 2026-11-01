import type { AdaptadorPagamento, StatusPagamento } from './AdaptadorPagamento';
import { pagamentoInexistente } from './pagamentoInexistente';
import { CENTAVOS_POR_REAL, type PaymentIntentStripe, type StripeSimulado } from './StripeSimulado';

const MOEDA_STRIPE = 'brl';

const STATUS_POR_SITUACAO_STRIPE: Readonly<Record<PaymentIntentStripe['status'], StatusPagamento>> = {
  succeeded: 'APROVADO',
  canceled: 'CANCELADO',
};

export class AdaptadorStripe implements AdaptadorPagamento {
  constructor(private readonly stripe: StripeSimulado) {}

  async efetuarPagamento(valor: number, origem: string, destino: string): Promise<string> {
    const intent = await this.stripe.paymentIntents.create({
      amount: Math.round(valor * CENTAVOS_POR_REAL),
      currency: MOEDA_STRIPE,
      metadata: { origem, destino },
    });
    return intent.id;
  }

  async cancelarPagamento(id: string): Promise<boolean> {
    if ((await this.obter(id)).status === 'canceled') return false;
    await this.stripe.paymentIntents.cancel(id);
    return true;
  }

  async verificarPagamento(id: string): Promise<StatusPagamento> {
    return STATUS_POR_SITUACAO_STRIPE[(await this.obter(id)).status];
  }

  private async obter(id: string): Promise<PaymentIntentStripe> {
    const intent = await this.stripe.paymentIntents.retrieve(id);
    if (!intent) throw pagamentoInexistente(id);
    return intent;
  }
}
