import type { FastifyInstance } from 'fastify';
import type { SistemaRecomendacao } from '../services/SistemaRecomendacao';
import { schemaAvaliacao, schemaProfissionalIdParams } from './schemas';
import { profissionalJson } from './serializadores';

interface ParamsProfissional {
  profissionalId: string;
}

interface CorpoAvaliacao {
  produtorId: string;
  nota: number;
  comentario?: string;
}

export interface OpcoesRotasDeProfissionais {
  service: SistemaRecomendacao;
}

export async function profissionaisRoutes(app: FastifyInstance, { service }: OpcoesRotasDeProfissionais): Promise<void> {
  registrarDetalharProfissional(app, service);
  registrarAvaliarProfissional(app, service);
}

function registrarDetalharProfissional(app: FastifyInstance, service: SistemaRecomendacao): void {
  const schema = { params: schemaProfissionalIdParams };
  app.get<{ Params: ParamsProfissional }>('/profissionais/:profissionalId', { schema }, async (request) =>
    profissionalJson(await service.detalharProfissional(request.params.profissionalId)),
  );
}

function registrarAvaliarProfissional(app: FastifyInstance, service: SistemaRecomendacao): void {
  const schema = { params: schemaProfissionalIdParams, body: schemaAvaliacao };
  const url = '/profissionais/:profissionalId/avaliacoes';
  app.post<{ Params: ParamsProfissional; Body: CorpoAvaliacao }>(url, { schema }, async (request, reply) => {
    const { produtorId, nota, comentario } = request.body;
    const avaliacao = await service.avaliarProfissional(request.params.profissionalId, {
      autorId: produtorId,
      nota,
      comentario: comentario ?? null,
    });
    request.log.info({ acao: 'avaliarProfissional', ator: produtorId, profissionalId: avaliacao.profissionalId }, 'profissional avaliado');
    return reply.code(201).send(avaliacao);
  });
}
