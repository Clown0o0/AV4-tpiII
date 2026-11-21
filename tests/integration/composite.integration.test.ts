import type { PrismaClient } from '../../generated/projetos';
import type { FastifyInstance } from 'fastify';
import { construirApp } from '../../src/app';
import { ProjetoAnimacao } from '../../src/domain/entities/ProjetoAnimacao';
import { Projeto, type PapelTecnico } from '../../src/domain/entities/Projeto';
import { ErroValidacao } from '../../src/domain/errors';
import { RegistroFabricas } from '../../src/factories/RegistroFabricas';
import { RegistroPrototipos } from '../../src/prototypes/RegistroPrototipos';
import { PrismaProjetoRepository } from '../../src/repositories/PrismaProjetoRepository';
import type { ProjetoJson } from '../../src/routes/serializadores';
import { PacoteServico } from '../../src/servicos-projeto/PacoteServico';
import { ServicoAtomico } from '../../src/servicos-projeto/ServicoAtomico';
import { servicoParaJson } from '../../src/servicos-projeto/ServicoJson';
import type { ServicoProjeto } from '../../src/servicos-projeto/ServicoProjeto';
import type { Relatorio } from '../../src/visitors/RelatorioVisitor';
import { dadosProjeto, DATA_ENTREGA, DATA_REFERENCIA, elencoCompleto } from '../support/fixtures';
import { InMemoryProfissionalRepository } from '../support/InMemoryRepositories';
import { criarSistemaDeTeste } from '../support/sistema';

function atomico(papel: PapelTecnico, custo: number, prazoDias: number, peso = 1): ServicoAtomico {
  return new ServicoAtomico({ nome: `Serviço de ${papel.toLowerCase()}`, papel, custo, prazoDias, peso });
}

function projetoCom(servicoPrincipal: ServicoProjeto): Projeto {
  const { papeis: _papeis, ...dados } = dadosProjeto();
  return new Projeto({ ...dados, servicoPrincipal });
}

const ESTRUTURAS: Array<[string, () => ServicoProjeto, number, number, PapelTecnico[]]> = [
  ['só um serviço atômico', () => atomico('DIRETOR', 20000, 30), 20000, 30, ['DIRETOR']],
  ['pacote simples', () => new PacoteServico('Pós', [atomico('EDITOR', 4500, 5), atomico('SONOPLASTA', 3000, 3)]), 7500, 8, ['EDITOR', 'SONOPLASTA']],
  [
    'pacote de pacotes',
    () => new PacoteServico('Filme', [new PacoteServico('Pré', [atomico('ROTEIRISTA', 8000, 10)]), new PacoteServico('Pós', [atomico('EDITOR', 4500, 5)])]),
    12500,
    15,
    ['ROTEIRISTA', 'EDITOR'],
  ],
  [
    'três níveis ou mais',
    () =>
      new PacoteServico('Longa', [
        atomico('DIRETOR', 20000, 30, 3),
        new PacoteServico('Pós-produção', [atomico('EDITOR', 4500, 5), new PacoteServico('Som', [new PacoteServico('Mixagem', [atomico('SONOPLASTA', 3000, 3)])])]),
      ]),
    27500,
    38,
    ['DIRETOR', 'EDITOR', 'SONOPLASTA'],
  ],
  [
    'árvore larga',
    () =>
      new PacoteServico(
        'Todos os papéis',
        (['DIRETOR', 'DIRETOR_FOTOGRAFIA', 'SONOPLASTA', 'EDITOR', 'ROTEIRISTA', 'EFEITOS_VISUAIS'] as const).map((papel, i) =>
          new PacoteServico(`Frente ${i + 1}`, [atomico(papel, 1000 * (i + 1), i + 1)]),
        ),
      ),
    21000,
    21,
    ['DIRETOR', 'DIRETOR_FOTOGRAFIA', 'SONOPLASTA', 'EDITOR', 'ROTEIRISTA', 'EFEITOS_VISUAIS'],
  ],
];

describe('Composite: custo e prazo de estruturas de profundidades diferentes', () => {
  it.each(ESTRUTURAS)('%s', (_nome, criar, custo, prazo, papeis) => {
    const projeto = projetoCom(criar());
    expect(projeto.calcularCustoTotal()).toBe(custo);
    expect(projeto.calcularPrazoTotalDias()).toBe(prazo);
    expect(projeto.calcularCustoTotal()).toBe(projeto.servicoPrincipal.calcularCusto());
    expect(projeto.papeis.map((p) => p.papel)).toEqual(papeis);
  });

  it('papeis é derivado das folhas, com peso e perfil de cada serviço atômico', () => {
    const projeto = projetoCom(
      new PacoteServico('P', [
        new ServicoAtomico({ nome: 'Direção', papel: 'DIRETOR', custo: 1, prazoDias: 1, peso: 3, competenciasDesejadas: { direcao: 1 } }),
        atomico('EDITOR', 1, 1),
      ]),
    );
    expect(projeto.papeis).toEqual([
      { papel: 'DIRETOR', peso: 3, competenciasDesejadas: { direcao: 1 } },
      { papel: 'EDITOR', peso: 1 },
    ]);
    expect(projeto.perfilDesejado('DIRETOR')).toEqual({ direcao: 1 });
  });
});

describe('Composite: validação recursiva na criação do projeto', () => {
  it.each<[string, () => ServicoProjeto, RegExp]>([
    ['pacote vazio', () => new PacoteServico('Vazio', []), /deve conter ao menos um serviço/],
    ['papel repetido', () => new PacoteServico('A', [atomico('EDITOR', 1, 1), new PacoteServico('B', [atomico('EDITOR', 1, 1)])]), /Papel EDITOR informado mais de uma vez/],
    ['papel inválido', () => new PacoteServico('A', [atomico('CAMERA' as PapelTecnico, 1, 1)]), /Papel técnico inválido/],
    ['prazo inválido', () => new PacoteServico('A', [new PacoteServico('B', [atomico('EDITOR', 1, 0)])]), /Prazo do serviço/],
    ['custo inválido', () => new PacoteServico('A', [atomico('EDITOR', Number.NaN, 1)]), /Custo do serviço/],
  ])('%s gera ErroValidacao', (_caso, criar, mensagem) => {
    expect(() => projetoCom(criar())).toThrow(ErroValidacao);
    expect(() => projetoCom(criar())).toThrow(mensagem);
  });

  it('duplicata da mesma instância gera ErroValidacao', () => {
    const repetido = atomico('EDITOR', 1, 1);
    expect(() => projetoCom(new PacoteServico('A', [repetido, repetido]))).toThrow(/mesmo serviço/);
  });

  it('ciclo vindo de uma implementação própria de ServicoProjeto é recusado antes de copiar a árvore', () => {
    const ciclico: ServicoProjeto = {
      calcularCusto: () => 0,
      obterPrazo: () => 1,
      validar: () => undefined,
      listarSubservicos: () => [ciclico],
      aceitar: (visitante) => visitante.visitarPacoteServico(new PacoteServico('Ciclo', [ciclico])),
    };
    expect(() => projetoCom(ciclico)).toThrow(/mesmo serviço/);
  });

  it('papeis e servicoPrincipal juntos é ambíguo', () => {
    expect(() => new Projeto({ ...dadosProjeto(), servicoPrincipal: atomico('EDITOR', 1, 1) })).toThrow('Informe papeis ou servicoPrincipal, não os dois');
  });
});

describe('Composite: Prototype e persistência', () => {
  const arvore = () => new PacoteServico('Filme', [atomico('DIRETOR', 20000, 30), new PacoteServico('Pós', [atomico('EDITOR', 4500, 5)])]);
  const nos = (servico: ServicoProjeto): ServicoProjeto[] => [servico, ...servico.listarSubservicos().flatMap(nos)];

  it('o projeto não guarda os nós recebidos e o clone não compartilha nenhum nó com o original', () => {
    const recebida = arvore();
    const original = projetoCom(recebida);
    const clone = original.clonar({ titulo: 'Cópia' });
    const nosDoOriginal = new Set([...nos(original.servicoPrincipal), ...nos(recebida)]);
    expect(nos(original.servicoPrincipal).some((no) => nos(recebida).includes(no))).toBe(false);
    expect(nos(clone.servicoPrincipal).some((no) => nosDoOriginal.has(no))).toBe(false);
    expect(servicoParaJson(clone.servicoPrincipal)).toEqual(servicoParaJson(original.servicoPrincipal));
  });

  it('o clone pode trocar a estrutura por papeis ou por outra árvore', () => {
    const original = projetoCom(arvore());
    expect(original.clonar({ papeis: [{ papel: 'EDITOR', peso: 1 }] }).papeis).toEqual([{ papel: 'EDITOR', peso: 1 }]);
    expect(original.clonar({ servicoPrincipal: atomico('ROTEIRISTA', 9, 9) }).calcularCustoTotal()).toBe(9);
  });

  it('subtipo clonado (animação) mantém a árvore e os atributos do tipo', () => {
    const { papeis: _papeis, ...dados } = dadosProjeto({ tipoCaptacao: 'ANIMACAO', detalhes: { tecnica: '3D' } });
    const animacao = new ProjetoAnimacao({ ...dados, servicoPrincipal: arvore() });
    const clone = animacao.clonar();
    expect(clone.tecnica).toBe('3D');
    expect(clone.calcularPrazoTotalDias()).toBe(35);
  });

  it('modelo do registro de protótipos aceita a árvore como ajuste', () => {
    const projeto = RegistroPrototipos.padrao().criarAPartirDe('ficcao', { servicoPrincipal: arvore() });
    expect(projeto.papeis.map((p) => p.papel)).toEqual(['DIRETOR', 'EDITOR']);
  });

  it('a árvore sobrevive a salvar e carregar no repositório (Prisma com mock) e ProjetoPapel continua derivada', async () => {
    const mock = {
      projeto: { upsert: jest.fn(), findUnique: jest.fn() },
      projetoPapel: { deleteMany: jest.fn(), createMany: jest.fn() },
      $transaction: jest.fn(),
    };
    mock.$transaction.mockImplementation((fn: (tx: typeof mock) => Promise<unknown>) => fn(mock));
    const repo = new PrismaProjetoRepository(mock as unknown as PrismaClient, RegistroFabricas.padrao());
    const projeto = projetoCom(arvore());
    await repo.salvar(projeto);
    const gravado = mock.projeto.upsert.mock.calls[0][0].create;
    expect(gravado.servicoPrincipal).toEqual(servicoParaJson(projeto.servicoPrincipal));
    expect(mock.projetoPapel.createMany.mock.calls[0][0].data.map((p: { papel: string }) => p.papel)).toEqual(['DIRETOR', 'EDITOR']);

    mock.projeto.findUnique.mockResolvedValueOnce({ ...JSON.parse(JSON.stringify(gravado)), dataEntrega: DATA_ENTREGA, criadoEm: DATA_REFERENCIA, papeis: [] });
    const lido = await repo.buscarPorId(projeto.id);
    expect(servicoParaJson(lido?.servicoPrincipal ?? atomico('EDITOR', 0, 1))).toEqual(servicoParaJson(projeto.servicoPrincipal));
    expect(lido?.calcularCustoTotal()).toBe(24500);
  });
});

describe('Composite pela API e no relatório', () => {
  let app: FastifyInstance;

  beforeEach(() => {
    const profissionais = new InMemoryProfissionalRepository(elencoCompleto());
    app = construirApp({ montarServico: () => criarSistemaDeTeste({ profissionais, relogio: () => DATA_REFERENCIA }) });
  });

  afterEach(async () => {
    await app.close();
  });

  const corpo = {
    titulo: 'Travessia',
    produtorId: 'produtor-5',
    genero: 'Aventura',
    duracaoEstimadaMin: 110,
    orcamentoTotal: 200000,
    dataEntrega: DATA_ENTREGA.toISOString(),
    tipoCaptacao: 'FICCAO',
    localizacao: 'São Paulo',
    servicoPrincipal: {
      tipo: 'PACOTE',
      nome: 'Longa-metragem',
      servicos: [
        { tipo: 'ATOMICO', nome: 'Direção', papel: 'DIRETOR', custo: 20000, prazoDias: 30, peso: 3 },
        {
          tipo: 'PACOTE',
          nome: 'Pós-produção',
          servicos: [
            { tipo: 'ATOMICO', nome: 'Edição de vídeo', papel: 'EDITOR', custo: 4500, prazoDias: 5 },
            { tipo: 'PACOTE', nome: 'Som', servicos: [{ tipo: 'ATOMICO', nome: 'Mixagem de áudio', papel: 'SONOPLASTA', custo: 3000, prazoDias: 3 }] },
          ],
        },
      ],
    },
  };

  it('POST com servicoPrincipal em 3 níveis recomenda um profissional por serviço atômico e devolve a árvore', async () => {
    const resposta = await app.inject({ method: 'POST', url: '/projetos/recomendar', payload: corpo });
    expect(resposta.statusCode).toBe(201);
    const { projeto, recomendacao } = resposta.json<{ projeto: ProjetoJson; recomendacao: { id: string; equipe: Array<{ papel: string }> } }>();
    expect(projeto).toMatchObject({ custoTotal: 27500, prazoTotalDias: 38, servicoPrincipal: { tipo: 'PACOTE', nome: 'Longa-metragem', custo: 27500 } });
    expect(projeto.papeis.map((p) => p.papel)).toEqual(['DIRETOR', 'EDITOR', 'SONOPLASTA']);
    expect(recomendacao.equipe.map((m) => m.papel)).toEqual(['DIRETOR', 'EDITOR', 'SONOPLASTA']);

    const relatorio = (await app.inject(`/recomendacoes/${recomendacao.id}/relatorio`)).json<{ relatorio: Relatorio }>().relatorio;
    expect(relatorio.servicos.custoTotal).toBe(27500);
    expect(relatorio.servicos.arvore).toEqual(projeto.servicoPrincipal);
    expect(relatorio.servicos.porServico.map((l) => [l.servico, l.profissionalId, l.disponivel])).toEqual([
      ['Direção', 'DIRETOR-top', true],
      ['Edição de vídeo', 'EDITOR-top', true],
      ['Mixagem de áudio', 'SONOPLASTA-top', true],
    ]);
    expect(relatorio.servicos.avisos).toEqual([]);
    expect(relatorio.texto).toContain('Serviços: custo total 27500.00 | prazo total 38 dia(s)');
  });

  it('custo acima do orçamento e prazo que não cabe viram avisos do relatório, não erro', async () => {
    const caro = {
      ...corpo,
      dataEntrega: '2026-01-20T00:00:00.000Z',
      servicoPrincipal: { tipo: 'ATOMICO', nome: 'Direção', papel: 'DIRETOR', custo: 999999, prazoDias: 60 },
    };
    const resposta = await app.inject({ method: 'POST', url: '/projetos/recomendar', payload: caro });
    expect(resposta.statusCode).toBe(201);
    const { recomendacao } = resposta.json<{ recomendacao: { id: string } }>();
    const relatorio = (await app.inject(`/recomendacoes/${recomendacao.id}/relatorio`)).json<{ relatorio: Relatorio }>().relatorio;
    expect(relatorio.servicos.avisos).toEqual([
      'Custo dos serviços (999999) excede o orçamento total (200000)',
      'Prazo dos serviços (60 dias) não cabe até a entrega (10 dias)',
    ]);
  });

  it('o relatório indica o profissional indisponível na janela e o serviço sem profissional', async () => {
    const { resumirServicos } = await import('../../src/visitors/resumoDosServicos');
    const { Recomendacao, MembroRecomendado } = await import('../../src/domain/entities/Recomendacao');
    const { criarProfissional } = await import('../support/fixtures');
    const projeto = projetoCom(new PacoteServico('P', [atomico('DIRETOR', 1, 1), atomico('EDITOR', 1, 1)]));
    const recomendacao = new Recomendacao({ projetoId: projeto.id, estrategia: 'COSSENO', criadaEm: DATA_REFERENCIA });
    recomendacao.adicionarMembro(new MembroRecomendado({ papel: 'DIRETOR', profissionalId: 'd', score: 1, custo: 1, rodada: 1, alternativas: [] }));
    const ocupado = criarProfissional({ id: 'd', disponibilidade: [{ inicio: DATA_REFERENCIA, fim: DATA_REFERENCIA }] });
    const resumo = resumirServicos({ projeto, recomendacao, membros: recomendacao.membrosAtivos(), profissionais: new Map([['d', ocupado]]) });
    expect(resumo.porServico.map((l) => [l.papel, l.profissionalId, l.disponivel])).toEqual([
      ['DIRETOR', 'd', false],
      ['EDITOR', null, null],
    ]);
  });

  it('papeis e servicoPrincipal juntos 422; estrutura inválida 422; sem nenhum dos dois 400', async () => {
    const ambos = await app.inject({ method: 'POST', url: '/projetos/recomendar', payload: { ...corpo, papeis: [{ papel: 'DIRETOR', peso: 1 }] } });
    expect(ambos.statusCode).toBe(422);
    const vazio = await app.inject({ method: 'POST', url: '/projetos/recomendar', payload: { ...corpo, servicoPrincipal: { tipo: 'PACOTE', nome: 'Nada', servicos: [] } } });
    expect(vazio.statusCode).toBe(422);
    expect(vazio.json<{ erro: string }>().erro).toBe('VALIDACAO');
    const { servicoPrincipal: _s, ...semEstrutura } = corpo;
    expect((await app.inject({ method: 'POST', url: '/projetos/recomendar', payload: semEstrutura })).statusCode).toBe(400);
  });

  it('o formato antigo com papeis continua aceito e vira um pacote de custo 0 e prazo 1 por papel', async () => {
    const { servicoPrincipal: _s, ...base } = corpo;
    const resposta = await app.inject({
      method: 'POST',
      url: '/projetos/recomendar',
      payload: { ...base, papeis: [{ papel: 'DIRETOR', peso: 3 }, { papel: 'EDITOR', peso: 1 }] },
    });
    expect(resposta.json<{ projeto: ProjetoJson }>().projeto).toMatchObject({ custoTotal: 0, prazoTotalDias: 2, servicoPrincipal: { tipo: 'PACOTE' } });
  });

  it('modelo + servicoPrincipal: a árvore do corpo substitui os papéis do modelo', async () => {
    const { tipoCaptacao: _t, genero: _g, duracaoEstimadaMin: _d, ...base } = corpo;
    const resposta = await app.inject({ method: 'POST', url: '/projetos/recomendar', payload: { ...base, modelo: 'documentario' } });
    expect(resposta.statusCode).toBe(201);
    expect(resposta.json<{ projeto: ProjetoJson }>().projeto.papeis.map((p) => p.papel)).toEqual(['DIRETOR', 'EDITOR', 'SONOPLASTA']);
  });
});
