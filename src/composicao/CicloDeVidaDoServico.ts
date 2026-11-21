import type { FastifyInstance } from 'fastify';
import { comRetentativas, RETENTATIVAS_PADRAO, type OpcoesDeRetentativa } from '../compartilhado/comRetentativas';
import type { BarramentoDeMensagens } from '../domain/ports/BarramentoDeMensagens';
import type { RecursoDeBanco } from '../repositories/BancoPrisma';

export interface DependenciasDoCiclo {
  readonly nome: string;
  readonly app: FastifyInstance;
  readonly banco: RecursoDeBanco;
  readonly barramento: BarramentoDeMensagens;
  readonly aoIniciar: () => Promise<void>;
  readonly aoEncerrar?: () => Promise<void>;
  readonly retentativas?: Partial<OpcoesDeRetentativa>;
}

export class CicloDeVidaDoServico {
  private readonly retentativas: OpcoesDeRetentativa;

  constructor(private readonly deps: DependenciasDoCiclo) {
    this.retentativas = { ...RETENTATIVAS_PADRAO, ...deps.retentativas };
  }

  get app(): FastifyInstance {
    return this.deps.app;
  }

  get nome(): string {
    return this.deps.nome;
  }

  async iniciar(): Promise<void> {
    await this.conectar('banco', () => this.deps.banco.conectar());
    await this.conectar('rabbitmq', () => this.deps.barramento.conectar());
    await this.deps.aoIniciar();
    this.deps.app.log.info({ servico: this.deps.nome }, 'serviço iniciado');
  }

  async encerrar(): Promise<void> {
    await this.deps.app.close();
    await this.deps.aoEncerrar?.();
    await this.deps.barramento.encerrar();
    await this.deps.banco.desconectar();
  }

  private conectar(recurso: string, acao: () => Promise<void>): Promise<void> {
    return comRetentativas(acao, {
      ...this.retentativas,
      aoFalhar: (erro, tentativa, esperaMs) => this.deps.app.log.warn({ err: erro, recurso, tentativa, esperaMs }, 'falha ao conectar; nova tentativa'),
    });
  }
}
