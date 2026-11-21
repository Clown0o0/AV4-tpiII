import type { NotificacaoRepository } from '../domain/ports/NotificacaoRepository';
import type { EventoIntegrado } from '../mensageria/codecs/eventoIntegradoJson';
import type { ObservadorDeEventoIntegrado } from './ObservadorDeEventoIntegrado';
import { textoDoEvento } from './textoDoEvento';

export class AlertaPersistidoObservador implements ObservadorDeEventoIntegrado {
  readonly nome = 'alerta-persistido';

  constructor(private readonly notificacoes: NotificacaoRepository) {}

  atualizar(evento: EventoIntegrado): Promise<void> {
    return this.notificacoes.salvar({
      id: evento.id,
      evento: evento.nome,
      origem: evento.origem,
      projetoId: evento.projetoId,
      titulo: evento.titulo,
      texto: textoDoEvento(evento),
      destinatarios: [evento.produtor.id, ...evento.destinatarios.map((destinatario) => destinatario.id)],
      ocorridoEm: evento.ocorridoEm,
    });
  }
}
