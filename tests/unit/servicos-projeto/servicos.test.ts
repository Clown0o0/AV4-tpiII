import { ErroValidacao } from '../../../src/domain/errors';
import type { PapelTecnico } from '../../../src/domain/entities/Projeto';
import { clonarServico } from '../../../src/servicos-projeto/clonarServico';
import { ColetorDeServicosAtomicos, PROFUNDIDADE_MAXIMA_DE_SERVICOS } from '../../../src/servicos-projeto/ColetorDeServicosAtomicos';
import { lerServicoProjeto, pacoteDosPapeis } from '../../../src/servicos-projeto/lerServicoProjeto';
import { PacoteServico } from '../../../src/servicos-projeto/PacoteServico';
import { ServicoAtomico, type DadosServicoAtomico } from '../../../src/servicos-projeto/ServicoAtomico';
import { servicoParaJson } from '../../../src/servicos-projeto/ServicoJson';
import type { ServicoProjeto } from '../../../src/servicos-projeto/ServicoProjeto';
import { TransformadorDeServicos } from '../../../src/servicos-projeto/TransformadorDeServicos';
import type { VisitanteDeServicos } from '../../../src/servicos-projeto/VisitanteDeServicos';

function atomico(papel: PapelTecnico, custo = 1000, prazoDias = 2, extras: Partial<DadosServicoAtomico> = {}): ServicoAtomico {
  return new ServicoAtomico({ nome: `Serviço ${papel}`, papel, custo, prazoDias, ...extras });
}

describe('ServicoAtomico (folha)', () => {
  it('expõe custo, prazo, papel e peso padrão 1, sem subserviços', () => {
    const edicao = atomico('EDITOR', 4500, 5);
    expect([edicao.calcularCusto(), edicao.obterPrazo(), edicao.papel, edicao.peso]).toEqual([4500, 5, 'EDITOR', 1]);
    expect(edicao.listarSubservicos()).toEqual([]);
    expect(Object.isFrozen(edicao.listarSubservicos())).toBe(true);
    expect(() => edicao.validar()).not.toThrow();
  });

  it('copia as competências desejadas (normalizadas) e não deixa alterar o original', () => {
    const vetor = { 'Mixagem Final': 0.9 };
    const mixagem = atomico('SONOPLASTA', 1, 1, { competenciasDesejadas: vetor, peso: 2 });
    vetor['Mixagem Final'] = 0.1;
    const lidas = mixagem.competenciasDesejadas;
    expect(lidas).toEqual({ mixagem_final: 0.9 });
    if (lidas) Object.assign(lidas, { mixagem_final: 0 });
    expect(mixagem.papelRequerido()).toEqual({ papel: 'SONOPLASTA', peso: 2, competenciasDesejadas: { mixagem_final: 0.9 } });
    expect(atomico('EDITOR').papelRequerido()).toEqual({ papel: 'EDITOR', peso: 1 });
  });

  it.each<[string, () => ServicoAtomico, RegExp]>([
    ['nome vazio', () => new ServicoAtomico({ nome: '  ', papel: 'EDITOR', custo: 1, prazoDias: 1 }), /Nome do serviço é obrigatório/],
    ['papel inválido', () => atomico('CAMERA' as PapelTecnico), /Papel técnico inválido: CAMERA/],
    ['custo negativo', () => atomico('EDITOR', -1), /Custo do serviço "Serviço EDITOR" deve ser um número maior ou igual a zero/],
    ['custo infinito', () => atomico('EDITOR', Number.POSITIVE_INFINITY), /Custo do serviço/],
    ['prazo zero', () => atomico('EDITOR', 1, 0), /Prazo do serviço "Serviço EDITOR" deve ser um número inteiro de dias maior ou igual a 1/],
    ['prazo fracionado', () => atomico('EDITOR', 1, 1.5), /Prazo do serviço/],
    ['peso não positivo', () => atomico('EDITOR', 1, 1, { peso: 0 }), /Peso do papel EDITOR deve ser positivo/],
  ])('validar recusa %s', (_caso, criar, mensagem) => {
    expect(() => criar().validar()).toThrow(mensagem);
  });
});

describe('PacoteServico (composto)', () => {
  it('soma custos e prazos dos filhos, em qualquer profundidade', () => {
    const posProducao = new PacoteServico('Pós-produção', [atomico('EDITOR', 4500, 5), atomico('SONOPLASTA', 3000, 3)]);
    const filme = new PacoteServico('Filme', [atomico('DIRETOR', 20000, 30), posProducao]);
    expect(posProducao.calcularCusto()).toBe(7500);
    expect(filme.calcularCusto()).toBe(27500);
    expect(filme.obterPrazo()).toBe(38);
    expect(() => filme.validar()).not.toThrow();
  });

  it('listarSubservicos devolve uma cópia imutável dos filhos diretos', () => {
    const filhos = [atomico('EDITOR')];
    const pacote = new PacoteServico('P', filhos);
    filhos.push(atomico('DIRETOR'));
    const lista = pacote.listarSubservicos();
    expect(lista).toHaveLength(1);
    expect(Object.isFrozen(lista)).toBe(true);
    expect(lista).not.toBe(pacote.listarSubservicos());
  });

  it.each<[string, () => ServicoProjeto, RegExp]>([
    ['pacote vazio', () => new PacoteServico('Vazio', []), /O pacote "Vazio" deve conter ao menos um serviço/],
    ['pacote sem nome', () => new PacoteServico(' ', [atomico('EDITOR')]), /Nome do pacote de serviços é obrigatório/],
    ['pacote vazio aninhado', () => new PacoteServico('A', [new PacoteServico('B', [])]), /O pacote "B"/],
    ['papel repetido em níveis diferentes', () => new PacoteServico('A', [atomico('EDITOR'), new PacoteServico('B', [atomico('EDITOR')])]), /Papel EDITOR informado mais de uma vez/],
    ['filho inválido em nível profundo', () => new PacoteServico('A', [new PacoteServico('B', [atomico('EDITOR', -5)])]), /Custo do serviço/],
  ])('validar é recursivo: recusa %s', (_caso, criar, mensagem) => {
    expect(() => criar().validar()).toThrow(mensagem);
  });

  it('a mesma instância duas vezes na árvore é recusada', () => {
    const repetido = atomico('EDITOR');
    expect(() => new PacoteServico('A', [repetido, new PacoteServico('B', [repetido])]).validar()).toThrow(/mesmo serviço aparece mais de uma vez/);
  });

  it('ciclo criado por uma implementação própria de ServicoProjeto é recusado', () => {
    const ciclico: ServicoProjeto = {
      calcularCusto: () => 0,
      obterPrazo: () => 0,
      validar: () => undefined,
      listarSubservicos: () => [ciclico],
      aceitar: (visitante: VisitanteDeServicos) => visitante.visitarPacoteServico(new PacoteServico('Ciclo', [ciclico])),
    };
    expect(() => new PacoteServico('Raiz', [ciclico]).validar()).toThrow(ErroValidacao);
  });

  it(`aceita até ${PROFUNDIDADE_MAXIMA_DE_SERVICOS} níveis e recusa mais que isso`, () => {
    const aninhar = (niveis: number): ServicoProjeto =>
      niveis === 1 ? atomico('EDITOR') : new PacoteServico(`Nível ${niveis}`, [aninhar(niveis - 1)]);
    expect(() => aninhar(PROFUNDIDADE_MAXIMA_DE_SERVICOS).validar()).not.toThrow();
    expect(() => aninhar(PROFUNDIDADE_MAXIMA_DE_SERVICOS + 1).validar()).toThrow(/profundidade máxima de 10 níveis/);
  });
});

describe('visitantes da árvore de serviços', () => {
  const arvore = () =>
    new PacoteServico('Filme', [
      atomico('DIRETOR'),
      new PacoteServico('Pós', [atomico('EDITOR'), new PacoteServico('Som', [atomico('SONOPLASTA')])]),
    ]);

  it('o coletor devolve as folhas em ordem de profundidade', () => {
    expect(ColetorDeServicosAtomicos.coletar(arvore()).map((s) => s.papel)).toEqual(['DIRETOR', 'EDITOR', 'SONOPLASTA']);
    expect(ColetorDeServicosAtomicos.coletar(atomico('EDITOR')).map((s) => s.papel)).toEqual(['EDITOR']);
  });

  it('clonarServico copia em profundidade sem compartilhar nenhum nó', () => {
    const original = arvore();
    const clone = clonarServico(original);
    const nos = (servico: ServicoProjeto): ServicoProjeto[] => [servico, ...servico.listarSubservicos().flatMap(nos)];
    const originais = new Set(nos(original));
    expect(nos(clone).some((no) => originais.has(no))).toBe(false);
    expect(servicoParaJson(clone)).toEqual(servicoParaJson(original));
  });

  it('servicoParaJson mostra custo e prazo calculados em cada pacote', () => {
    expect(servicoParaJson(new PacoteServico('P', [atomico('EDITOR', 10, 2), atomico('DIRETOR', 5, 1)]))).toEqual({
      tipo: 'PACOTE',
      nome: 'P',
      custo: 15,
      prazoDias: 3,
      servicos: [
        { tipo: 'ATOMICO', nome: 'Serviço EDITOR', papel: 'EDITOR', custo: 10, prazoDias: 2, peso: 1 },
        { tipo: 'ATOMICO', nome: 'Serviço DIRETOR', papel: 'DIRETOR', custo: 5, prazoDias: 1, peso: 1 },
      ],
    });
  });

  it('o transformador exige que o nó se apresente ao visitante exatamente uma vez', () => {
    const mudo: ServicoProjeto = { calcularCusto: () => 0, obterPrazo: () => 0, validar: () => undefined, listarSubservicos: () => [], aceitar: () => undefined };
    expect(() => TransformadorDeServicos.aplicar(mudo, { atomico: () => 1, pacote: () => 2 })).toThrow(TypeError);
  });
});

describe('lerServicoProjeto (JSON da API e do banco)', () => {
  it('lê a árvore e é o inverso de servicoParaJson', () => {
    const json = {
      tipo: 'PACOTE',
      nome: 'Filme',
      servicos: [
        { tipo: 'ATOMICO', nome: 'Direção', papel: 'DIRETOR', custo: 20000, prazoDias: 30, peso: 3, competenciasDesejadas: { direcao: 1 } },
        { tipo: 'PACOTE', nome: 'Pós', servicos: [{ tipo: 'ATOMICO', nome: 'Edição', papel: 'EDITOR', custo: 4500, prazoDias: 5 }] },
      ],
    };
    const servico = lerServicoProjeto(json);
    expect(servico.calcularCusto()).toBe(24500);
    expect(lerServicoProjeto(servicoParaJson(servico))).toEqual(servico);
  });

  it.each<[string, unknown, RegExp]>([
    ['não objeto', [1], /Cada serviço deve ser um objeto JSON/],
    ['tipo desconhecido', { tipo: 'X', nome: 'a' }, /Tipo de serviço inválido: X/],
    ['papel inválido', { tipo: 'ATOMICO', nome: 'a', papel: 'CAMERA', custo: 1, prazoDias: 1 }, /Papel técnico inválido: CAMERA/],
    ['competências não numéricas', { tipo: 'ATOMICO', nome: 'a', papel: 'EDITOR', custo: 1, prazoDias: 1, competenciasDesejadas: { a: 'x' } }, /competenciasDesejadas/],
    ['competências em lista', { tipo: 'ATOMICO', nome: 'a', papel: 'EDITOR', custo: 1, prazoDias: 1, competenciasDesejadas: [1] }, /competenciasDesejadas/],
  ])('recusa %s', (_caso, json, mensagem) => {
    expect(() => lerServicoProjeto(json)).toThrow(mensagem);
  });

  it('campos ausentes viram valores inválidos que validar() aponta', () => {
    expect(() => lerServicoProjeto({ tipo: 'ATOMICO', papel: 'EDITOR' }).validar()).toThrow(/Nome do serviço é obrigatório/);
    expect(() => lerServicoProjeto({ tipo: 'ATOMICO', nome: 'a', papel: 'EDITOR', custo: '1', prazoDias: 1 }).validar()).toThrow(/Custo/);
    expect(() => lerServicoProjeto({ tipo: 'ATOMICO', nome: 'a', papel: 'EDITOR', custo: 1, prazoDias: 1, peso: 'x' }).validar()).toThrow(/Peso/);
    expect(() => lerServicoProjeto({ tipo: 'PACOTE', nome: 'p', servicos: 'x' }).validar()).toThrow(/deve conter ao menos um serviço/);
  });

  it('para de ler além da profundidade máxima, antes de recursão excessiva', () => {
    let json: object = { tipo: 'ATOMICO', nome: 'a', papel: 'EDITOR', custo: 1, prazoDias: 1 };
    for (let i = 0; i < 5000; i += 1) json = { tipo: 'PACOTE', nome: `n${i}`, servicos: [json] };
    expect(() => lerServicoProjeto(json)).toThrow(/profundidade máxima/);
  });

  it('pacoteDosPapeis converte o formato antigo (um atômico por papel, custo 0 e prazo 1)', () => {
    const pacote = pacoteDosPapeis([{ papel: 'DIRETOR', peso: 3 }, { papel: 'EDITOR', peso: 1, competenciasDesejadas: { edicao: 1 } }]);
    expect(servicoParaJson(pacote)).toEqual({
      tipo: 'PACOTE',
      nome: 'Serviços do projeto',
      custo: 0,
      prazoDias: 2,
      servicos: [
        { tipo: 'ATOMICO', nome: 'DIRETOR', papel: 'DIRETOR', custo: 0, prazoDias: 1, peso: 3 },
        { tipo: 'ATOMICO', nome: 'EDITOR', papel: 'EDITOR', custo: 0, prazoDias: 1, peso: 1, competenciasDesejadas: { edicao: 1 } },
      ],
    });
  });
});
