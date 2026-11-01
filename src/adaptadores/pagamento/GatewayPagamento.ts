import { randomUUID } from 'node:crypto';
import { Transacao, type DadosTransacao, type SituacaoTransacao } from './Transacao';

export const SITUACAO_INEXISTENTE = 'INEXISTENTE';

export class GatewayPagamento {
  private readonly transacoes = new Map<string, Transacao>();

  constructor(
    private readonly prefixoDosIds: string,
    private readonly relogio: () => Date = () => new Date(),
  ) {}

  async processarPagamento(valor: number, dados: DadosTransacao): Promise<Transacao> {
    if (!Number.isFinite(valor) || valor <= 0) throw new RangeError(`Valor de pagamento inválido: ${valor}`);
    const transacao = new Transacao(`${this.prefixoDosIds}${randomUUID()}`, valor, { ...dados }, this.relogio());
    this.transacoes.set(transacao.id, transacao);
    return transacao;
  }

  async estornarPagamento(id: string): Promise<boolean> {
    return this.transacoes.get(id)?.estornar() ?? false;
  }

  async consultarStatus(id: string): Promise<SituacaoTransacao | typeof SITUACAO_INEXISTENTE> {
    return this.transacoes.get(id)?.situacao ?? SITUACAO_INEXISTENTE;
  }

  async obterTransacao(id: string): Promise<Transacao | null> {
    return this.transacoes.get(id) ?? null;
  }
}
