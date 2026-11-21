import { randomUUID } from 'node:crypto';
import { connect, type ConfirmChannel, type ConsumeMessage, type Options } from 'amqplib';
import type { BarramentoDeMensagens, TratadorDeConsulta, TratadorDeMensagem } from '../domain/ports/BarramentoDeMensagens';
import { ErroServicoIndisponivel } from './ErroServicoIndisponivel';
import type { LoggerDeServico } from './LoggerDeServico';

export type CanalAmqp = Pick<ConfirmChannel, 'assertQueue' | 'sendToQueue' | 'consume' | 'ack' | 'nack' | 'cancel' | 'prefetch' | 'close' | 'on'>;

export interface ConexaoAmqp {
  createConfirmChannel(): Promise<CanalAmqp>;
  close(): Promise<void>;
  on(evento: 'close' | 'error', ouvinte: (erro?: unknown) => void): unknown;
}

export type ConectorAmqp = (url: string) => Promise<ConexaoAmqp>;

export interface OpcoesBarramentoAmqp {
  url: string;
  logger: LoggerDeServico;
  conectar?: ConectorAmqp;
  prefetch?: number;
  esperaInicialMs?: number;
  esperaMaximaMs?: number;
}

type Inscricao = (canal: CanalAmqp) => Promise<void>;

const FILA_DURAVEL: Options.AssertQueue = { durable: true };
const FILA_DE_RETORNO: Options.AssertQueue = { exclusive: true, autoDelete: true, durable: false };
const TIPO_JSON = 'application/json';

export const conectarComAmqplib: ConectorAmqp = (url) => connect(url);

export class BarramentoAmqp implements BarramentoDeMensagens {
  private conexao: ConexaoAmqp | undefined;
  private canal: CanalAmqp | undefined;
  private readonly inscricoes: Inscricao[] = [];
  private readonly filasDeclaradas = new Set<string>();
  private reconexao: NodeJS.Timeout | undefined;
  private esperaAtualMs: number;
  private encerrado = false;
  private readonly conectarNoBroker: ConectorAmqp;
  private readonly prefetch: number;
  private readonly esperaInicialMs: number;
  private readonly esperaMaximaMs: number;

  constructor(private readonly opcoes: OpcoesBarramentoAmqp) {
    this.conectarNoBroker = opcoes.conectar ?? conectarComAmqplib;
    this.prefetch = opcoes.prefetch ?? 50;
    this.esperaInicialMs = opcoes.esperaInicialMs ?? 1000;
    this.esperaMaximaMs = opcoes.esperaMaximaMs ?? 30000;
    this.esperaAtualMs = this.esperaInicialMs;
  }

  async conectar(): Promise<void> {
    const conexao = await this.conectarNoBroker(this.opcoes.url);
    const canal = await conexao.createConfirmChannel();
    await canal.prefetch(this.prefetch);
    conexao.on('error', (erro) => this.opcoes.logger.warn({ err: erro }, 'erro na conexão com o RabbitMQ'));
    conexao.on('close', () => this.aoPerderConexao(conexao));
    canal.on('close', () => this.aoPerderConexao(conexao));
    canal.on('error', (erro: unknown) => this.opcoes.logger.warn({ err: erro }, 'erro no canal do RabbitMQ'));
    this.filasDeclaradas.clear();
    this.conexao = conexao;
    this.canal = canal;
    this.esperaAtualMs = this.esperaInicialMs;
    for (const inscrever of this.inscricoes) await inscrever(canal);
    this.opcoes.logger.info({ inscricoes: this.inscricoes.length }, 'conectado ao RabbitMQ');
  }

  async publicar(fila: string, conteudo: unknown): Promise<void> {
    const canal = await this.canalComFila(fila);
    await enviarConfirmado(canal, fila, conteudo, { persistent: true });
  }

  consumir(fila: string, tratador: TratadorDeMensagem): Promise<void> {
    return this.inscrever(async (canal) => {
      await this.declarar(canal, fila);
      await canal.consume(fila, (mensagem) => void this.tratarMensagem(canal, mensagem, tratador), { noAck: false });
    });
  }

  responder(fila: string, tratador: TratadorDeConsulta): Promise<void> {
    return this.inscrever(async (canal) => {
      await this.declarar(canal, fila);
      await canal.consume(fila, (mensagem) => void this.tratarConsulta(canal, mensagem, tratador), { noAck: false });
    });
  }

  async consultar(fila: string, pedido: unknown, timeoutMs: number): Promise<unknown> {
    const canal = await this.canalComFila(fila);
    const { queue: filaDeRetorno } = await canal.assertQueue('', FILA_DE_RETORNO);
    const correlationId = randomUUID();
    let temporizador: NodeJS.Timeout | undefined;
    let consumidor: string | undefined;
    let entregar: (valor: unknown) => void = () => undefined;
    const resposta = new Promise<unknown>((resolve, rejeitar) => {
      entregar = resolve;
      temporizador = setTimeout(() => rejeitar(new ErroServicoIndisponivel(`Sem resposta de ${fila} em ${timeoutMs}ms`)), timeoutMs);
    });
    resposta.catch(() => undefined);
    try {
      const inscricao = await canal.consume(filaDeRetorno, (mensagem) => {
        if (mensagem?.properties.correlationId === correlationId) entregar(lerConteudoOuNulo(mensagem));
      }, { noAck: true });
      consumidor = inscricao.consumerTag;
      await enviarConfirmado(canal, fila, pedido, { persistent: true, correlationId, replyTo: filaDeRetorno, expiration: String(timeoutMs) });
      return await resposta;
    } finally {
      clearTimeout(temporizador);
      if (consumidor !== undefined) await canal.cancel(consumidor).catch(() => undefined);
    }
  }

  async verificar(): Promise<boolean> {
    return this.canal !== undefined;
  }

  async encerrar(): Promise<void> {
    this.encerrado = true;
    clearTimeout(this.reconexao);
    const conexao = this.conexao;
    this.canal = undefined;
    this.conexao = undefined;
    await conexao?.close().catch(() => undefined);
  }

  private async inscrever(inscricao: Inscricao): Promise<void> {
    this.inscricoes.push(inscricao);
    if (this.canal) await inscricao(this.canal);
  }

  private async canalComFila(fila: string): Promise<CanalAmqp> {
    const canal = this.canal;
    if (!canal) throw new ErroServicoIndisponivel('RabbitMQ indisponível');
    await this.declarar(canal, fila);
    return canal;
  }

  private async declarar(canal: CanalAmqp, fila: string): Promise<void> {
    if (this.filasDeclaradas.has(fila)) return;
    await canal.assertQueue(fila, FILA_DURAVEL);
    this.filasDeclaradas.add(fila);
  }

  private async tratarMensagem(canal: CanalAmqp, mensagem: ConsumeMessage | null, tratador: TratadorDeMensagem): Promise<void> {
    if (!mensagem) return;
    try {
      await tratador(lerConteudo(mensagem));
      canal.ack(mensagem);
    } catch (erro) {
      this.opcoes.logger.error({ err: erro, redelivered: mensagem.fields.redelivered }, 'falha ao tratar mensagem');
      canal.nack(mensagem, false, !mensagem.fields.redelivered);
    }
  }

  private async tratarConsulta(canal: CanalAmqp, mensagem: ConsumeMessage | null, tratador: TratadorDeConsulta): Promise<void> {
    if (!mensagem) return;
    const { replyTo, correlationId } = mensagem.properties;
    try {
      const resposta = await tratador(lerConteudo(mensagem));
      if (typeof replyTo === 'string') await enviarConfirmado(canal, replyTo, resposta, { correlationId });
      canal.ack(mensagem);
    } catch (erro) {
      this.opcoes.logger.error({ err: erro }, 'falha ao responder consulta');
      canal.nack(mensagem, false, false);
    }
  }

  private aoPerderConexao(conexao: ConexaoAmqp): void {
    if (this.conexao !== conexao) return;
    this.conexao = undefined;
    this.canal = undefined;
    void conexao.close().catch(() => undefined);
    if (this.encerrado) return;
    this.opcoes.logger.warn({ esperaMs: this.esperaAtualMs }, 'conexão com o RabbitMQ perdida; reconectando');
    this.agendarReconexao();
  }

  private agendarReconexao(): void {
    const espera = this.esperaAtualMs;
    this.esperaAtualMs = Math.min(this.esperaAtualMs * 2, this.esperaMaximaMs);
    this.reconexao = setTimeout(() => void this.reconectar(), espera);
    this.reconexao.unref();
  }

  private async reconectar(): Promise<void> {
    if (this.encerrado) return;
    try {
      await this.conectar();
    } catch (erro) {
      this.opcoes.logger.warn({ err: erro }, 'nova tentativa de conexão com o RabbitMQ falhou');
      this.agendarReconexao();
    }
  }
}

function lerConteudo(mensagem: ConsumeMessage): unknown {
  return JSON.parse(mensagem.content.toString('utf8'));
}

function lerConteudoOuNulo(mensagem: ConsumeMessage): unknown {
  try {
    return lerConteudo(mensagem);
  } catch {
    return null;
  }
}

function enviarConfirmado(canal: CanalAmqp, fila: string, conteudo: unknown, propriedades: Options.Publish): Promise<void> {
  return new Promise((resolve, rejeitar) => {
    canal.sendToQueue(fila, Buffer.from(JSON.stringify(conteudo ?? null)), { ...propriedades, contentType: TIPO_JSON }, (erro: unknown) =>
      erro ? rejeitar(new ErroServicoIndisponivel('RabbitMQ não confirmou a mensagem')) : resolve(),
    );
  });
}
