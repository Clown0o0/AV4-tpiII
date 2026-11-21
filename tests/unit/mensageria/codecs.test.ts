import { Convite } from '../../../src/domain/entities/Convite';
import { MembroRecomendado, Recomendacao } from '../../../src/domain/entities/Recomendacao';
import { EVENTOS, type EventoRecomendacao } from '../../../src/events/EventTypes';
import { RegistroFabricas } from '../../../src/factories/RegistroFabricas';
import { eventoDeRecomendacaoIntegrado, produtorDe } from '../../../src/mensageria/codecs/eventoDeRecomendacaoIntegrado';
import { eventoIntegradoDeJson, eventoIntegradoParaJson, type EventoIntegrado } from '../../../src/mensageria/codecs/eventoIntegradoJson';
import { profissionaisDeJson, profissionalDeJson, profissionalParaJson } from '../../../src/mensageria/codecs/profissionalJson';
import { projetoDeJson, projetoParaJson } from '../../../src/mensageria/codecs/projetoJson';
import { ErroMensagemInvalida } from '../../../src/mensageria/ErroMensagemInvalida';
import { criarProfissional, criarProjeto, dadosProjeto, DATA_REFERENCIA } from '../../support/fixtures';

const ida = <T>(valor: T): unknown => JSON.parse(JSON.stringify(valor));

describe('codecs JSON das mensagens', () => {
  it('Profissional sobrevive à ida e volta com competências, disponibilidade e avaliações', () => {
    const original = criarProfissional({ id: 'p1', especialidades: ['EDITOR'], competencias: { edicao: 0.9, ritmo: 0.4 }, notas: [['produtor-1', 4]] });
    const lido = profissionalDeJson(ida(profissionalParaJson(original)));
    expect(profissionalParaJson(lido)).toEqual(profissionalParaJson(original));
    expect(lido.vetorCompetencias()).toEqual(original.vetorCompetencias());
    expect(lido.mediaAvaliacoes()).toBe(4);
    expect(profissionaisDeJson([ida(profissionalParaJson(original))])).toHaveLength(1);
    expect(() => profissionalDeJson({ ...profissionalParaJson(original), especialidades: ['PIPOQUEIRO'] })).toThrow(ErroMensagemInvalida);
  });

  it('Projeto de cada tipo volta como o subtipo da fábrica, com a mesma árvore de serviços', () => {
    const fabricas = RegistroFabricas.padrao();
    for (const tipoCaptacao of ['FICCAO', 'DOCUMENTARIO', 'ANIMACAO', 'PUBLICITARIO'] as const) {
      const original = fabricas.obter(tipoCaptacao).criarProjeto(dadosProjeto({ tipoCaptacao }));
      const lido = projetoDeJson(ida(projetoParaJson(original)), fabricas);
      expect(lido.constructor).toBe(original.constructor);
      expect(projetoParaJson(lido)).toEqual(projetoParaJson(original));
    }
    expect(projetoParaJson(projetoDeJson({ ...projetoParaJson(criarProjeto()), detalhes: undefined }, fabricas)).detalhes).toBeNull();
    expect(() => projetoDeJson({ ...projetoParaJson(criarProjeto()), tipoCaptacao: 'NOVELA' }, fabricas)).toThrow(ErroMensagemInvalida);
  });

  it('EventoIntegrado vai e volta pelo JSON', () => {
    const evento: EventoIntegrado = {
      id: 'e1',
      nome: 'projeto.criado',
      origem: 'PROJETOS',
      projetoId: 'proj',
      titulo: 'Filme',
      produtor: { id: 'produtor-1', email: 'p@x.dev', nome: null },
      destinatarios: [{ id: 'p1', email: null, nome: 'Ana' }],
      ocorridoEm: DATA_REFERENCIA,
    };
    expect(eventoIntegradoDeJson(ida(eventoIntegradoParaJson(evento)))).toEqual(evento);
    expect(() => eventoIntegradoDeJson({ ...eventoIntegradoParaJson(evento), origem: 'OUTRA' })).toThrow(ErroMensagemInvalida);
  });

  describe('eventoDeRecomendacaoIntegrado converte cada evento de recomendação', () => {
    const projeto = criarProjeto({ produtorEmail: null });
    const profissional = criarProfissional({ id: 'p1' });
    const recomendacao = new Recomendacao({
      projetoId: projeto.id,
      estrategia: 'COSSENO',
      membros: [new MembroRecomendado({ papel: 'DIRETOR', profissionalId: 'p1', score: 1, custo: 10, rodada: 1, alternativas: [] })],
    });
    const convite = new Convite({ recomendacaoId: recomendacao.id, projetoId: projeto.id, profissionalId: 'p1', papel: 'DIRETOR' });
    const base = { ator: { tipo: 'PRODUTOR' as const, id: projeto.produtorId }, ocorridoEm: DATA_REFERENCIA, projetoId: projeto.id };
    const casos: Array<[EventoRecomendacao, string[]]> = [
      [{ nome: EVENTOS.RECOMENDACAO_GERADA, payload: { ...base, projeto, recomendacao, motivo: 'INICIAL', profissionaisSugeridos: [profissional], fonteProfissionais: 'REPOSITORIO' } }, ['p1']],
      [{ nome: EVENTOS.MEMBRO_SUBSTITUIDO, payload: { ...base, projeto, recomendacao, papel: 'DIRETOR', anteriorId: 'p0', novoId: 'p1', profissionalNovo: profissional } }, ['p1']],
      [{ nome: EVENTOS.MEMBRO_SUBSTITUIDO, payload: { ...base, projeto, recomendacao, papel: 'DIRETOR', anteriorId: 'p0', novoId: null, profissionalNovo: null } }, []],
      [{ nome: EVENTOS.INTERESSE_PRODUTOR, payload: { ...base, projeto, convite, profissional } }, ['p1']],
      [{ nome: EVENTOS.CONVITE_ACEITO, payload: { ...base, projeto, convite, profissional: null } }, ['p1']],
      [{ nome: EVENTOS.CONVITE_RECUSADO, payload: { ...base, projeto, convite, profissional } }, ['p1']],
      [{ nome: EVENTOS.EQUIPE_FINALIZADA, payload: { ...base, projeto, recomendacao } }, ['p1']],
      [{ nome: EVENTOS.MEMBRO_REJEITADO, payload: { ...base, recomendacaoId: recomendacao.id, papel: 'DIRETOR', profissionalId: 'p1' } }, []],
      [{ nome: EVENTOS.PROJETO_ALTERADO, payload: { ...base, projeto, alteracao: projeto.alterar({}), reavaliada: false } }, []],
      [{ nome: EVENTOS.INTEGRACAO_GERENCIAMENTO_PROJETOS, payload: { ...base, recomendacaoId: 'r', dataEntrega: DATA_REFERENCIA, equipe: [{ papel: 'DIRETOR', profissionalId: 'p1' }] } }, ['p1']],
      [{ nome: EVENTOS.INTEGRACAO_FINANCEIRO, payload: { ...base, recomendacaoId: 'r', orcamentoTotal: 1, custoEquipe: 1, pagamentos: [{ profissionalId: 'p2', papel: 'DIRETOR', valor: 1 }] } }, ['p2']],
    ];
    it.each(casos.map(([evento, ids]) => [evento.nome, evento, ids] as const))('%s', (_nome, evento, ids) => {
      const integrado = eventoDeRecomendacaoIntegrado(evento, 'id-1');
      expect(integrado).toMatchObject({ id: 'id-1', nome: evento.nome, origem: 'RECOMENDACOES', projetoId: projeto.id, ocorridoEm: DATA_REFERENCIA });
      expect(integrado.destinatarios.map((d) => d.id)).toEqual(ids);
      expect(integrado.produtor.id).toBe(projeto.produtorId);
      expect(integrado.titulo).toBe('projeto' in evento.payload ? projeto.titulo : projeto.id);
    });

    it('produtor sem e-mail recebe um endereço interno', () => {
      expect(produtorDe(projeto).email).toBe(`${projeto.produtorId}@produtores.cinebridge.local`);
      expect(produtorDe(criarProjeto({ produtorEmail: 'x@y.dev' })).email).toBe('x@y.dev');
    });
  });
});
