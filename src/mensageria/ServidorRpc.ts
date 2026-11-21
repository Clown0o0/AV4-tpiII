import type { BarramentoDeMensagens } from '../domain/ports/BarramentoDeMensagens';
import type { LoggerDeServico } from './LoggerDeServico';
import { ErroMensagemInvalida } from './ErroMensagemInvalida';
import { falha, lerPedido, sucesso, type RespostaRpc } from './protocoloRpc';

export type OperacaoRpc = (dados: unknown) => Promise<unknown>;
export type OperacoesRpc = Readonly<Record<string, OperacaoRpc>>;

export class ServidorRpc {
  constructor(
    private readonly barramento: BarramentoDeMensagens,
    private readonly fila: string,
    private readonly operacoes: OperacoesRpc,
    private readonly logger: LoggerDeServico,
  ) {}

  iniciar(): Promise<void> {
    return this.barramento.responder(this.fila, (pedido) => this.atender(pedido));
  }

  async atender(bruto: unknown): Promise<RespostaRpc> {
    try {
      const pedido = lerPedido(bruto);
      const operacao = this.operacoes[pedido.operacao];
      if (!operacao) throw new ErroMensagemInvalida(`Operação "${pedido.operacao}" não existe em ${this.fila}`);
      return sucesso(await operacao(pedido.dados));
    } catch (erro) {
      this.logger.warn({ err: erro, fila: this.fila }, 'consulta respondida com erro');
      return falha(erro);
    }
  }
}
