import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest, type FastifyServerOptions } from 'fastify';
import { registrarRotaDeSaude } from './rotaDeSaude';
import type { FonteDeSaude } from './VerificadorDeSaude';

export function construirAppDeSaude(saude: FonteDeSaude, logger: FastifyServerOptions['logger'] = false): FastifyInstance {
  const app = Fastify({ logger });
  registrarRotaDeSaude(app, saude);
  app.setNotFoundHandler((request: FastifyRequest, reply: FastifyReply) =>
    reply.code(404).send({ erro: 'NAO_ENCONTRADO', mensagem: `Rota ${request.method} ${request.url} não existe` }),
  );
  return app;
}
