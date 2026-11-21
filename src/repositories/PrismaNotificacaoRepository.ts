import type { PrismaClient } from '../../generated/notificacoes';
import type { NotificacaoRepository, RegistroDeNotificacao } from '../domain/ports/NotificacaoRepository';

export class PrismaNotificacaoRepository implements NotificacaoRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async salvar(notificacao: RegistroDeNotificacao): Promise<void> {
    const dados = { ...notificacao, destinatarios: [...notificacao.destinatarios] };
    await this.prisma.notificacao.upsert({ where: { id: notificacao.id }, create: dados, update: {} });
  }
}
