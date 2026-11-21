import { randomUUID } from 'node:crypto';
import type { BarramentoDeMensagens } from '../../domain/ports/BarramentoDeMensagens';
import { eventoDeRecomendacaoIntegrado } from '../../mensageria/codecs/eventoDeRecomendacaoIntegrado';
import { eventoIntegradoParaJson } from '../../mensageria/codecs/eventoIntegradoJson';
import type { EventoRecomendacao } from '../EventTypes';
import type { Observador } from '../RecomendacaoEventEmitter';

export class PublicadorEmFilaObservador implements Observador {
  readonly nome = 'publicador-em-fila';

  constructor(
    private readonly barramento: BarramentoDeMensagens,
    private readonly fila: string,
    private readonly gerarId: () => string = randomUUID,
  ) {}

  atualizar(evento: EventoRecomendacao): Promise<void> {
    return this.barramento.publicar(this.fila, eventoIntegradoParaJson(eventoDeRecomendacaoIntegrado(evento, this.gerarId())));
  }
}
