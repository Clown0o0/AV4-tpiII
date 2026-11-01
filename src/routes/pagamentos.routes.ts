import type { FastifyInstance } from 'fastify';
import type { PapelTecnico } from '../domain/entities/Projeto';
import type { SistemaRecomendacao } from '../services/SistemaRecomendacao';
import { schemaPagamentoDoMembro, schemaPagamentoIdParams, schemaRecomendacaoIdParams } from './schemas';

interface ParamsRecomendacao {
  recomendacaoId: string;
}

interface ParamsPagamento {
  pagamentoId: string;
}

export interface OpcoesRotasDePagamentos {
  service: SistemaRecomendacao;
}

export async function pagamentosRoutes(app: FastifyInstance, { service }: OpcoesRotasDePagamentos): Promise<void> {
  registrarPagarMembro(app, service);
  registrarConsultarPagamento(app, service);
  registrarCancelarPagamento(app, service);
}

function registrarPagarMembro(app: FastifyInstance, service: SistemaRecomendacao): void {
  const schema = { params: schemaRecomendacaoIdParams, body: schemaPagamentoDoMembro };
  const url = '/recomendacoes/:recomendacaoId/pagamentos';
  app.post<{ Params: ParamsRecomendacao; Body: { papel: PapelTecnico } }>(url, { schema }, async (request, reply) => {
    const pagamento = await service.pagarMembro(request.params.recomendacaoId, request.body.papel);
    request.log.info(
      { acao: 'pagarMembro', ator: pagamento.origem, recomendacaoId: pagamento.recomendacaoId, pagamentoId: pagamento.pagamentoId },
      'pagamento efetuado',
    );
    return reply.code(201).send(pagamento);
  });
}

function registrarConsultarPagamento(app: FastifyInstance, service: SistemaRecomendacao): void {
  const schema = { params: schemaPagamentoIdParams };
  app.get<{ Params: ParamsPagamento }>('/pagamentos/:pagamentoId', { schema }, async (request) =>
    service.consultarPagamento(request.params.pagamentoId),
  );
}

function registrarCancelarPagamento(app: FastifyInstance, service: SistemaRecomendacao): void {
  const schema = { params: schemaPagamentoIdParams };
  app.post<{ Params: ParamsPagamento }>('/pagamentos/:pagamentoId/cancelamento', { schema }, async (request) => {
    const situacao = await service.cancelarPagamento(request.params.pagamentoId);
    request.log.info({ acao: 'cancelarPagamento', pagamentoId: situacao.pagamentoId }, 'pagamento cancelado');
    return situacao;
  });
}
