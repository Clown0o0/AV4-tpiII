import type { FastifyInstance } from 'fastify';
import { construirApp } from '../../src/app';
import type { ArquivoComConteudoJson, ArquivoJson, ConviteJson, ProfissionalJson, RecomendacaoJson } from '../../src/routes/serializadores';
import { DATA_ENTREGA, DATA_REFERENCIA, elencoCompleto } from '../support/fixtures';
import { InMemoryProfissionalRepository } from '../support/InMemoryRepositories';
import { criarSistemaDeTeste } from '../support/sistema';

const corpoProjeto = {
  titulo: 'Maré Alta',
  produtorId: 'produtor-3',
  genero: 'Drama',
  duracaoEstimadaMin: 90,
  orcamentoTotal: 200000,
  dataEntrega: DATA_ENTREGA.toISOString(),
  tipoCaptacao: 'FICCAO',
  localizacao: 'São Paulo',
  papeis: [
    { papel: 'DIRETOR', peso: 3 },
    { papel: 'EDITOR', peso: 1 },
  ],
};

function montarApp(): FastifyInstance {
  const profissionais = new InMemoryProfissionalRepository(elencoCompleto());
  return construirApp({ montarServico: () => criarSistemaDeTeste({ profissionais, relogio: () => DATA_REFERENCIA }) });
}

async function criarProjeto(app: FastifyInstance): Promise<{ projetoId: string; recomendacao: RecomendacaoJson }> {
  const resposta = await app.inject({ method: 'POST', url: '/projetos/recomendar', payload: corpoProjeto });
  expect(resposta.statusCode).toBe(201);
  const corpo = resposta.json<{ projeto: { id: string }; recomendacao: RecomendacaoJson }>();
  return { projetoId: corpo.projeto.id, recomendacao: corpo.recomendacao };
}

describe('Rotas de arquivos de mídia (AdaptadorArmazenamento)', () => {
  let app: FastifyInstance;

  beforeEach(() => {
    app = montarApp();
  });

  afterEach(async () => {
    await app.close();
  });

  it('POST anexa, GET lista e GET por id devolve o conteúdo em base64', async () => {
    const { projetoId } = await criarProjeto(app);
    const conteudoBase64 = Buffer.from('FADE IN: praia ao amanhecer').toString('base64');
    const anexo = await app.inject({
      method: 'POST',
      url: `/projetos/${projetoId}/arquivos`,
      payload: { nome: 'roteiro.txt', categoria: 'ROTEIRO', conteudoBase64 },
    });
    expect(anexo.statusCode).toBe(201);
    const arquivo = anexo.json<ArquivoJson>();
    expect(arquivo).toMatchObject({ projetoId, nome: 'roteiro.txt', categoria: 'ROTEIRO' });

    const lista = await app.inject(`/projetos/${projetoId}/arquivos`);
    expect(lista.json()).toEqual({ arquivos: [arquivo] });

    const lido = await app.inject(`/projetos/${projetoId}/arquivos/${arquivo.arquivoId}`);
    expect(lido.statusCode).toBe(200);
    expect(lido.json<ArquivoComConteudoJson>()).toEqual({ ...arquivo, tamanhoBytes: 27, conteudoBase64 });
  });

  it('erros: projeto inexistente 404, arquivo inexistente 404, nome inválido 422 e corpo fora do schema 400', async () => {
    const { projetoId } = await criarProjeto(app);
    const valido = { nome: 'a.txt', categoria: 'ROTEIRO', conteudoBase64: 'YQ==' };
    const semProjeto = await app.inject({ method: 'POST', url: '/projetos/nao-existe/arquivos', payload: valido });
    expect(semProjeto.statusCode).toBe(404);
    expect(semProjeto.json()).toEqual({ erro: 'NAO_ENCONTRADO', mensagem: 'Projeto nao-existe não encontrado' });
    expect((await app.inject('/projetos/nao-existe/arquivos')).statusCode).toBe(404);
    expect((await app.inject(`/projetos/${projetoId}/arquivos/nao-existe`)).statusCode).toBe(404);
    const nomeComBarra = await app.inject({ method: 'POST', url: `/projetos/${projetoId}/arquivos`, payload: { ...valido, nome: '../x' } });
    expect(nomeComBarra.statusCode).toBe(422);
    expect(nomeComBarra.json<{ erro: string }>().erro).toBe('VALIDACAO');
    for (const invalido of [{ ...valido, categoria: 'TRILHA' }, { ...valido, conteudoBase64: '***' }, { nome: 'a.txt' }]) {
      const resposta = await app.inject({ method: 'POST', url: `/projetos/${projetoId}/arquivos`, payload: invalido });
      expect(resposta.statusCode).toBe(400);
    }
  });
});

describe('Rotas de pagamento (AdaptadorPagamento)', () => {
  let app: FastifyInstance;

  beforeEach(() => {
    app = montarApp();
  });

  afterEach(async () => {
    await app.close();
  });

  async function confirmarDiretor(): Promise<RecomendacaoJson> {
    const { recomendacao } = await criarProjeto(app);
    const aceite = await app.inject({ method: 'POST', url: `/recomendacoes/${recomendacao.id}/membros/DIRETOR/aceitar` });
    const convite = aceite.json<{ convite: ConviteJson }>().convite;
    await app.inject({ method: 'POST', url: `/convites/${convite.id}/responder`, payload: { aceito: true } });
    return recomendacao;
  }

  it('paga o membro confirmado, consulta e cancela', async () => {
    const recomendacao = await confirmarDiretor();
    const diretor = recomendacao.equipe.find((m) => m.papel === 'DIRETOR');
    const pagamento = await app.inject({ method: 'POST', url: `/recomendacoes/${recomendacao.id}/pagamentos`, payload: { papel: 'DIRETOR' } });
    expect(pagamento.statusCode).toBe(201);
    const corpo = pagamento.json<{ pagamentoId: string }>();
    expect(corpo).toMatchObject({ status: 'APROVADO', papel: 'DIRETOR', origem: 'produtor-3', destino: diretor?.profissionalId, valor: diretor?.custo });

    expect((await app.inject(`/pagamentos/${corpo.pagamentoId}`)).json()).toEqual({ pagamentoId: corpo.pagamentoId, status: 'APROVADO' });
    const cancelamento = await app.inject({ method: 'POST', url: `/pagamentos/${corpo.pagamentoId}/cancelamento` });
    expect(cancelamento.json()).toEqual({ pagamentoId: corpo.pagamentoId, status: 'CANCELADO' });
    const deNovo = await app.inject({ method: 'POST', url: `/pagamentos/${corpo.pagamentoId}/cancelamento` });
    expect(deNovo.statusCode).toBe(409);
    expect(deNovo.json<{ erro: string }>().erro).toBe('ESTADO_INVALIDO');
  });

  it('erros: membro não confirmado 409, recomendação e pagamento inexistentes 404, papel fora do enum 400', async () => {
    const recomendacao = await confirmarDiretor();
    const url = `/recomendacoes/${recomendacao.id}/pagamentos`;
    expect((await app.inject({ method: 'POST', url, payload: { papel: 'EDITOR' } })).statusCode).toBe(409);
    expect((await app.inject({ method: 'POST', url, payload: { papel: 'CAMERA' } })).statusCode).toBe(400);
    expect((await app.inject({ method: 'POST', url: '/recomendacoes/x/pagamentos', payload: { papel: 'DIRETOR' } })).statusCode).toBe(404);
    expect((await app.inject('/pagamentos/inexistente')).statusCode).toBe(404);
    expect((await app.inject({ method: 'POST', url: '/pagamentos/inexistente/cancelamento' })).statusCode).toBe(404);
  });
});

describe('Rotas de profissionais (AdaptadorProfissional)', () => {
  let app: FastifyInstance;

  beforeEach(() => {
    app = montarApp();
  });

  afterEach(async () => {
    await app.close();
  });

  it('GET detalha e POST registra a avaliação do produtor', async () => {
    const detalhe = await app.inject('/profissionais/EDITOR-top');
    expect(detalhe.statusCode).toBe(200);
    expect(detalhe.json<ProfissionalJson>()).toMatchObject({ id: 'EDITOR-top', especialidades: ['EDITOR'], totalAvaliacoes: 0 });
    expect(detalhe.json()).not.toHaveProperty('email');

    const avaliacao = await app.inject({
      method: 'POST',
      url: '/profissionais/EDITOR-top/avaliacoes',
      payload: { produtorId: 'produtor-3', nota: 4, comentario: 'Entregou antes do prazo' },
    });
    expect(avaliacao.statusCode).toBe(201);
    expect(avaliacao.json()).toEqual({ profissionalId: 'EDITOR-top', autorId: 'produtor-3', nota: 4, comentario: 'Entregou antes do prazo' });
    expect((await app.inject('/profissionais/EDITOR-top')).json<ProfissionalJson>()).toMatchObject({ totalAvaliacoes: 1, mediaAvaliacoes: 4 });
  });

  it('erros: profissional inexistente 404, nota fora da escala 422, corpo sem produtor 400', async () => {
    expect((await app.inject('/profissionais/ninguem')).statusCode).toBe(404);
    const avaliar = (url: string, payload: object) => app.inject({ method: 'POST', url, payload });
    expect((await avaliar('/profissionais/ninguem/avaliacoes', { produtorId: 'p', nota: 3 })).statusCode).toBe(404);
    expect((await avaliar('/profissionais/EDITOR-top/avaliacoes', { produtorId: 'p', nota: 6 })).statusCode).toBe(422);
    expect((await avaliar('/profissionais/EDITOR-top/avaliacoes', { produtorId: 'p', nota: 2.5 })).statusCode).toBe(422);
    expect((await avaliar('/profissionais/EDITOR-top/avaliacoes', { nota: 3 })).statusCode).toBe(400);
  });
});
