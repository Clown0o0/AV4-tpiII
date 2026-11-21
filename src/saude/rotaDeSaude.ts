import type { FastifyInstance } from 'fastify';
import type { FonteDeSaude } from './VerificadorDeSaude';

export const STATUS_SAUDAVEL = 200;
export const STATUS_INDISPONIVEL = 503;

export function registrarRotaDeSaude(app: FastifyInstance, saude: FonteDeSaude | undefined): void {
  app.get('/health', async (_request, reply) => {
    if (!saude) return { status: 'ok' };
    const relatorio = await saude.estado();
    return reply.code(relatorio.status === 'ok' ? STATUS_SAUDAVEL : STATUS_INDISPONIVEL).send(relatorio);
  });
}
