import type { FastifyInstance } from 'fastify';
import { construirApp } from '../../src/app';
import { EVENTOS } from '../../src/events/EventTypes';
import { ClienteRpc } from '../../src/mensageria/ClienteRpc';
import { EVENTOS_DE_PROJETO } from '../../src/mensageria/codecs/eventoIntegradoJson';
import { profissionaisDeJson, profissionalDeJson } from '../../src/mensageria/codecs/profissionalJson';
import { ErroRemoto } from '../../src/mensageria/ErroRemoto';
import { FILAS, OPERACOES_PROFISSIONAIS } from '../../src/mensageria/filas';
import type { ConviteJson, RecomendacaoJson } from '../../src/routes/serializadores';
import { DATA_ENTREGA, DATA_REFERENCIA, elencoCompleto } from '../support/fixtures';
import { InMemoryProfissionalRepository, InMemoryProjetoRepository } from '../support/InMemoryRepositories';
import { montarMalha, type Malha } from '../support/servicosEmMemoria';
import { criarSistemaDeTeste } from '../support/sistema';

const corpoProjeto = {
  titulo: 'Sertão em Chamas',
  produtorId: 'produtor-7',
  produtorEmail: 'produtora@filmes.dev',
  genero: 'Drama',
  duracaoEstimadaMin: 95,
  orcamentoTotal: 180000,
  dataEntrega: DATA_ENTREGA.toISOString(),
  tipoCaptacao: 'FICCAO',
  localizacao: 'São Paulo',
  estrategia: 'COSSENO',
  papeis: [
    { papel: 'DIRETOR', peso: 3 },
    { papel: 'DIRETOR_FOTOGRAFIA', peso: 2, competenciasDesejadas: { fotografia: 1, iluminacao: 1 } },
    { papel: 'SONOPLASTA', peso: 1 },
  ],
};

interface RespostaRecomendacao {
  projeto: { id: string };
  recomendacao: RecomendacaoJson;
  fonteProfissionais: string;
}

async function recomendar(app: FastifyInstance, corpo: object = corpoProjeto): Promise<RespostaRecomendacao> {
  const resposta = await app.inject({ method: 'POST', url: '/projetos/recomendar', payload: corpo });
  expect(resposta.statusCode).toBe(201);
  return resposta.json<RespostaRecomendacao>();
}

function resumoDaEquipe(recomendacao: RecomendacaoJson): unknown {
  return { equipe: recomendacao.equipe.map(({ id: _id, ...membro }) => membro), parcial: recomendacao.parcial, avisos: recomendacao.avisos, custoTotal: recomendacao.custoTotal };
}

describe('Microsserviços conversando pelo barramento (em memória)', () => {
  let malha: Malha;

  afterEach(async () => {
    await malha.encerrar();
  });

  it('RPC consulta-profissionais ponta a ponta: listar, buscar por ids, detalhar e avaliar', async () => {
    malha = montarMalha();
    await malha.iniciar(malha.profissionais);
    const cliente = new ClienteRpc(malha.barramento, FILAS.CONSULTA_PROFISSIONAIS, 500);

    const todos = profissionaisDeJson(await cliente.chamar(OPERACOES_PROFISSIONAIS.LISTAR, {}));
    expect(todos.map((p) => p.id).sort()).toEqual(elencoCompleto().map((p) => p.id).sort());
    const alguns = profissionaisDeJson(await cliente.chamar(OPERACOES_PROFISSIONAIS.LISTAR, { ids: ['DIRETOR-top'] }));
    expect(alguns.map((p) => p.id)).toEqual(['DIRETOR-top']);

    const detalhado = profissionalDeJson(await cliente.chamar(OPERACOES_PROFISSIONAIS.DETALHAR, { id: 'DIRETOR-top' }));
    expect(detalhado.vetorCompetencias()).toEqual((await malha.cadastroDeProfissionais.buscarPorId('DIRETOR-top'))?.vetorCompetencias());

    await cliente.chamar(OPERACOES_PROFISSIONAIS.AVALIAR, { id: 'DIRETOR-top', avaliacao: { autorId: 'produtor-7', nota: 5, comentario: null } });
    expect((await malha.cadastroDeProfissionais.buscarPorId('DIRETOR-top'))?.avaliacoes.at(-1)?.nota).toBe(5);

    await expect(cliente.chamar(OPERACOES_PROFISSIONAIS.DETALHAR, { id: 'inexistente' })).rejects.toMatchObject({ codigo: 'NAO_ENCONTRADO', codigoHttp: 404 });
    await expect(cliente.chamar('apagar-tudo', {})).rejects.toBeInstanceOf(ErroRemoto);
  });

  it('a API usando projetos e profissionais por mensagens produz a MESMA recomendação do modo em processo', async () => {
    malha = montarMalha();
    await malha.iniciar();
    const emProcesso = construirApp({
      montarServico: () =>
        criarSistemaDeTeste({
          profissionais: new InMemoryProfissionalRepository(elencoCompleto()),
          projetos: new InMemoryProjetoRepository(),
          relogio: () => DATA_REFERENCIA,
          opcoesFonte: { timeoutMs: 500, ttlMs: 0 },
        }),
    });
    for (const corpo of [corpoProjeto, { ...corpoProjeto, estrategia: 'ORCAMENTO_REDUZIDO', orcamentoTotal: 60000 }]) {
      const porMensagens = await recomendar(malha.api.app, corpo);
      const local = await recomendar(emProcesso, corpo);
      expect(porMensagens.fonteProfissionais).toBe('REPOSITORIO');
      expect(resumoDaEquipe(porMensagens.recomendacao)).toEqual(resumoDaEquipe(local.recomendacao));
      expect(malha.cadastroDeProjetos.projetos.has(porMensagens.projeto.id)).toBe(true);
    }
    await emProcesso.close();
  });

  it('fluxo completo pela API: projeto salvo no serviço de projetos, eventos viram notificações persistidas via Observer', async () => {
    malha = montarMalha();
    await malha.iniciar();
    const { app } = malha.api;
    const { projeto, recomendacao } = await recomendar(app);
    const convites: ConviteJson[] = [];
    for (const papel of ['DIRETOR', 'DIRETOR_FOTOGRAFIA', 'SONOPLASTA']) {
      const aceito = await app.inject({ method: 'POST', url: `/recomendacoes/${recomendacao.id}/membros/${papel}/aceitar` });
      expect(aceito.statusCode).toBe(201);
      convites.push(aceito.json().convite);
    }
    let finalizada = false;
    for (const convite of convites) {
      const resposta = await app.inject({ method: 'POST', url: `/convites/${convite.id}/responder`, payload: { aceito: true } });
      expect(resposta.statusCode).toBe(200);
      finalizada = resposta.json().equipeFinalizada;
    }
    expect(finalizada).toBe(true);
    expect((await app.inject(`/recomendacoes/${recomendacao.id}/relatorio`)).statusCode).toBe(200);
    await malha.sincronizar();

    expect(malha.cadastroDeProjetos.finalizados.get(projeto.id)).toBeInstanceOf(Date);
    const eventos = malha.notificacoes.eventos();
    expect(eventos).toEqual(
      expect.arrayContaining([
        EVENTOS_DE_PROJETO.CRIADO,
        EVENTOS_DE_PROJETO.FINALIZADO,
        EVENTOS.RECOMENDACAO_GERADA,
        EVENTOS.INTERESSE_PRODUTOR,
        EVENTOS.CONVITE_ACEITO,
        EVENTOS.EQUIPE_FINALIZADA,
      ]),
    );
    const finalizacao = [...malha.notificacoes.registros.values()].find((registro) => registro.evento === EVENTOS_DE_PROJETO.FINALIZADO);
    expect(finalizacao).toMatchObject({ origem: 'PROJETOS', projetoId: projeto.id, titulo: 'Sertão em Chamas', destinatarios: ['produtor-7'] });
    expect(malha.barramento.rejeitadas).toEqual([]);
  });

  it('timeout do RPC de profissionais: a API cai no fallback (cache ou resposta parcial) em vez de responder 500', async () => {
    malha = montarMalha();
    await malha.iniciar();
    expect((await recomendar(malha.api.app)).fonteProfissionais).toBe('REPOSITORIO');

    malha.barramento.pararDeResponder(FILAS.CONSULTA_PROFISSIONAIS);
    const doCache = await recomendar(malha.api.app);
    expect(doCache.fonteProfissionais).toBe('CACHE');
    expect(doCache.recomendacao.equipe).toHaveLength(3);
  });

  it('sem o serviço de profissionais desde a subida: recomendação parcial com fonte INDISPONIVEL, nunca 500', async () => {
    malha = montarMalha();
    await malha.iniciar(malha.projetos, malha.notificador, malha.api);
    const resposta = await recomendar(malha.api.app);
    expect(resposta.fonteProfissionais).toBe('INDISPONIVEL');
    expect(resposta.recomendacao.parcial).toBe(true);
    expect((await malha.api.app.inject('/profissionais/DIRETOR-top')).statusCode).toBe(503);
  });

  it('sem o serviço de projetos: a API responde 503 SERVICO_INDISPONIVEL, não 500', async () => {
    malha = montarMalha();
    await malha.iniciar(malha.profissionais, malha.api);
    const resposta = await malha.api.app.inject({ method: 'POST', url: '/projetos/recomendar', payload: corpoProjeto });
    expect(resposta.statusCode).toBe(503);
    expect(resposta.json()).toMatchObject({ erro: 'SERVICO_INDISPONIVEL' });
  });

  it('GET /health de cada serviço: 200 com banco e RabbitMQ ok; 503 quando um deles cai', async () => {
    malha = montarMalha();
    await malha.iniciar();
    const servicos = [malha.api, malha.profissionais, malha.projetos, malha.notificador];
    for (const servico of servicos) {
      const resposta = await servico.app.inject('/health');
      expect([servico.nome, resposta.statusCode, resposta.json()]).toEqual([servico.nome, 200, { status: 'ok', banco: 'ok', mensageria: 'ok' }]);
    }
    malha.bancos.projetos.disponivel = false;
    expect((await malha.projetos.app.inject('/health')).json()).toEqual({ status: 'indisponivel', banco: 'falha', mensageria: 'ok' });
    expect((await malha.projetos.app.inject('/health')).statusCode).toBe(503);
    malha.barramento.derrubar();
    for (const servico of servicos) {
      const resposta = await servico.app.inject('/health');
      expect([servico.nome, resposta.statusCode, resposta.json().mensageria]).toEqual([servico.nome, 503, 'falha']);
    }
    expect((await malha.notificador.app.inject('/nao-existe')).statusCode).toBe(404);
    malha.barramento.restaurar();
  });

  it('encerramento limpo: fecha os apps, o barramento e desconecta os bancos', async () => {
    malha = montarMalha();
    await malha.iniciar();
    await malha.encerrar();
    expect(Object.values(malha.bancos).every((banco) => banco.desconectado && banco.conexoes === 1)).toBe(true);
    expect(await malha.barramento.verificar()).toBe(false);
    malha = montarMalha();
  });
});
