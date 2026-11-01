import { AdaptadorIndeed } from '../../../src/adaptadores/profissional/AdaptadorIndeed';
import { AdaptadorInterno } from '../../../src/adaptadores/profissional/AdaptadorInterno';
import { AdaptadorLinkedIn } from '../../../src/adaptadores/profissional/AdaptadorLinkedIn';
import type { AdaptadorProfissional } from '../../../src/adaptadores/profissional/AdaptadorProfissional';
import { IndeedSimulado } from '../../../src/adaptadores/profissional/IndeedSimulado';
import { LinkedInSimulado } from '../../../src/adaptadores/profissional/LinkedInSimulado';
import { papeisReconhecidos } from '../../../src/adaptadores/profissional/papeisReconhecidos';
import { ErroNaoEncontrado } from '../../../src/domain/errors';
import { criarProfissional, DATA_ENTREGA, DATA_REFERENCIA } from '../../support/fixtures';
import { InMemoryProfissionalRepository } from '../../support/InMemoryRepositories';

function cadastro(): InMemoryProfissionalRepository {
  return new InMemoryProfissionalRepository([
    criarProfissional({
      id: 'ana',
      nome: 'Ana',
      especialidades: ['DIRETOR', 'ROTEIRISTA'],
      precoMin: 12000,
      precoMax: 18000,
      competencias: { direcao: 0.8, narrativa: 0.5 },
      historicoProjetos: ['Curta X'],
      notas: [['produtor-1', 4]],
    }),
    criarProfissional({ id: 'bia', nome: 'Bia', especialidades: ['EDITOR'], precoMin: 5000 }),
  ]);
}

describe.each<[string, (repo: InMemoryProfissionalRepository) => AdaptadorProfissional, string]>([
  ['AdaptadorInterno', (repo) => new AdaptadorInterno(repo), 'produtor-9'],
  ['AdaptadorLinkedIn', (repo) => new AdaptadorLinkedIn(new LinkedInSimulado(repo)), 'linkedin'],
  ['AdaptadorIndeed', (repo) => new AdaptadorIndeed(new IndeedSimulado(repo)), 'indeed'],
])('%s cumpre o contrato de AdaptadorProfissional', (_nome, criar, autorRegistrado) => {
  let repo: InMemoryProfissionalRepository;
  let adaptador: AdaptadorProfissional;

  beforeEach(() => {
    repo = cadastro();
    adaptador = criar(repo);
  });

  it('lista todos ou apenas os ids pedidos, já como entidade Profissional', async () => {
    expect((await adaptador.listarProfissionais({})).map((p) => p.id)).toEqual(['ana', 'bia']);
    expect((await adaptador.listarProfissionais({ ids: ['bia'] })).map((p) => p.id)).toEqual(['bia']);
  });

  it('detalha preservando os dados que a recomendação usa', async () => {
    const ana = await adaptador.detalharProfissional('ana');
    expect(ana.nome).toBe('Ana');
    expect(ana.especialidades).toEqual(['DIRETOR', 'ROTEIRISTA']);
    expect([ana.precoMin, ana.precoMax]).toEqual([12000, 18000]);
    expect(ana.vetorCompetencias().direcao).toBeCloseTo(0.8, 10);
    expect(ana.historicoProjetos).toEqual(['Curta X']);
    expect(ana.disponivelEntre(DATA_REFERENCIA, DATA_ENTREGA)).toBe(true);
    expect(ana.mediaAvaliacoes()).toBe(4);
  });

  it('profissional inexistente gera ErroNaoEncontrado', async () => {
    await expect(adaptador.detalharProfissional('ninguem')).rejects.toBeInstanceOf(ErroNaoEncontrado);
    await expect(adaptador.registrarAvaliacao('ninguem', { autorId: 'p', nota: 5, comentario: null })).rejects.toBeInstanceOf(
      ErroNaoEncontrado,
    );
  });

  it('registra a avaliação e ela aparece no profissional', async () => {
    await adaptador.registrarAvaliacao('bia', { autorId: 'produtor-9', nota: 5, comentario: 'ótima' });
    const bia = await adaptador.detalharProfissional('bia');
    expect(bia.avaliacoes.map((a) => [a.autorId, a.nota])).toEqual([[autorRegistrado, 5]]);
  });
});

describe('formatos dos provedores simulados', () => {
  it('LinkedIn usa URN, proficiência de 0 a 100 e recomendações com estrelas', async () => {
    const linkedIn = new LinkedInSimulado(cadastro());
    const { elements, paging } = await linkedIn.pesquisarPessoas({ urns: [LinkedInSimulado.urnDe('ana')] });
    expect(paging.total).toBe(1);
    expect(elements[0]).toMatchObject({
      urn: 'urn:li:person:ana',
      skills: expect.arrayContaining([{ name: 'direcao', proficiency: 80 }]),
      recommendations: [{ author: 'produtor-1', stars: 4 }],
    });
    expect(LinkedInSimulado.idDe('sem-prefixo')).toBe('sem-prefixo');
  });

  it('Indeed usa habilidades de 0 a 10, notas de 2 a 10 e datas em milissegundos', async () => {
    const indeed = new IndeedSimulado(cadastro());
    const candidato = await indeed.getCandidate('ana');
    expect(candidato?.skills.direcao).toBeCloseTo(8, 10);
    expect(candidato?.ratings).toEqual([{ reviewer: 'produtor-1', score: 8 }]);
    expect(typeof candidato?.availability[0]?.from).toBe('number');
    expect((await indeed.searchCandidates({})).totalResults).toBe(2);
  });

  it('papéis desconhecidos do provedor são ignorados', () => {
    expect(papeisReconhecidos(['EDITOR', 'Gerente', 'DIRETOR'])).toEqual(['EDITOR', 'DIRETOR']);
  });
});
