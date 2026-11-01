import type { Profissional } from '../../../src/domain/entities/Profissional';
import { Projeto } from '../../../src/domain/entities/Projeto';
import { ErroValidacao } from '../../../src/domain/errors';
import { FabricaAnimacao } from '../../../src/factories/animacao/FabricaAnimacao';
import { RegistroFabricas } from '../../../src/factories/RegistroFabricas';
import { CossenoStrategy } from '../../../src/strategies/CossenoStrategy';
import { AuditoriaDecorator } from '../../../src/strategies/decoradores/AuditoriaDecorator';
import { CacheDecorator } from '../../../src/strategies/decoradores/CacheDecorator';
import { CatalogoDeFabricasDecoradas } from '../../../src/strategies/decoradores/CatalogoDeFabricasDecoradas';
import { CompressaoDecorator } from '../../../src/strategies/decoradores/CompressaoDecorator';
import { MontadorDePilhaDeDecoradores } from '../../../src/strategies/decoradores/MontadorDePilhaDeDecoradores';
import type { NomeDecorador } from '../../../src/strategies/decoradores/nomesDosDecoradores';
import { PoliticaDeDecoradores } from '../../../src/strategies/decoradores/PoliticaDeDecoradores';
import { RecomendadorBase } from '../../../src/strategies/decoradores/RecomendadorBase';
import { RecomendadorConfiguravel } from '../../../src/strategies/decoradores/RecomendadorConfiguravel';
import { RecomendadoresDecorados } from '../../../src/strategies/decoradores/RecomendadoresDecorados';
import { RegistroDeAuditoriaEmMemoria } from '../../../src/strategies/decoradores/RegistroDeAuditoriaEmMemoria';
import { MENSAGEM_AUDITORIA_RECOMENDACAO, RegistroDeAuditoriaNoLogger } from '../../../src/strategies/decoradores/RegistroDeAuditoriaNoLogger';
import { FiltragemColaborativaStrategy } from '../../../src/strategies/FiltragemColaborativaStrategy';
import { OrcamentoReduzidoStrategy } from '../../../src/strategies/OrcamentoReduzidoStrategy';
import type { CandidatoPontuado, ContextoEstrategia, RecomendacaoStrategy } from '../../../src/strategies/RecomendacaoStrategy';
import { criarProjeto, dadosProjeto, gerarProfissionais, OPCOES_FABRICA } from '../../support/fixtures';
import { LoggerMemoria } from '../../support/InMemoryRepositories';

const UNIVERSO = gerarProfissionais(600);
const EDITORES = UNIVERSO.filter((p) => p.atuaComo('EDITOR'));

function contexto(ajustes: Partial<ContextoEstrategia> = {}, projeto: Projeto = criarProjeto()): ContextoEstrategia {
  return {
    projeto,
    papel: 'EDITOR',
    perfilDesejado: projeto.perfilDesejado('EDITOR'),
    orcamentoPapel: 30000,
    universo: UNIVERSO,
    ...ajustes,
  };
}

function contar(estrategia: RecomendacaoStrategy): { estrategia: RecomendacaoStrategy; chamadas: () => number } {
  let chamadas = 0;
  return {
    estrategia: {
      tipo: estrategia.tipo,
      descricao: estrategia.descricao,
      recomendar: (candidatos, ctx) => {
        chamadas += 1;
        return estrategia.recomendar(candidatos, ctx);
      },
    },
    chamadas: () => chamadas,
  };
}

const ranking = (lista: readonly CandidatoPontuado[]) => lista.map((c) => [c.profissional.id, c.score]);

describe('RecomendadorBase (componente concreto)', () => {
  it.each([new CossenoStrategy(), new FiltragemColaborativaStrategy(), new OrcamentoReduzidoStrategy()])(
    'delega à estratégia escolhida e mantém tipo e descrição ($tipo)',
    (estrategia) => {
      const base = new RecomendadorBase(estrategia);
      expect([base.tipo, base.descricao]).toEqual([estrategia.tipo, estrategia.descricao]);
      expect(base.recomendar(EDITORES, contexto())).toEqual(estrategia.recomendar(EDITORES, contexto()));
    },
  );
});

describe('CacheDecorator', () => {
  it.each([new CossenoStrategy(), new FiltragemColaborativaStrategy(), new OrcamentoReduzidoStrategy()])(
    'a repetição não chama o interno e devolve o mesmo resultado que sem cache ($tipo)',
    (estrategia) => {
      const { estrategia: contada, chamadas } = contar(estrategia);
      const cache = new CacheDecorator(contada);
      const primeiro = cache.recomendar(EDITORES, contexto());
      const segundo = cache.recomendar([...EDITORES], contexto({ universo: [...UNIVERSO] }));
      expect(chamadas()).toBe(1);
      expect(segundo).toEqual(primeiro);
      expect(segundo).toEqual(estrategia.recomendar(EDITORES, contexto()));
      expect([cache.tipo, cache.descricao]).toEqual([estrategia.tipo, estrategia.descricao]);
    },
  );

  it('devolve cópias: alterar o resultado não contamina a próxima resposta', () => {
    const cache = new CacheDecorator(new CossenoStrategy());
    const primeiro = cache.recomendar(EDITORES, contexto());
    primeiro.reverse();
    Object.assign(primeiro[0]?.detalhes ?? {}, { similaridade: -1 });
    const segundo = cache.recomendar(EDITORES, contexto());
    expect(segundo).toEqual(new CossenoStrategy().recomendar(EDITORES, contexto()));
    expect(segundo).not.toBe(cache.recomendar(EDITORES, contexto()));
  });

  it.each<[string, Partial<ContextoEstrategia> | (() => ContextoEstrategia)]>([
    ['outro papel', { papel: 'DIRETOR' }],
    ['outro orçamento do papel', { orcamentoPapel: 1000 }],
    ['outro perfil desejado', { perfilDesejado: { edicao: 0.1 } }],
    ['outro universo', { universo: UNIVERSO.slice(1) }],
    ['outro produtor', () => contexto({}, criarProjeto({ produtorId: 'produtor-x' }))],
    ['outra localização', () => contexto({}, criarProjeto({ localizacao: 'Recife' }))],
    ['outra data de entrega', () => contexto({}, criarProjeto({ dataEntrega: new Date('2027-01-01T00:00:00.000Z') }))],
  ])('requisição diferente (%s) não reaproveita o ranking', (_caso, ajuste) => {
    const { estrategia, chamadas } = contar(new OrcamentoReduzidoStrategy());
    const cache = new CacheDecorator(estrategia);
    cache.recomendar(EDITORES, contexto());
    cache.recomendar(EDITORES, typeof ajuste === 'function' ? ajuste() : contexto(ajuste));
    expect(chamadas()).toBe(2);
  });

  it('candidatos diferentes geram chave diferente', () => {
    const { estrategia, chamadas } = contar(new CossenoStrategy());
    const cache = new CacheDecorator(estrategia);
    cache.recomendar(EDITORES, contexto());
    cache.recomendar(EDITORES.slice(1), contexto());
    expect(chamadas()).toBe(2);
  });

  it('expira pelo TTL com relógio injetado, sem esperar', () => {
    let agora = 1_000;
    const { estrategia, chamadas } = contar(new CossenoStrategy());
    const cache = new CacheDecorator(estrategia, { ttlMs: 500, relogio: () => agora });
    cache.recomendar(EDITORES, contexto());
    agora += 499;
    cache.recomendar(EDITORES, contexto());
    expect(chamadas()).toBe(1);
    agora += 1;
    cache.recomendar(EDITORES, contexto());
    expect(chamadas()).toBe(2);
  });

  it('respeita o tamanho máximo descartando a entrada usada há mais tempo', () => {
    const { estrategia, chamadas } = contar(new CossenoStrategy());
    const cache = new CacheDecorator(estrategia, { tamanhoMaximo: 2 });
    const pedir = (papel: 'EDITOR' | 'DIRETOR' | 'SONOPLASTA') => cache.recomendar(EDITORES, contexto({ papel }));
    pedir('EDITOR');
    pedir('DIRETOR');
    pedir('EDITOR');
    pedir('SONOPLASTA');
    expect(cache.tamanho).toBe(2);
    pedir('EDITOR');
    expect(chamadas()).toBe(3);
    pedir('DIRETOR');
    expect(chamadas()).toBe(4);
  });

  it('com tamanho máximo 0 não guarda nada', () => {
    const { estrategia, chamadas } = contar(new CossenoStrategy());
    const cache = new CacheDecorator(estrategia, { tamanhoMaximo: 0 });
    cache.recomendar(EDITORES, contexto());
    cache.recomendar(EDITORES, contexto());
    expect([chamadas(), cache.tamanho]).toEqual([2, 0]);
  });
});

describe('AuditoriaDecorator e registros', () => {
  it('registra cada chamada de forma estruturada, com tempo medido pelo relógio injetado', () => {
    const registro = new RegistroDeAuditoriaEmMemoria();
    let tempo = 10;
    const lenta: RecomendacaoStrategy = {
      tipo: 'COSSENO',
      descricao: 'lenta',
      recomendar: (candidatos, ctx) => {
        tempo += 42.12345;
        return new CossenoStrategy().recomendar(candidatos, ctx).slice(0, 5);
      },
    };
    const auditoria = new AuditoriaDecorator(lenta, registro, () => tempo);
    const ctx = contexto();
    auditoria.recomendar(EDITORES, ctx);
    expect(registro.entradas).toEqual([
      {
        evento: 'recomendacao.estrategia',
        estrategia: 'COSSENO',
        papel: 'EDITOR',
        projetoId: ctx.projeto.id,
        candidatos: EDITORES.length,
        devolvidos: 5,
        duracaoMs: 42.123,
      },
    ]);
  });

  it('o relógio padrão mede um tempo não negativo', () => {
    const registro = new RegistroDeAuditoriaEmMemoria();
    new AuditoriaDecorator(new CossenoStrategy(), registro).recomendar(EDITORES, contexto());
    expect(registro.entradas[0]?.duracaoMs).toBeGreaterThanOrEqual(0);
  });

  it('o registro em memória é limitado e devolve cópias', () => {
    const registro = new RegistroDeAuditoriaEmMemoria(2);
    const auditoria = new AuditoriaDecorator(new CossenoStrategy(), registro, () => 0);
    for (const papel of ['EDITOR', 'DIRETOR', 'SONOPLASTA'] as const) auditoria.recomendar([], contexto({ papel }));
    expect(registro.entradas.map((e) => e.papel)).toEqual(['DIRETOR', 'SONOPLASTA']);
    expect(registro.entradas).not.toBe(registro.entradas);
  });

  it('o registro no logger escreve um objeto com campos nomeados, sem dados pessoais', () => {
    const logger = new LoggerMemoria();
    new AuditoriaDecorator(new CossenoStrategy(), new RegistroDeAuditoriaNoLogger(logger), () => 0).recomendar(EDITORES, contexto());
    const [linha] = logger.linhas;
    expect(linha?.mensagem).toBe(MENSAGEM_AUDITORIA_RECOMENDACAO);
    expect(Object.keys(linha?.objeto ?? {}).sort()).toEqual(['candidatos', 'devolvidos', 'duracaoMs', 'estrategia', 'evento', 'papel', 'projetoId']);
    expect(JSON.stringify(linha?.objeto)).not.toMatch(/@|Profissional \d/);
  });
});

describe('CompressaoDecorator', () => {
  it.each([new CossenoStrategy(), new FiltragemColaborativaStrategy(), new OrcamentoReduzidoStrategy()])(
    'reduz o JSON da saída mantendo ordem e scores ($tipo)',
    (estrategia) => {
      const original = estrategia.recomendar(EDITORES, contexto());
      const comprimido = new CompressaoDecorator(estrategia).recomendar(EDITORES, contexto());
      expect(ranking(comprimido)).toEqual(ranking(original));
      expect(JSON.stringify(comprimido).length).toBeLessThan(JSON.stringify(original).length);
      expect(comprimido.every((c) => Object.keys(c.detalhes).length === 0)).toBe(true);
    },
  );
});

describe('MontadorDePilhaDeDecoradores: ordem de envolvimento', () => {
  function montar(nomes: readonly NomeDecorador[]) {
    const registro = new RegistroDeAuditoriaEmMemoria();
    const { estrategia, chamadas } = contar(new CossenoStrategy());
    const montador = new MontadorDePilhaDeDecoradores({
      cache: (interno) => new CacheDecorator(interno),
      auditoria: (interno) => new AuditoriaDecorator(interno, registro, () => 0),
      compressao: (interno) => new CompressaoDecorator(interno),
    });
    return { pilha: montador.montar(estrategia, nomes), registro, chamadas };
  }

  it('o primeiro nome fica mais perto da base e o último é o mais externo', () => {
    const { pilha } = montar(['cache', 'auditoria', 'compressao']);
    expect(pilha).toBeInstanceOf(CompressaoDecorator);
    expect(montar([]).pilha).toBeInstanceOf(RecomendadorBase);
    expect(montar(['compressao', 'cache']).pilha).toBeInstanceOf(CacheDecorator);
  });

  it('auditoria por fora do cache registra também os acertos; por dentro, só as chamadas que chegam à base', () => {
    const fora = montar(['cache', 'auditoria']);
    const dentro = montar(['auditoria', 'cache']);
    for (const { pilha } of [fora, dentro]) {
      pilha.recomendar(EDITORES, contexto());
      pilha.recomendar(EDITORES, contexto());
    }
    expect(fora.registro.entradas).toHaveLength(2);
    expect(dentro.registro.entradas).toHaveLength(1);
    expect([fora.chamadas(), dentro.chamadas()]).toEqual([1, 1]);
  });

  it('compressão por dentro do cache guarda a versão menor; por fora, comprime a cada chamada; o ranking é o mesmo', () => {
    const dentro = montar(['compressao', 'cache']).pilha;
    const fora = montar(['cache', 'compressao']).pilha;
    expect(ranking(dentro.recomendar(EDITORES, contexto()))).toEqual(ranking(fora.recomendar(EDITORES, contexto())));
    expect(dentro.recomendar(EDITORES, contexto())).toEqual(fora.recomendar(EDITORES, contexto()));
  });
});

describe('PoliticaDeDecoradores', () => {
  it('usa a pilha padrão e a do produtor, alteráveis em tempo de execução', () => {
    const politica = new PoliticaDeDecoradores(['cache'], new Map([['produtor-1', ['compressao']]]));
    expect(politica.pilhaPara('produtor-1')).toEqual(['compressao']);
    expect(politica.pilhaPara('outro')).toEqual(['cache']);
    politica.definirPilhaPadrao([]);
    politica.definirPilha('outro', ['auditoria', 'cache']);
    expect(politica.pilhaPara('outro')).toEqual(['auditoria', 'cache']);
    expect(politica.pilhaPara('terceiro')).toEqual([]);
    expect(new PoliticaDeDecoradores().pilhaPara('x')).toEqual(['cache', 'auditoria']);
  });

  it('guarda uma cópia imutável da lista recebida', () => {
    const nomes: NomeDecorador[] = ['cache'];
    const politica = new PoliticaDeDecoradores(nomes);
    nomes.push('auditoria');
    expect(politica.pilhaPara('x')).toEqual(['cache']);
    expect(Object.isFrozen(politica.pilhaPara('x'))).toBe(true);
  });

  it('recusa decorador desconhecido, repetido e produtor vazio', () => {
    const politica = new PoliticaDeDecoradores();
    expect(() => politica.definirPilhaPadrao(['cache', 'cache'])).toThrow(/repetido/);
    expect(() => politica.definirPilhaPadrao(['zip' as NomeDecorador])).toThrow(ErroValidacao);
    expect(() => politica.definirPilha(' ', ['cache'])).toThrow(/produtor/);
  });
});

describe('RecomendadorConfiguravel e fábricas decoradas', () => {
  function criarConfiguravel(politica: PoliticaDeDecoradores) {
    const registro = new RegistroDeAuditoriaEmMemoria();
    const { estrategia, chamadas } = contar(new CossenoStrategy());
    const montador = new MontadorDePilhaDeDecoradores({
      cache: (interno) => new CacheDecorator(interno),
      auditoria: (interno) => new AuditoriaDecorator(interno, registro, () => 0),
      compressao: (interno) => new CompressaoDecorator(interno),
    });
    return { configuravel: new RecomendadorConfiguravel(estrategia, politica, montador), registro, chamadas, montador };
  }

  it('consulta a política a cada chamada e reaproveita a pilha (e o cache) da mesma lista', () => {
    const politica = new PoliticaDeDecoradores(['cache']);
    const { configuravel, registro, chamadas } = criarConfiguravel(politica);
    configuravel.recomendar(EDITORES, contexto());
    configuravel.recomendar(EDITORES, contexto());
    expect(chamadas()).toBe(1);
    politica.definirPilhaPadrao(['auditoria']);
    configuravel.recomendar(EDITORES, contexto());
    expect([chamadas(), registro.entradas.length]).toEqual([2, 1]);
    politica.definirPilhaPadrao(['cache']);
    configuravel.recomendar(EDITORES, contexto());
    expect(chamadas()).toBe(2);
    expect([configuravel.tipo, configuravel.descricao]).toEqual(['COSSENO', new CossenoStrategy().descricao]);
  });

  it('aplica a pilha do produtor do projeto', () => {
    const politica = new PoliticaDeDecoradores([], new Map([['produtor-a', ['auditoria']]]));
    const { configuravel, registro } = criarConfiguravel(politica);
    configuravel.recomendar(EDITORES, contexto({}, criarProjeto({ produtorId: 'produtor-b' })));
    configuravel.recomendar(EDITORES, contexto({}, criarProjeto({ produtorId: 'produtor-a' })));
    expect(registro.entradas).toHaveLength(1);
  });

  it('a fábrica decorada delega a família e envolve o recomendador que a fábrica produz, uma vez por fábrica e estratégia', () => {
    const { montador } = criarConfiguravel(new PoliticaDeDecoradores([]));
    const registro = RegistroFabricas.padrao();
    const catalogo = new CatalogoDeFabricasDecoradas(registro, new RecomendadoresDecorados(new PoliticaDeDecoradores(['compressao']), montador));
    expect(catalogo.tipos()).toEqual(registro.tipos());
    const fabrica = catalogo.obter('ANIMACAO');
    const real = new FabricaAnimacao(OPCOES_FABRICA);
    expect(fabrica.tipo).toBe('ANIMACAO');
    expect(fabrica.criarProjeto(dadosProjeto()).tipoCaptacao).toBe('ANIMACAO');
    expect(fabrica.criarValidador().constructor).toBe(real.criarValidador().constructor);
    expect(fabrica.criarRelatorio().constructor).toBe(real.criarRelatorio().constructor);
    expect(fabrica.criarNotificador().constructor).toBe(real.criarNotificador().constructor);
    const base = new OrcamentoReduzidoStrategy();
    const recomendador = fabrica.comEstrategia(base).criarRecomendador();
    expect(recomendador).toBe(catalogo.obter('ANIMACAO').comEstrategia(base).criarRecomendador());
    expect(recomendador).not.toBe(fabrica.criarRecomendador());
    expect(recomendador.tipo).toBe('ORCAMENTO_REDUZIDO');
    const projeto = criarProjeto({ tipoCaptacao: 'ANIMACAO' });
    const esperado = real.comEstrategia(base).criarRecomendador().recomendar(EDITORES, contexto({}, projeto));
    const obtido = recomendador.recomendar(EDITORES, contexto({}, projeto));
    expect(ranking(obtido)).toEqual(ranking(esperado));
    expect(obtido.every((c) => Object.keys(c.detalhes).length === 0)).toBe(true);
  });
});

describe('estratégias não mudam com os decoradores', () => {
  it('as três estratégias continuam com a mesma interface e produzem o mesmo ranking envolvidas pela pilha completa', () => {
    const montador = new MontadorDePilhaDeDecoradores({
      cache: (interno) => new CacheDecorator(interno),
      auditoria: (interno) => new AuditoriaDecorator(interno, new RegistroDeAuditoriaEmMemoria()),
      compressao: (interno) => new CompressaoDecorator(interno),
    });
    const universo: readonly Profissional[] = UNIVERSO;
    for (const estrategia of [new CossenoStrategy(), new FiltragemColaborativaStrategy(), new OrcamentoReduzidoStrategy()]) {
      const pilha = montador.montar(estrategia, ['cache', 'auditoria', 'compressao']);
      expect(ranking(pilha.recomendar(EDITORES, contexto({ universo })))).toEqual(ranking(estrategia.recomendar(EDITORES, contexto({ universo }))));
    }
  });
});
