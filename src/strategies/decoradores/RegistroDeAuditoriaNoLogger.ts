import type { LoggerEstruturado } from '../../events/observadores/AuditoriaObservador';
import type { EntradaDeAuditoria, RegistroDeAuditoria } from './RegistroDeAuditoria';

export const MENSAGEM_AUDITORIA_RECOMENDACAO = 'recomendação auditada';

export class RegistroDeAuditoriaNoLogger implements RegistroDeAuditoria {
  constructor(private readonly logger: LoggerEstruturado) {}

  registrar(entrada: EntradaDeAuditoria): void {
    this.logger.info({ ...entrada }, MENSAGEM_AUDITORIA_RECOMENDACAO);
  }
}
