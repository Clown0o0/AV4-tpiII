import type { EventoIntegrado } from '../mensageria/codecs/eventoIntegradoJson';

export interface ObservadorDeEventoIntegrado {
  readonly nome: string;
  atualizar(evento: EventoIntegrado): void | Promise<void>;
}
