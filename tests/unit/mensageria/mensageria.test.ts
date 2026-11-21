import { BarramentoEmMemoria } from '../../../src/mensageria/BarramentoEmMemoria';
import { ClienteRpc } from '../../../src/mensageria/ClienteRpc';
import { ErroMensagemInvalida } from '../../../src/mensageria/ErroMensagemInvalida';
import { ErroRemoto } from '../../../src/mensageria/ErroRemoto';
import { ErroServicoIndisponivel } from '../../../src/mensageria/ErroServicoIndisponivel';
import { booleano, data, lista, numero, objeto, opcao, opcoesDe, texto, textoOuNulo, textos } from '../../../src/mensageria/leitorJson';
import { abrirResposta, falha, FALHA_INTERNA, lerPedido, sucesso } from '../../../src/mensageria/protocoloRpc';
import { ServidorRpc } from '../../../src/mensageria/ServidorRpc';
import { ErroNaoEncontrado } from '../../../src/domain/errors';

function logger() {
  return { info: jest.fn(), warn: jest.fn(), error: jest.fn() };
}

describe('BarramentoEmMemoria', () => {
  it('guarda mensagens até haver consumidor, distribui em rodízio e copia o conteúdo (como JSON)', async () => {
    const barramento = new BarramentoEmMemoria();
    const original = { quando: new Date('2026-01-01T00:00:00.000Z') };
    await barramento.publicar('fila', original);
    await barramento.publicar('fila', 2);
    expect(barramento.pendentes('fila')).toBe(2);
    const a: unknown[] = [];
    const b: unknown[] = [];
    await barramento.consumir('fila', async (m) => void a.push(m));
    await barramento.consumir('fila', async (m) => void b.push(m));
    await barramento.publicar('fila', 3);
    await barramento.publicar('fila', 4);
    await barramento.aguardarEntregas();
    expect(a).toEqual([{ quando: '2026-01-01T00:00:00.000Z' }, 2, 3]);
    expect(b).toEqual([4]);
    expect(barramento.pendentes('outra')).toBe(0);
  });

  it('registra mensagens cujo tratador falhou e respeita queda e restauração', async () => {
    const barramento = new BarramentoEmMemoria();
    await barramento.consumir('fila', async () => {
      throw new Error('x');
    });
    await barramento.publicar('fila', 'ruim');
    await barramento.aguardarEntregas();
    expect(barramento.rejeitadas).toEqual(['ruim']);
    barramento.derrubar();
    expect(await barramento.verificar()).toBe(false);
    await expect(barramento.publicar('fila', 1)).rejects.toBeInstanceOf(ErroServicoIndisponivel);
    await expect(barramento.consumir('fila', async () => undefined)).rejects.toBeInstanceOf(ErroServicoIndisponivel);
    await expect(barramento.responder('fila', async () => undefined)).rejects.toBeInstanceOf(ErroServicoIndisponivel);
    await expect(barramento.consultar('fila', {}, 10)).rejects.toBeInstanceOf(ErroServicoIndisponivel);
    await barramento.conectar();
    expect(await barramento.verificar()).toBe(true);
    await barramento.encerrar();
    expect(await barramento.verificar()).toBe(false);
  });

  it('consulta: responde com cópia, expira sem respondente e deixa de responder sob demanda', async () => {
    const barramento = new BarramentoEmMemoria();
    await barramento.responder('rpc', async (pedido) => ({ recebido: pedido }));
    expect(await barramento.consultar('rpc', { a: undefined, b: 1 }, 100)).toEqual({ recebido: { b: 1 } });
    await barramento.responder('nulo', async () => undefined);
    expect(await barramento.consultar('nulo', undefined, 100)).toBeNull();
    barramento.pararDeResponder('rpc');
    await expect(barramento.consultar('rpc', {}, 5)).rejects.toThrow('Sem resposta de rpc em 5ms');
  });
});

describe('Protocolo RPC, ClienteRpc e ServidorRpc', () => {
  it('lê o pedido, monta sucesso e falha e abre a resposta', () => {
    expect(lerPedido({ operacao: 'listar', dados: { ids: [] } })).toEqual({ operacao: 'listar', dados: { ids: [] } });
    expect(sucesso(undefined)).toEqual({ ok: true, resultado: null });
    expect(falha(new ErroNaoEncontrado('sumiu'))).toEqual({ ok: false, erro: { codigo: 'NAO_ENCONTRADO', codigoHttp: 404, mensagem: 'sumiu' } });
    expect(falha(new Error('segredo interno'))).toEqual({ ok: false, erro: FALHA_INTERNA });
    expect(abrirResposta({ ok: true, resultado: [1] })).toEqual([1]);
    const erro = (() => {
      try {
        return abrirResposta({ ok: false, erro: { codigo: 'X', codigoHttp: 409, mensagem: 'conflito' } });
      } catch (e) {
        return e;
      }
    })();
    expect(erro).toBeInstanceOf(ErroRemoto);
    expect(erro).toMatchObject({ codigo: 'X', codigoHttp: 409, message: 'conflito', name: 'ErroRemoto' });
    expect(() => abrirResposta(null)).toThrow(ErroMensagemInvalida);
  });

  it('cliente e servidor conversam pelo barramento; erros viram respostas tipadas e são registrados', async () => {
    const barramento = new BarramentoEmMemoria();
    const log = logger();
    const servidor = new ServidorRpc(
      barramento,
      'consulta',
      {
        somar: async (dados) => numero(objeto(dados, 'dados'), 'a') + 1,
        explodir: async () => {
          throw new Error('banco caiu');
        },
      },
      log,
    );
    await servidor.iniciar();
    const cliente = new ClienteRpc(barramento, 'consulta', 100);
    expect(await cliente.chamar('somar', { a: 41 })).toBe(42);
    await expect(cliente.chamar('somar', { a: 'x' })).rejects.toMatchObject({ codigo: 'MENSAGEM_INVALIDA', codigoHttp: 422 });
    await expect(cliente.chamar('explodir', {})).rejects.toMatchObject({ codigo: 'ERRO_INTERNO', codigoHttp: 500 });
    await expect(cliente.chamar('nada', {})).rejects.toThrow('Operação "nada" não existe em consulta');
    expect(await servidor.atender('sem formato')).toMatchObject({ ok: false, erro: { codigo: 'MENSAGEM_INVALIDA' } });
    expect(log.warn).toHaveBeenCalledTimes(4);
  });
});

describe('leitorJson', () => {
  const fonte = { t: 'a', n: 1, b: true, d: '2026-01-01T00:00:00.000Z', l: ['x'], nulo: null, ruim: 'não-é-data', op: 'B', ops: ['A', 'B'] };
  it('lê valores válidos', () => {
    expect([texto(fonte, 't'), numero(fonte, 'n'), booleano(fonte, 'b'), data(fonte, 'd').toISOString(), textos(fonte, 'l')]).toEqual([
      'a',
      1,
      true,
      '2026-01-01T00:00:00.000Z',
      ['x'],
    ]);
    expect([textoOuNulo(fonte, 'nulo'), textoOuNulo(fonte, 'ausente'), textoOuNulo(fonte, 't')]).toEqual([null, null, 'a']);
    expect([opcao(fonte, 'op', ['A', 'B']), opcoesDe(fonte, 'ops', ['A', 'B'])]).toEqual(['B', ['A', 'B']]);
    expect(lista([1], 'l')).toEqual([1]);
  });

  it('rejeita formatos errados com ErroMensagemInvalida', () => {
    for (const ler of [
      () => objeto([], 'o'),
      () => objeto(null, 'o'),
      () => lista({}, 'l'),
      () => texto(fonte, 'n'),
      () => numero(fonte, 't'),
      () => booleano(fonte, 't'),
      () => data(fonte, 'ruim'),
      () => textos({ l: [1] }, 'l'),
      () => opcao(fonte, 'op', ['A']),
    ]) {
      expect(ler).toThrow(ErroMensagemInvalida);
    }
  });
});
