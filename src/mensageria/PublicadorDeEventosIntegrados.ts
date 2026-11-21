import type { BarramentoDeMensagens } from '../domain/ports/BarramentoDeMensagens';
import { eventoIntegradoParaJson, type EventoIntegrado } from './codecs/eventoIntegradoJson';

export class PublicadorDeEventosIntegrados {
  constructor(
    private readonly barramento: BarramentoDeMensagens,
    private readonly fila: string,
  ) {}

  publicar(evento: EventoIntegrado): Promise<void> {
    return this.barramento.publicar(this.fila, eventoIntegradoParaJson(evento));
  }
}
