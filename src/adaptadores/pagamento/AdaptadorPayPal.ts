import type { AdaptadorPagamento, StatusPagamento } from './AdaptadorPagamento';
import { pagamentoInexistente } from './pagamentoInexistente';
import { CASAS_DECIMAIS_PAYPAL, type OrderPayPal, type PayPalSimulado } from './PayPalSimulado';

const MOEDA_PAYPAL = 'BRL';

const STATUS_POR_SITUACAO_PAYPAL: Readonly<Record<OrderPayPal['status'], StatusPagamento>> = {
  COMPLETED: 'APROVADO',
  VOIDED: 'CANCELADO',
};

export class AdaptadorPayPal implements AdaptadorPagamento {
  constructor(private readonly payPal: PayPalSimulado) {}

  async efetuarPagamento(valor: number, origem: string, destino: string): Promise<string> {
    const order = await this.payPal.orders.create({
      intent: 'CAPTURE',
      payer: { payer_id: origem },
      purchase_units: [
        {
          reference_id: `${origem}:${destino}`,
          amount: { currency_code: MOEDA_PAYPAL, value: valor.toFixed(CASAS_DECIMAIS_PAYPAL) },
          payee: { merchant_id: destino },
        },
      ],
    });
    return order.id;
  }

  async cancelarPagamento(id: string): Promise<boolean> {
    if ((await this.obter(id)).status === 'VOIDED') return false;
    await this.payPal.orders.void(id);
    return true;
  }

  async verificarPagamento(id: string): Promise<StatusPagamento> {
    return STATUS_POR_SITUACAO_PAYPAL[(await this.obter(id)).status];
  }

  private async obter(id: string): Promise<OrderPayPal> {
    const order = await this.payPal.orders.get(id);
    if (!order) throw pagamentoInexistente(id);
    return order;
  }
}
