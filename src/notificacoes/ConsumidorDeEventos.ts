import type { BarramentoDeMensagens } from '../domain/ports/BarramentoDeMensagens';
import { eventoIntegradoDeJson } from '../mensageria/codecs/eventoIntegradoJson';
import type { CentralDeNotificacoes } from './CentralDeNotificacoes';

export class ConsumidorDeEventos {
  constructor(
    private readonly barramento: BarramentoDeMensagens,
    private readonly central: CentralDeNotificacoes,
  ) {}

  async iniciar(filas: readonly string[]): Promise<void> {
    for (const fila of filas) {
      await this.barramento.consumir(fila, (conteudo) => this.central.notificar(eventoIntegradoDeJson(conteudo)));
    }
  }
}
