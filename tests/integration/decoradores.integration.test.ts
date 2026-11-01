import { construirApp } from '../../src/app';
import type { DadosProjeto } from '../../src/domain/entities/Projeto';
import { CossenoStrategy } from '../../src/strategies/CossenoStrategy';
import type { NomeDecorador } from '../../src/strategies/decoradores/nomesDosDecoradores';
import { PoliticaDeDecoradores } from '../../src/strategies/decoradores/PoliticaDeDecoradores';
import { RegistroDeAuditoriaEmMemoria } from '../../src/strategies/decoradores/RegistroDeAuditoriaEmMemoria';
import { FiltragemColaborativaStrategy } from '../../src/strategies/FiltragemColaborativaStrategy';
import { OrcamentoReduzidoStrategy } from '../../src/strategies/OrcamentoReduzidoStrategy';
import type { CandidatoPontuado, ContextoEstrategia, RecomendacaoStrategy } from '../../src/strategies/RecomendacaoStrategy';
import { RegistroEstrategias } from '../../src/strategies/RegistroEstrategias';
import type { Profissional } from '../../src/domain/entities/Profissional';
import { dadosProjeto, DATA_ENTREGA, DATA_REFERENCIA, gerarProfissionais } from '../support/fixtures';
import { InMemoryProfissionalRepository } from '../support/InMemoryRepositories';
import { criarSistemaDeTeste } from '../support/sistema';

const PROFISSIONAIS = gerarProfissionais(1200);
const CUSTO_SIMULADO_MS = 50;

class EstrategiaComCustoSimulado implements RecomendacaoStrategy {
  readonly tipo = 'COSSENO' as const;
  readonly descricao = new CossenoStrategy().descricao;
  chamadas = 0;

  constructor(private readonly relogio: { agora: number }) {}

  recomendar(candidatos: readonly Profissional[], contexto: ContextoEstrategia): CandidatoPontuado[] {
    this.chamadas += 1;
    this.relogio.agora += CUSTO_SIMULADO_MS;
    return new CossenoStrategy().recomendar(candidatos, contexto);
  }
}

function montar(politica: PoliticaDeDecoradores, estrategia: RecomendacaoStrategy = new CossenoStrategy()) {
  const registroDeAuditoria = new RegistroDeAuditoriaEmMemoria();
  const sistema = criarSistemaDeTeste({
    profissionais: new InMemoryProfissionalRepository(PROFISSIONAIS),
    estrategias: new RegistroEstrategias([estrategia, new FiltragemColaborativaStrategy(), new OrcamentoReduzidoStrategy()]),
    politicaDeDecoradores: politica,
    registroDeAuditoria,
    relogio: () => DATA_REFERENCIA,
    opcoesFonte: { ttlMs: 60_000 },
  });
  return { sistema, registroDeAuditoria };
}

const PAPEIS_DO_PROJETO = 3;
const pedido = (ajustes: Partial<DadosProjeto> = {}) => dadosProjeto({ orcamentoTotal: 150000, ...ajustes });
const equipe = (recomendacao: { membrosAtivos(): ReadonlyArray<{ papel: string; profissionalId: string; score: number; custo: number }> }) =>
  recomendacao.membrosAtivos().map((m) => [m.papel, m.profissionalId, m.score, m.custo]);

describe('Decorator de cache', () => {
  it('a mesma requisição repetida não chega à estratégia e responde mais rápido (relógio injetado)', async () => {
    const relogio = { agora: 0 };
    const estrategia = new EstrategiaComCustoSimulado(relogio);
    const { sistema } = montar(new PoliticaDeDecoradores(['cache']), estrategia);
    const medir = async () => {
      const inicio = relogio.agora;
      const { recomendacao } = await sistema.recomendar(pedido());
      return { tempo: relogio.agora - inicio, recomendacao };
    };
    const primeira = await medir();
    const segunda = await medir();
    expect(estrategia.chamadas).toBe(PAPEIS_DO_PROJETO);
    expect(primeira.tempo).toBe(PAPEIS_DO_PROJETO * CUSTO_SIMULADO_MS);
    expect(segunda.tempo).toBe(0);
    expect(equipe(segunda.recomendacao)).toEqual(equipe(primeira.recomendacao));
  });

  it('com cache e sem cache a equipe recomendada é idêntica, em todas as estratégias', async () => {
    for (const estrategia of ['COSSENO', 'FILTRAGEM_COLABORATIVA', 'ORCAMENTO_REDUZIDO'] as const) {
      const comCache = await montar(new PoliticaDeDecoradores(['cache'])).sistema.recomendar(pedido({ estrategia }));
      const semCache = await montar(new PoliticaDeDecoradores([])).sistema.recomendar(pedido({ estrategia }));
      expect(equipe(comCache.recomendacao)).toEqual(equipe(semCache.recomendacao));
    }
  });

  it('mudança relevante (orçamento) não reaproveita o resultado anterior', async () => {
    const relogio = { agora: 0 };
    const estrategia = new EstrategiaComCustoSimulado(relogio);
    const { sistema } = montar(new PoliticaDeDecoradores(['cache']), estrategia);
    await sistema.recomendar(pedido());
    await sistema.recomendar(pedido({ orcamentoTotal: 90000 }));
    expect(estrategia.chamadas).toBe(2 * PAPEIS_DO_PROJETO);
  });
});

describe('Decorator de auditoria', () => {
  it('registra todas as chamadas, com campos estruturados', async () => {
    const { sistema, registroDeAuditoria } = montar(new PoliticaDeDecoradores(['auditoria']));
    const { projeto, recomendacao } = await sistema.recomendar(pedido());
    await sistema.substituirMembro(recomendacao.id, 'EDITOR');
    const entradas = registroDeAuditoria.entradas;
    expect(entradas.map((e) => e.papel)).toEqual(['DIRETOR', 'DIRETOR_FOTOGRAFIA', 'EDITOR', 'EDITOR']);
    for (const entrada of entradas) {
      expect(entrada).toMatchObject({ evento: 'recomendacao.estrategia', estrategia: 'COSSENO', projetoId: projeto.id });
      expect(entrada.candidatos).toBeGreaterThan(0);
      expect(entrada.devolvidos).toBeLessThanOrEqual(entrada.candidatos);
      expect(entrada.duracaoMs).toBeGreaterThanOrEqual(0);
    }
  });

  it.each<[readonly NomeDecorador[], number]>([
    [['cache', 'auditoria'], 2 * PAPEIS_DO_PROJETO],
    [['auditoria', 'cache'], PAPEIS_DO_PROJETO],
  ])('com a pilha %j, duas requisições iguais geram %i registros (acertos de cache só aparecem com auditoria por fora)', async (pilha, total) => {
    const { sistema, registroDeAuditoria } = montar(new PoliticaDeDecoradores(pilha));
    await sistema.recomendar(pedido());
    await sistema.recomendar(pedido());
    expect(registroDeAuditoria.entradas).toHaveLength(total);
  });
});

describe('Decorator de compressão', () => {
  it('não muda a equipe nem os scores da API', async () => {
    const comprimido = await montar(new PoliticaDeDecoradores(['compressao'])).sistema.recomendar(pedido());
    const normal = await montar(new PoliticaDeDecoradores([])).sistema.recomendar(pedido());
    expect(equipe(comprimido.recomendacao)).toEqual(equipe(normal.recomendacao));
  });
});

describe('Pilha dinâmica e política por produtor', () => {
  it('trocar a pilha padrão em tempo de execução muda o comportamento sem recriar o sistema', async () => {
    const politica = new PoliticaDeDecoradores([]);
    const { sistema, registroDeAuditoria } = montar(politica);
    await sistema.recomendar(pedido());
    expect(registroDeAuditoria.entradas).toHaveLength(0);
    politica.definirPilhaPadrao(['cache', 'auditoria', 'compressao']);
    await sistema.recomendar(pedido());
    await sistema.recomendar(pedido());
    expect(registroDeAuditoria.entradas).toHaveLength(2 * PAPEIS_DO_PROJETO);
    politica.definirPilhaPadrao([]);
    await sistema.recomendar(pedido());
    expect(registroDeAuditoria.entradas).toHaveLength(2 * PAPEIS_DO_PROJETO);
  });

  it('cada produtor recebe a sua pilha', async () => {
    const politica = new PoliticaDeDecoradores([], new Map([['produtora-auditada', ['auditoria']]]));
    const { sistema, registroDeAuditoria } = montar(politica);
    await sistema.recomendar(pedido({ produtorId: 'produtor-livre' }));
    const { projeto } = await sistema.recomendar(pedido({ produtorId: 'produtora-auditada' }));
    expect(new Set(registroDeAuditoria.entradas.map((e) => e.projetoId))).toEqual(new Set([projeto.id]));
    politica.definirPilha('produtor-livre', ['auditoria']);
    await sistema.recomendar(pedido({ produtorId: 'produtor-livre' }));
    expect(registroDeAuditoria.entradas).toHaveLength(2 * PAPEIS_DO_PROJETO);
  });
});

describe('Respostas da API com e sem decoradores', () => {
  it.each<readonly NomeDecorador[]>([[], ['cache', 'auditoria'], ['cache', 'auditoria', 'compressao'], ['compressao', 'auditoria', 'cache']])(
    'a pilha %j devolve exatamente a mesma equipe que nenhuma pilha',
    async (...pilha) => {
      const responder = async (nomes: readonly NomeDecorador[]) => {
        const app = construirApp({
          montarServico: () =>
            criarSistemaDeTeste({
              profissionais: new InMemoryProfissionalRepository(PROFISSIONAIS),
              politicaDeDecoradores: new PoliticaDeDecoradores(nomes),
              relogio: () => DATA_REFERENCIA,
            }),
        });
        const corpo = {
          titulo: 'Eco',
          produtorId: 'produtor-3',
          genero: 'Drama',
          duracaoEstimadaMin: 90,
          orcamentoTotal: 150000,
          dataEntrega: DATA_ENTREGA.toISOString(),
          tipoCaptacao: 'ANIMACAO',
          localizacao: 'Recife',
          estrategia: 'FILTRAGEM_COLABORATIVA',
          papeis: [{ papel: 'DIRETOR', peso: 2 }, { papel: 'EFEITOS_VISUAIS', peso: 2 }, { papel: 'SONOPLASTA', peso: 1 }],
        };
        const respostas = [];
        for (let i = 0; i < 2; i += 1) {
          const resposta = await app.inject({ method: 'POST', url: '/projetos/recomendar', payload: corpo });
          const { recomendacao, fonteProfissionais } = resposta.json<{ recomendacao: { equipe: unknown[]; parcial: boolean; avisos: string[]; estrategia: string; custoTotal: number }; fonteProfissionais: string }>();
          respostas.push({ status: resposta.statusCode, fonteProfissionais, ...recomendacao, equipe: recomendacao.equipe.map((m) => ({ ...(m as object), id: '' })) });
        }
        await app.close();
        return respostas.map(({ status, fonteProfissionais, equipe: membros, parcial, avisos, estrategia, custoTotal }) => ({
          status,
          fonteProfissionais,
          membros,
          parcial,
          avisos,
          estrategia,
          custoTotal,
        }));
      };
      expect(await responder(pilha)).toEqual(await responder([]));
    },
  );
});
