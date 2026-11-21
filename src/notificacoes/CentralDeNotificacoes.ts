import type { EventoIntegrado } from '../mensageria/codecs/eventoIntegradoJson';
import type { ObservadorDeEventoIntegrado } from './ObservadorDeEventoIntegrado';

export class CentralDeNotificacoes {
  private readonly observadores = new Set<ObservadorDeEventoIntegrado>();

  adicionar(observador: ObservadorDeEventoIntegrado): this {
    this.observadores.add(observador);
    return this;
  }

  remover(observador: ObservadorDeEventoIntegrado): void {
    this.observadores.delete(observador);
  }

  quantidadeObservadores(): number {
    return this.observadores.size;
  }

  async notificar(evento: EventoIntegrado): Promise<void> {
    const resultados = await Promise.allSettled([...this.observadores].map(async (observador) => observador.atualizar(evento)));
    const falha = resultados.find((resultado) => resultado.status === 'rejected');
    if (falha) throw falha.reason;
  }
}
