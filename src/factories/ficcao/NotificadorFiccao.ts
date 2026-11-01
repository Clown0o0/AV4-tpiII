import type { Observador } from '../../events/RecomendacaoEventEmitter';

export class NotificadorFiccao implements Observador {
  readonly nome = 'notificador-ficcao';

  atualizar(): void {}
}
