import type { BarramentoDeMensagens } from '../domain/ports/BarramentoDeMensagens';
import { abrirResposta, type PedidoRpc } from './protocoloRpc';

export class ClienteRpc {
  constructor(
    private readonly barramento: BarramentoDeMensagens,
    private readonly fila: string,
    private readonly timeoutMs: number,
  ) {}

  async chamar(operacao: string, dados: unknown): Promise<unknown> {
    const pedido: PedidoRpc = { operacao, dados };
    return abrirResposta(await this.barramento.consultar(this.fila, pedido, this.timeoutMs));
  }
}
