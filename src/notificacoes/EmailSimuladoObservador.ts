import type { LoggerEstruturado } from '../events/observadores/AuditoriaObservador';
import type { EventoIntegrado } from '../mensageria/codecs/eventoIntegradoJson';
import type { ObservadorDeEventoIntegrado } from './ObservadorDeEventoIntegrado';
import { textoDoEvento } from './textoDoEvento';

export class EmailSimuladoObservador implements ObservadorDeEventoIntegrado {
  readonly nome = 'email-simulado';
  private _enviados = 0;

  constructor(private readonly logger: LoggerEstruturado) {}

  get enviados(): number {
    return this._enviados;
  }

  atualizar(evento: EventoIntegrado): void {
    const assunto = textoDoEvento(evento);
    for (const destinatario of [evento.produtor, ...evento.destinatarios]) {
      if (destinatario.email === null) continue;
      this._enviados += 1;
      this.logger.info({ canal: 'email', para: destinatario.email, assunto, evento: evento.nome, eventoId: evento.id }, 'e-mail simulado enviado');
    }
  }
}
