import type { LoggerEstruturado } from '../events/observadores/AuditoriaObservador';
import type { EventoIntegrado } from '../mensageria/codecs/eventoIntegradoJson';
import type { ObservadorDeEventoIntegrado } from './ObservadorDeEventoIntegrado';
import { textoDoEvento } from './textoDoEvento';

export class MensagemInternaSimuladaObservador implements ObservadorDeEventoIntegrado {
  readonly nome = 'mensagem-interna-simulada';
  private _entregues = 0;

  constructor(private readonly logger: LoggerEstruturado) {}

  get entregues(): number {
    return this._entregues;
  }

  atualizar(evento: EventoIntegrado): void {
    const texto = textoDoEvento(evento);
    for (const destinatario of [evento.produtor, ...evento.destinatarios]) {
      this._entregues += 1;
      this.logger.info(
        { canal: 'mensagem-interna', destinatarioId: destinatario.id, texto, evento: evento.nome, eventoId: evento.id },
        'mensagem interna simulada entregue',
      );
    }
  }
}
