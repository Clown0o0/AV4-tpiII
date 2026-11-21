import { EventEmitter } from 'node:events';
import type { ConsumeMessage, Options } from 'amqplib';
import { connect } from 'amqplib';
import { BarramentoAmqp, conectarComAmqplib, type CanalAmqp, type ConexaoAmqp } from '../../../src/mensageria/BarramentoAmqp';
import { ErroServicoIndisponivel } from '../../../src/mensageria/ErroServicoIndisponivel';

jest.mock('amqplib', () => ({ connect: jest.fn() }));

type AoReceber = (mensagem: ConsumeMessage | null) => void;

class CanalFalso extends EventEmitter {
  readonly enviadas: Array<{ fila: string; conteudo: unknown; opcoes: Options.Publish }> = [];
  readonly consumidores = new Map<string, AoReceber>();
  readonly confirmadas: ConsumeMessage[] = [];
  readonly rejeitadas: Array<{ mensagem: ConsumeMessage; requeue: boolean | undefined }> = [];
  readonly declaradas: Array<{ fila: string; opcoes: Options.AssertQueue | undefined }> = [];
  readonly canceladas: string[] = [];
  falharConfirmacao = false;
  aoEnviar: (fila: string, conteudo: unknown, opcoes: Options.Publish) => void = () => undefined;
  private filasTemporarias = 0;
  prefetchDefinido = 0;

  assertQueue = jest.fn(async (fila: string, opcoes?: Options.AssertQueue) => {
    const nome = fila === '' ? `amq.gen-${++this.filasTemporarias}` : fila;
    this.declaradas.push({ fila: nome, opcoes });
    return { queue: nome, messageCount: 0, consumerCount: 0 };
  });

  sendToQueue = jest.fn((fila: string, conteudo: Buffer, opcoes: Options.Publish, confirmar: (erro: unknown) => void) => {
    const lido: unknown = JSON.parse(conteudo.toString('utf8'));
    this.enviadas.push({ fila, conteudo: lido, opcoes });
    setImmediate(() => confirmar(this.falharConfirmacao ? new Error('nack') : null));
    this.aoEnviar(fila, lido, opcoes);
    return true;
  });

  consume = jest.fn(async (fila: string, aoReceber: AoReceber, _opcoes?: Options.Consume) => {
    const consumerTag = `tag-${fila}`;
    this.consumidores.set(fila, aoReceber);
    return { consumerTag };
  });

  ack = jest.fn((mensagem: ConsumeMessage) => {
    this.confirmadas.push(mensagem);
  });

  nack = jest.fn((mensagem: ConsumeMessage, _todas?: boolean, requeue?: boolean) => {
    this.rejeitadas.push({ mensagem, requeue });
  });

  cancel = jest.fn(async (tag: string) => {
    this.canceladas.push(tag);
    return {};
  });

  prefetch = jest.fn(async (quantidade: number) => {
    this.prefetchDefinido = quantidade;
    return {};
  });

  close = jest.fn(async () => undefined);

  entregar(fila: string, conteudo: unknown, propriedades: Partial<ConsumeMessage['properties']> = {}, redelivered = false): ConsumeMessage {
    const mensagem = mensagemCom(Buffer.from(typeof conteudo === 'string' ? conteudo : JSON.stringify(conteudo)), propriedades, redelivered);
    this.consumidores.get(fila)?.(mensagem);
    return mensagem;
  }
}

class ConexaoFalsa extends EventEmitter {
  constructor(readonly canal: CanalFalso) {
    super();
  }

  createConfirmChannel = jest.fn(async () => this.canal as unknown as CanalAmqp);
  close = jest.fn(async () => undefined);
}

function mensagemCom(content: Buffer, propriedades: Partial<ConsumeMessage['properties']>, redelivered: boolean): ConsumeMessage {
  return {
    content,
    fields: { deliveryTag: 1, redelivered, exchange: '', routingKey: 'fila', consumerTag: 'tag' },
    properties: { headers: {}, ...propriedades } as ConsumeMessage['properties'],
  };
}

function logger() {
  return { info: jest.fn(), warn: jest.fn(), error: jest.fn() };
}

const aguardar = (): Promise<void> => new Promise((resolve) => setImmediate(resolve));

function montar(opcoes: { conexoes?: ConexaoFalsa[]; falhasAntes?: number } = {}) {
  const conexoes = opcoes.conexoes ?? [new ConexaoFalsa(new CanalFalso())];
  let falhas = opcoes.falhasAntes ?? 0;
  let indice = 0;
  const conectar = jest.fn(async (): Promise<ConexaoAmqp> => {
    if (falhas > 0) {
      falhas -= 1;
      throw new Error('ECONNREFUSED');
    }
    const conexao = conexoes[Math.min(indice++, conexoes.length - 1)];
    if (!conexao) throw new Error('sem conexão falsa');
    return conexao;
  });
  const log = logger();
  const barramento = new BarramentoAmqp({ url: 'amqp://guest:guest@cinebridge-mq:5672', logger: log, conectar, esperaInicialMs: 5, esperaMaximaMs: 20 });
  return { barramento, conexoes, conectar, log, canal: conexoes[0]?.canal ?? new CanalFalso() };
}

describe('BarramentoAmqp (amqplib mockado)', () => {
  it('o conector padrão usa amqplib.connect com a URL', async () => {
    jest.mocked(connect).mockResolvedValueOnce(new ConexaoFalsa(new CanalFalso()) as never);
    await conectarComAmqplib('amqp://x');
    expect(connect).toHaveBeenCalledWith('amqp://x');
  });

  it('conecta com canal de confirmação e prefetch; antes disso fica indisponível', async () => {
    const { barramento, canal } = montar();
    expect(await barramento.verificar()).toBe(false);
    await expect(barramento.publicar('fila', {})).rejects.toBeInstanceOf(ErroServicoIndisponivel);
    await barramento.conectar();
    expect(await barramento.verificar()).toBe(true);
    expect(canal.prefetchDefinido).toBe(50);
  });

  it('publica em fila durável, mensagem persistente em JSON e espera a confirmação do broker', async () => {
    const { barramento, canal } = montar();
    await barramento.conectar();
    await barramento.publicar('eventos-projetos', { nome: 'projeto.criado' });
    await barramento.publicar('eventos-projetos', { nome: 'projeto.atualizado' });
    expect(canal.declaradas).toEqual([{ fila: 'eventos-projetos', opcoes: { durable: true } }]);
    expect(canal.enviadas[0]).toEqual({ fila: 'eventos-projetos', conteudo: { nome: 'projeto.criado' }, opcoes: { persistent: true, contentType: 'application/json' } });
    canal.falharConfirmacao = true;
    await expect(barramento.publicar('eventos-projetos', null)).rejects.toBeInstanceOf(ErroServicoIndisponivel);
  });

  it('consumidor confirma (ack) após tratar; na falha devolve à fila uma vez e descarta na reentrega', async () => {
    const { barramento, canal, log } = montar();
    await barramento.conectar();
    const recebidas: unknown[] = [];
    await barramento.consumir('eventos-recomendacoes', async (conteudo) => {
      if (conteudo === 'quebra') throw new Error('falhou');
      recebidas.push(conteudo);
    });
    expect(canal.declaradas[0]).toEqual({ fila: 'eventos-recomendacoes', opcoes: { durable: true } });
    expect(canal.consume.mock.calls[0]?.[2]).toEqual({ noAck: false });

    const ok = canal.entregar('eventos-recomendacoes', { a: 1 });
    canal.entregar('eventos-recomendacoes', 'quebra');
    canal.entregar('eventos-recomendacoes', 'quebra', {}, true);
    canal.entregar('eventos-recomendacoes', '{json inválido');
    canal.consumidores.get('eventos-recomendacoes')?.(null);
    await aguardar();

    expect(recebidas).toEqual([{ a: 1 }]);
    expect(canal.confirmadas).toEqual([ok]);
    expect(canal.rejeitadas.map((r) => r.requeue)).toEqual([true, false, true]);
    expect(log.error).toHaveBeenCalled();
  });

  it('servidor RPC responde na fila replyTo com o mesmo correlationId e então confirma', async () => {
    const { barramento, canal } = montar();
    await barramento.conectar();
    await barramento.responder('consulta-profissionais', async (pedido) => ({ eco: pedido }));
    const pedido = canal.entregar('consulta-profissionais', { operacao: 'listar' }, { replyTo: 'amq.gen-x', correlationId: 'c-1' });
    const semRetorno = canal.entregar('consulta-profissionais', { operacao: 'listar' });
    await aguardar();
    await aguardar();
    expect(canal.enviadas).toEqual([
      { fila: 'amq.gen-x', conteudo: { eco: { operacao: 'listar' } }, opcoes: { correlationId: 'c-1', contentType: 'application/json' } },
    ]);
    expect(canal.confirmadas).toHaveLength(2);
    expect(canal.confirmadas).toEqual(expect.arrayContaining([pedido, semRetorno]));
    canal.entregar('consulta-profissionais', 'x{');
    canal.consumidores.get('consulta-profissionais')?.(null);
    await aguardar();
    expect(canal.rejeitadas.map((r) => r.requeue)).toEqual([false]);
  });

  it('cliente RPC cria fila de retorno exclusiva e única, ignora respostas de outra correlação e cancela no fim', async () => {
    const { barramento, canal } = montar();
    await barramento.conectar();
    canal.aoEnviar = (fila, _conteudo, opcoes) => {
      if (fila !== 'consulta-projetos' || typeof opcoes.replyTo !== 'string') return;
      const retorno = opcoes.replyTo;
      setImmediate(() => {
        canal.entregar(retorno, { ok: false }, { correlationId: 'outra' });
        canal.entregar(retorno, { ok: true, resultado: 42 }, { correlationId: opcoes.correlationId });
      });
    };
    const resultados = await Promise.all([barramento.consultar('consulta-projetos', { operacao: 'buscar' }, 500), barramento.consultar('consulta-projetos', {}, 500)]);
    expect(resultados).toEqual([{ ok: true, resultado: 42 }, { ok: true, resultado: 42 }]);
    const temporarias = canal.declaradas.filter((d) => d.fila.startsWith('amq.gen-'));
    expect(temporarias.map((d) => d.fila)).toEqual(['amq.gen-1', 'amq.gen-2']);
    expect(temporarias[0]?.opcoes).toEqual({ exclusive: true, autoDelete: true, durable: false });
    const envio = canal.enviadas.find((e) => e.fila === 'consulta-projetos');
    expect(envio?.opcoes).toMatchObject({ persistent: true, replyTo: 'amq.gen-1', expiration: '500' });
    expect(typeof envio?.opcoes.correlationId).toBe('string');
    expect(canal.canceladas).toEqual(['tag-amq.gen-1', 'tag-amq.gen-2']);
  });

  it('cliente RPC sem resposta no prazo falha com ErroServicoIndisponivel; resposta ilegível vira null', async () => {
    const { barramento, canal } = montar();
    await barramento.conectar();
    await expect(barramento.consultar('consulta-profissionais', {}, 10)).rejects.toThrow('Sem resposta de consulta-profissionais em 10ms');
    canal.aoEnviar = (_fila, _conteudo, opcoes) => {
      const retorno = opcoes.replyTo;
      if (typeof retorno === 'string') setImmediate(() => canal.entregar(retorno, '{ruim', { correlationId: opcoes.correlationId }));
    };
    expect(await barramento.consultar('consulta-profissionais', {}, 500)).toBeNull();
  });

  it('ao perder a conexão fica indisponível, reconecta com backoff e refaz as inscrições', async () => {
    const primeira = new ConexaoFalsa(new CanalFalso());
    const segunda = new ConexaoFalsa(new CanalFalso());
    const { barramento, conectar, log } = montar({ conexoes: [primeira, segunda] });
    await barramento.conectar();
    await barramento.consumir('eventos-projetos', async () => undefined);
    await barramento.responder('consulta-projetos', async () => null);
    primeira.emit('error', new Error('socket'));
    conectar.mockRejectedValueOnce(new Error('ainda fora'));
    primeira.emit('close');
    primeira.emit('close');
    expect(await barramento.verificar()).toBe(false);
    await new Promise((resolve) => setTimeout(resolve, 60));
    expect(await barramento.verificar()).toBe(true);
    expect([...segunda.canal.consumidores.keys()]).toEqual(['eventos-projetos', 'consulta-projetos']);
    expect(log.warn).toHaveBeenCalledWith(expect.objectContaining({ esperaMs: 5 }), expect.any(String));
    segunda.canal.emit('error', new Error('canal'));
    expect(log.warn).toHaveBeenCalledWith(expect.anything(), 'erro no canal do RabbitMQ');
    await barramento.encerrar();
  });

  it('encerrar fecha a conexão e impede novas reconexões', async () => {
    const { barramento, conexoes, conectar } = montar();
    await barramento.conectar();
    await barramento.encerrar();
    expect(conexoes[0]?.close).toHaveBeenCalled();
    expect(await barramento.verificar()).toBe(false);
    conexoes[0]?.emit('close');
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(conectar).toHaveBeenCalledTimes(1);
    await barramento.encerrar();
  });

  it('falha de conexão na subida propaga o erro para o laço de retentativas', async () => {
    const { barramento } = montar({ falhasAntes: 1 });
    await expect(barramento.conectar()).rejects.toThrow('ECONNREFUSED');
    await barramento.conectar();
    expect(await barramento.verificar()).toBe(true);
  });
});
