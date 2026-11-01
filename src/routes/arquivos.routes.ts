import type { FastifyInstance } from 'fastify';
import type { CategoriaArquivo } from '../adaptadores/armazenamento/AdaptadorArmazenamento';
import type { SistemaRecomendacao } from '../services/SistemaRecomendacao';
import { schemaArquivoParams, schemaNovoArquivo, schemaProjetoIdParams } from './schemas';
import { arquivoComConteudoJson, arquivoJson } from './serializadores';

interface ParamsProjeto {
  projetoId: string;
}

interface ParamsArquivo extends ParamsProjeto {
  arquivoId: string;
}

interface CorpoNovoArquivo {
  nome: string;
  categoria: CategoriaArquivo;
  conteudoBase64: string;
}

export interface OpcoesRotasDeArquivos {
  service: SistemaRecomendacao;
}

export async function arquivosRoutes(app: FastifyInstance, { service }: OpcoesRotasDeArquivos): Promise<void> {
  registrarAnexarArquivo(app, service);
  registrarListarArquivos(app, service);
  registrarObterArquivo(app, service);
}

function registrarAnexarArquivo(app: FastifyInstance, service: SistemaRecomendacao): void {
  const schema = { params: schemaProjetoIdParams, body: schemaNovoArquivo };
  app.post<{ Params: ParamsProjeto; Body: CorpoNovoArquivo }>('/projetos/:projetoId/arquivos', { schema }, async (request, reply) => {
    const { nome, categoria, conteudoBase64 } = request.body;
    const arquivo = await service.anexarArquivo(request.params.projetoId, {
      nome,
      categoria,
      conteudo: Buffer.from(conteudoBase64, 'base64'),
    });
    request.log.info({ acao: 'anexarArquivo', projetoId: arquivo.projetoId, arquivoId: arquivo.arquivoId }, 'arquivo anexado');
    return reply.code(201).send(arquivoJson(arquivo));
  });
}

function registrarListarArquivos(app: FastifyInstance, service: SistemaRecomendacao): void {
  const schema = { params: schemaProjetoIdParams };
  app.get<{ Params: ParamsProjeto }>('/projetos/:projetoId/arquivos', { schema }, async (request) => ({
    arquivos: (await service.listarArquivos(request.params.projetoId)).map(arquivoJson),
  }));
}

function registrarObterArquivo(app: FastifyInstance, service: SistemaRecomendacao): void {
  const schema = { params: schemaArquivoParams };
  app.get<{ Params: ParamsArquivo }>('/projetos/:projetoId/arquivos/:arquivoId', { schema }, async (request) =>
    arquivoComConteudoJson(await service.obterArquivo(request.params.projetoId, request.params.arquivoId)),
  );
}
