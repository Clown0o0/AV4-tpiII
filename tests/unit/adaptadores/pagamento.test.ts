import type { AdaptadorPagamento } from '../../../src/adaptadores/pagamento/AdaptadorPagamento';
import { AdaptadorPagSeguro } from '../../../src/adaptadores/pagamento/AdaptadorPagSeguro';
import { AdaptadorPayPal } from '../../../src/adaptadores/pagamento/AdaptadorPayPal';
import { AdaptadorStripe } from '../../../src/adaptadores/pagamento/AdaptadorStripe';
import { GatewayPagamento, SITUACAO_INEXISTENTE } from '../../../src/adaptadores/pagamento/GatewayPagamento';
import { PagSeguroSimulado } from '../../../src/adaptadores/pagamento/PagSeguroSimulado';
import { PayPalSimulado } from '../../../src/adaptadores/pagamento/PayPalSimulado';
import { StripeSimulado } from '../../../src/adaptadores/pagamento/StripeSimulado';
import { ErroNaoEncontrado } from '../../../src/domain/errors';
import { DATA_REFERENCIA } from '../../support/fixtures';

describe.each<[string, () => AdaptadorPagamento]>([
  ['AdaptadorStripe', () => new AdaptadorStripe(new StripeSimulado())],
  ['AdaptadorPagSeguro', () => new AdaptadorPagSeguro(new PagSeguroSimulado())],
  ['AdaptadorPayPal', () => new AdaptadorPayPal(new PayPalSimulado())],
])('%s cumpre o contrato de AdaptadorPagamento', (_nome, criar) => {
  let adaptador: AdaptadorPagamento;

  beforeEach(() => {
    adaptador = criar();
  });

  it('efetua, verifica e cancela uma única vez', async () => {
    const id = await adaptador.efetuarPagamento(1234.56, 'produtor-1', 'prof-1');
    expect(await adaptador.verificarPagamento(id)).toBe('APROVADO');
    expect(await adaptador.cancelarPagamento(id)).toBe(true);
    expect(await adaptador.verificarPagamento(id)).toBe('CANCELADO');
    expect(await adaptador.cancelarPagamento(id)).toBe(false);
  });

  it('pagamentos diferentes recebem ids diferentes', async () => {
    const a = await adaptador.efetuarPagamento(10, 'o', 'd');
    const b = await adaptador.efetuarPagamento(10, 'o', 'd');
    expect(a).not.toBe(b);
  });

  it('id inexistente gera ErroNaoEncontrado', async () => {
    await expect(adaptador.verificarPagamento('nao-existe')).rejects.toBeInstanceOf(ErroNaoEncontrado);
    await expect(adaptador.cancelarPagamento('nao-existe')).rejects.toBeInstanceOf(ErroNaoEncontrado);
  });
});

describe('tradução de formato feita por cada adaptador', () => {
  it('Stripe recebe o valor em centavos e status em inglês', async () => {
    const stripe = new StripeSimulado();
    const id = await new AdaptadorStripe(stripe).efetuarPagamento(1234.56, 'o', 'd');
    expect(id.startsWith('pi_')).toBe(true);
    expect(await stripe.paymentIntents.retrieve(id)).toEqual({ id, amount: 123456, currency: 'brl', status: 'succeeded' });
    await expect(stripe.paymentIntents.create({ amount: 1.5, currency: 'brl', metadata: { origem: 'o', destino: 'd' } })).rejects.toThrow(
      RangeError,
    );
  });

  it('PagSeguro recebe o valor em reais e devolve a situação em português', async () => {
    const pagSeguro = new PagSeguroSimulado();
    const id = await new AdaptadorPagSeguro(pagSeguro).efetuarPagamento(99.9, 'o', 'd');
    expect(await pagSeguro.cobranca.consultar(id)).toEqual({ codigo: id, situacao: 'PAGA', valor: { emReais: 99.9 } });
    expect(await pagSeguro.cobranca.cancelar(id)).toMatchObject({ situacao: 'CANCELADA' });
    expect(await pagSeguro.cobranca.consultar('x')).toBeNull();
  });

  it('PayPal recebe o valor como texto com duas casas em uma purchase_unit', async () => {
    const payPal = new PayPalSimulado();
    const id = await new AdaptadorPayPal(payPal).efetuarPagamento(50, 'produtor', 'prof');
    const order = await payPal.orders.get(id);
    expect(order?.status).toBe('COMPLETED');
    expect(order?.purchase_units[0]).toMatchObject({ amount: { currency_code: 'BRL', value: '50.00' }, payee: { merchant_id: 'prof' } });
    await expect(payPal.orders.create({ intent: 'CAPTURE', payer: { payer_id: 'p' }, purchase_units: [] })).rejects.toThrow(RangeError);
    expect(await payPal.orders.void('x')).toBeNull();
  });

  it('GatewayPagamento rejeita valor inválido e informa transação inexistente', async () => {
    const gateway = new GatewayPagamento('T-', () => DATA_REFERENCIA);
    await expect(gateway.processarPagamento(0, { origem: 'o', destino: 'd', moeda: 'BRL' })).rejects.toThrow(RangeError);
    const transacao = await gateway.processarPagamento(5, { origem: 'o', destino: 'd', moeda: 'BRL' });
    expect(transacao.criadaEm).toBe(DATA_REFERENCIA);
    expect(await gateway.consultarStatus(transacao.id)).toBe('APROVADA');
    expect(await gateway.estornarPagamento(transacao.id)).toBe(true);
    expect(await gateway.estornarPagamento(transacao.id)).toBe(false);
    expect(await gateway.consultarStatus(transacao.id)).toBe('ESTORNADA');
    expect(await gateway.estornarPagamento('x')).toBe(false);
    expect(await gateway.consultarStatus('x')).toBe(SITUACAO_INEXISTENTE);
  });
});
