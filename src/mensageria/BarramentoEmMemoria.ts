import type { BarramentoDeMensagens, TratadorDeConsulta, TratadorDeMensagem } from '../domain/ports/BarramentoDeMensagens';
import { ErroServicoIndisponivel } from './ErroServicoIndisponivel';

interface FilaEmMemoria {
  readonly mensagens: string[];
  readonly consumidores: TratadorDeMensagem[];
  proximo: number;
}

export class BarramentoEmMemoria implements BarramentoDeMensagens {
  private readonly filas = new Map<string, FilaEmMemoria>();
  private readonly respondentes = new Map<string, TratadorDeConsulta>();
  private readonly entregas = new Set<Promise<void>>();
  private readonly _rejeitadas: unknown[] = [];
  private disponivel = true;

  get rejeitadas(): readonly unknown[] {
    return [...this._rejeitadas];
  }

  pendentes(fila: string): number {
    return this.filas.get(fila)?.mensagens.length ?? 0;
  }

  pararDeResponder(fila: string): void {
    this.respondentes.delete(fila);
  }

  derrubar(): void {
    this.disponivel = false;
  }

  restaurar(): void {
    this.disponivel = true;
    for (const nome of this.filas.keys()) this.despachar(nome);
  }

  async conectar(): Promise<void> {
    this.restaurar();
  }

  async publicar(fila: string, conteudo: unknown): Promise<void> {
    this.exigirDisponivel();
    this.fila(fila).mensagens.push(JSON.stringify(conteudo));
    this.despachar(fila);
  }

  async consumir(fila: string, tratador: TratadorDeMensagem): Promise<void> {
    this.exigirDisponivel();
    this.fila(fila).consumidores.push(tratador);
    this.despachar(fila);
  }

  async responder(fila: string, tratador: TratadorDeConsulta): Promise<void> {
    this.exigirDisponivel();
    this.respondentes.set(fila, tratador);
  }

  async consultar(fila: string, pedido: unknown, timeoutMs: number): Promise<unknown> {
    this.exigirDisponivel();
    const respondente = this.respondentes.get(fila);
    let temporizador: NodeJS.Timeout | undefined;
    const limite = new Promise<never>((_, rejeitar) => {
      temporizador = setTimeout(() => rejeitar(new ErroServicoIndisponivel(`Sem resposta de ${fila} em ${timeoutMs}ms`)), timeoutMs);
    });
    const resposta = respondente ? respondente(copiar(pedido)).then(copiar) : limite;
    return Promise.race([resposta, limite]).finally(() => clearTimeout(temporizador));
  }

  async verificar(): Promise<boolean> {
    return this.disponivel;
  }

  async encerrar(): Promise<void> {
    await this.aguardarEntregas();
    this.disponivel = false;
  }

  async aguardarEntregas(): Promise<void> {
    while (this.entregas.size > 0) await Promise.allSettled([...this.entregas]);
  }

  private fila(nome: string): FilaEmMemoria {
    const existente = this.filas.get(nome);
    if (existente) return existente;
    const nova: FilaEmMemoria = { mensagens: [], consumidores: [], proximo: 0 };
    this.filas.set(nome, nova);
    return nova;
  }

  private despachar(nome: string): void {
    const fila = this.fila(nome);
    while (this.disponivel && fila.consumidores.length > 0 && fila.mensagens.length > 0) {
      const mensagem = fila.mensagens.shift();
      const consumidor = fila.consumidores[fila.proximo++ % fila.consumidores.length];
      if (mensagem !== undefined && consumidor) this.entregar(consumidor, mensagem);
    }
  }

  private entregar(consumidor: TratadorDeMensagem, mensagem: string): void {
    const conteudo: unknown = JSON.parse(mensagem);
    const entrega = new Promise<void>((resolve) => setImmediate(resolve))
      .then(() => consumidor(conteudo))
      .catch(() => {
        this._rejeitadas.push(conteudo);
      })
      .finally(() => this.entregas.delete(entrega));
    this.entregas.add(entrega);
  }

  private exigirDisponivel(): void {
    if (!this.disponivel) throw new ErroServicoIndisponivel('Barramento de mensagens indisponível');
  }
}

function copiar(valor: unknown): unknown {
  return JSON.parse(JSON.stringify(valor ?? null));
}
