import type { OrigemDoEvento } from '../../mensageria/codecs/eventoIntegradoJson';

export interface RegistroDeNotificacao {
  readonly id: string;
  readonly evento: string;
  readonly origem: OrigemDoEvento;
  readonly projetoId: string;
  readonly titulo: string;
  readonly texto: string;
  readonly destinatarios: readonly string[];
  readonly ocorridoEm: Date;
}

export interface NotificacaoRepository {
  salvar(notificacao: RegistroDeNotificacao): Promise<void>;
}
