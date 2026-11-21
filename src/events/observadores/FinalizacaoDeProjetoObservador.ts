import type { FinalizadorDeProjetos } from '../../domain/ports/FinalizadorDeProjetos';
import { EVENTOS, type EventoRecomendacao } from '../EventTypes';
import type { Observador } from '../RecomendacaoEventEmitter';

export class FinalizacaoDeProjetoObservador implements Observador {
  readonly nome = 'finalizacao-de-projeto';

  constructor(private readonly projetos: FinalizadorDeProjetos) {}

  async atualizar(evento: EventoRecomendacao): Promise<void> {
    if (evento.nome === EVENTOS.EQUIPE_FINALIZADA) await this.projetos.finalizar(evento.payload.projetoId);
  }
}
