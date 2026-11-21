import { EVENTOS } from '../../../src/events/EventTypes';
import { BarramentoEmMemoria } from '../../../src/mensageria/BarramentoEmMemoria';
import { EVENTOS_DE_PROJETO, eventoIntegradoParaJson, type EventoIntegrado } from '../../../src/mensageria/codecs/eventoIntegradoJson';
import { FILAS } from '../../../src/mensageria/filas';
import { AlertaPersistidoObservador } from '../../../src/notificacoes/AlertaPersistidoObservador';
import { CentralDeNotificacoes } from '../../../src/notificacoes/CentralDeNotificacoes';
import { ConsumidorDeEventos } from '../../../src/notificacoes/ConsumidorDeEventos';
import { EmailSimuladoObservador } from '../../../src/notificacoes/EmailSimuladoObservador';
import { MensagemInternaSimuladaObservador } from '../../../src/notificacoes/MensagemInternaSimuladaObservador';
import { textoDoEvento } from '../../../src/notificacoes/textoDoEvento';
import { DATA_REFERENCIA } from '../../support/fixtures';
import { LoggerMemoria } from '../../support/InMemoryRepositories';
import { InMemoryNotificacaoRepository } from '../../support/servicosEmMemoria';

function evento(dados: Partial<EventoIntegrado> = {}): EventoIntegrado {
  return {
    id: '3f0c9a52-6f6b-4d2a-9d37-0a0d2f6b1c11',
    nome: EVENTOS_DE_PROJETO.CRIADO,
    origem: 'PROJETOS',
    projetoId: 'proj-1',
    titulo: 'Sertão em Chamas',
    produtor: { id: 'produtor-7', email: 'produtora@filmes.dev', nome: null },
    destinatarios: [
      { id: 'p1', email: 'ana@x.dev', nome: 'Ana' },
      { id: 'p2', email: null, nome: null },
    ],
    ocorridoEm: DATA_REFERENCIA,
    ...dados,
  };
}

describe('Notificações (Observer sobre eventos das filas)', () => {
  it('a central notifica todos os observadores e falha só depois de todos rodarem', async () => {
    const notificacoes = new InMemoryNotificacaoRepository();
    const logger = new LoggerMemoria();
    const email = new EmailSimuladoObservador(logger);
    const mensagens = new MensagemInternaSimuladaObservador(logger);
    const quebrado = { nome: 'quebrado', atualizar: jest.fn().mockRejectedValue(new Error('smtp fora')) };
    const central = new CentralDeNotificacoes().adicionar(new AlertaPersistidoObservador(notificacoes)).adicionar(email).adicionar(mensagens).adicionar(quebrado);
    expect(central.quantidadeObservadores()).toBe(4);

    await expect(central.notificar(evento())).rejects.toThrow('smtp fora');
    expect(notificacoes.registros.get(evento().id)).toEqual({
      id: evento().id,
      evento: 'projeto.criado',
      origem: 'PROJETOS',
      projetoId: 'proj-1',
      titulo: 'Sertão em Chamas',
      texto: 'Projeto "Sertão em Chamas" cadastrado',
      destinatarios: ['produtor-7', 'p1', 'p2'],
      ocorridoEm: DATA_REFERENCIA,
    });
    expect(email.enviados).toBe(2);
    expect(mensagens.entregues).toBe(3);
    expect(logger.linhas.filter((l) => l.objeto.canal === 'email').map((l) => l.objeto.para)).toEqual(['produtora@filmes.dev', 'ana@x.dev']);

    central.remover(quebrado);
    await central.notificar(evento());
    expect(notificacoes.registros.size).toBe(1);
  });

  it('cada evento conhecido tem texto próprio; desconhecido recebe um texto genérico', () => {
    const nomes = [...Object.values(EVENTOS_DE_PROJETO), EVENTOS.RECOMENDACAO_GERADA, EVENTOS.MEMBRO_REJEITADO, EVENTOS.MEMBRO_SUBSTITUIDO, EVENTOS.INTERESSE_PRODUTOR, EVENTOS.CONVITE_ACEITO, EVENTOS.CONVITE_RECUSADO, EVENTOS.PROJETO_ALTERADO, EVENTOS.EQUIPE_FINALIZADA];
    const textos = nomes.map((nome) => textoDoEvento(evento({ nome })));
    expect(new Set(textos).size).toBe(nomes.length);
    expect(textos.every((t) => t.includes('Sertão em Chamas'))).toBe(true);
    expect(textoDoEvento(evento({ nome: 'algo.novo' }))).toBe('Evento algo.novo no projeto "Sertão em Chamas"');
  });

  it('o consumidor lê as duas filas, decodifica e entrega à central; mensagem inválida é rejeitada', async () => {
    const barramento = new BarramentoEmMemoria();
    const notificacoes = new InMemoryNotificacaoRepository();
    const consumidor = new ConsumidorDeEventos(barramento, new CentralDeNotificacoes().adicionar(new AlertaPersistidoObservador(notificacoes)));
    await consumidor.iniciar([FILAS.EVENTOS_PROJETOS, FILAS.EVENTOS_RECOMENDACOES]);
    await barramento.publicar(FILAS.EVENTOS_PROJETOS, eventoIntegradoParaJson(evento()));
    await barramento.publicar(FILAS.EVENTOS_RECOMENDACOES, eventoIntegradoParaJson(evento({ id: 'e2', origem: 'RECOMENDACOES', nome: EVENTOS.CONVITE_ACEITO })));
    await barramento.publicar(FILAS.EVENTOS_RECOMENDACOES, { lixo: true });
    await barramento.aguardarEntregas();
    expect(notificacoes.eventos()).toEqual(['projeto.criado', 'convite.aceito']);
    expect(barramento.rejeitadas).toEqual([{ lixo: true }]);
  });
});
