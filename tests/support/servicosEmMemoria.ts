import { comporApi } from '../../src/composicao/comporApi';
import { comporNotificacoes } from '../../src/composicao/comporNotificacoes';
import { comporProfissionais } from '../../src/composicao/comporProfissionais';
import { comporProjetos } from '../../src/composicao/comporProjetos';
import type { CicloDeVidaDoServico } from '../../src/composicao/CicloDeVidaDoServico';
import { lerConfiguracao, type Ambiente } from '../../src/composicao/configuracao';
import type { Profissional } from '../../src/domain/entities/Profissional';
import type { Projeto } from '../../src/domain/entities/Projeto';
import type { CadastroDeProjetos } from '../../src/domain/ports/CadastroDeProjetos';
import type { NotificacaoRepository, RegistroDeNotificacao } from '../../src/domain/ports/NotificacaoRepository';
import { BarramentoEmMemoria } from '../../src/mensageria/BarramentoEmMemoria';
import type { RecursoDeBanco } from '../../src/repositories/BancoPrisma';
import { DATA_REFERENCIA, elencoCompleto } from './fixtures';
import { InMemoryProfissionalRepository, InMemoryProjetoRepository } from './InMemoryRepositories';

export class BancoEmMemoria implements RecursoDeBanco {
  disponivel = true;
  conexoes = 0;
  desconectado = false;

  async conectar(): Promise<void> {
    this.conexoes += 1;
  }

  async verificar(): Promise<boolean> {
    if (!this.disponivel) throw new Error('banco fora do ar');
    return true;
  }

  async desconectar(): Promise<void> {
    this.desconectado = true;
  }
}

export class InMemoryCadastroDeProjetos implements CadastroDeProjetos {
  readonly projetos = new Map<string, Projeto>();
  readonly finalizados = new Map<string, Date>();

  async salvar(projeto: Projeto): Promise<void> {
    this.projetos.set(projeto.id, projeto);
  }

  async buscarPorId(id: string): Promise<Projeto | null> {
    return this.projetos.get(id) ?? null;
  }

  async existe(id: string): Promise<boolean> {
    return this.projetos.has(id);
  }

  async finalizar(id: string, em: Date): Promise<boolean> {
    if (!this.projetos.has(id)) return false;
    this.finalizados.set(id, em);
    return true;
  }
}

export class InMemoryNotificacaoRepository implements NotificacaoRepository {
  readonly registros = new Map<string, RegistroDeNotificacao>();

  async salvar(notificacao: RegistroDeNotificacao): Promise<void> {
    if (!this.registros.has(notificacao.id)) this.registros.set(notificacao.id, notificacao);
  }

  eventos(): string[] {
    return [...this.registros.values()].map((registro) => registro.evento);
  }
}

export const SEM_ESPERA = { esperar: async (): Promise<void> => undefined };

export interface Malha {
  barramento: BarramentoEmMemoria;
  bancos: { api: BancoEmMemoria; profissionais: BancoEmMemoria; projetos: BancoEmMemoria; notificacoes: BancoEmMemoria };
  cadastroDeProfissionais: InMemoryProfissionalRepository;
  cadastroDeProjetos: InMemoryCadastroDeProjetos;
  recomendacoes: InMemoryProjetoRepository;
  notificacoes: InMemoryNotificacaoRepository;
  api: CicloDeVidaDoServico;
  profissionais: CicloDeVidaDoServico;
  projetos: CicloDeVidaDoServico;
  notificador: CicloDeVidaDoServico;
  iniciar(...servicos: CicloDeVidaDoServico[]): Promise<void>;
  sincronizar(): Promise<void>;
  encerrar(): Promise<void>;
}

export interface OpcoesDaMalha {
  elenco?: Profissional[];
  ambiente?: Ambiente;
  timeoutMs?: number;
}

export function montarMalha(opcoes: OpcoesDaMalha = {}): Malha {
  const barramento = new BarramentoEmMemoria();
  const criarBarramento = (): BarramentoEmMemoria => barramento;
  const bancos = { api: new BancoEmMemoria(), profissionais: new BancoEmMemoria(), projetos: new BancoEmMemoria(), notificacoes: new BancoEmMemoria() };
  const cadastroDeProfissionais = new InMemoryProfissionalRepository(opcoes.elenco ?? elencoCompleto());
  const cadastroDeProjetos = new InMemoryCadastroDeProjetos();
  const recomendacoes = new InMemoryProjetoRepository();
  const notificacoes = new InMemoryNotificacaoRepository();
  const configuracao = lerConfiguracao({
    DATABASE_URL: 'postgresql://teste:teste@recomendacoes-db:5432/recomendacoes',
    CATALOGO_TTL_MS: '0',
    PROFISSIONAIS_TIMEOUT_MS: '500',
    ...opcoes.ambiente,
  });
  const mensageria = { rabbitmqUrl: 'amqp://guest:guest@cinebridge-mq:5672', mensagensTimeoutMs: opcoes.timeoutMs ?? 200 };
  const api = comporApi({
    configuracao,
    mensageria,
    banco: bancos.api,
    recomendacoes,
    criarBarramento,
    logger: false,
    relogio: () => DATA_REFERENCIA,
    retentativas: SEM_ESPERA,
  });
  const profissionais = comporProfissionais({ banco: bancos.profissionais, cadastro: cadastroDeProfissionais, provedor: 'interno', criarBarramento, retentativas: SEM_ESPERA });
  const projetos = comporProjetos({ banco: bancos.projetos, criarCadastro: () => cadastroDeProjetos, criarBarramento, retentativas: SEM_ESPERA });
  const notificador = comporNotificacoes({ banco: bancos.notificacoes, notificacoes, criarBarramento, retentativas: SEM_ESPERA });
  return {
    barramento,
    bancos,
    cadastroDeProfissionais,
    cadastroDeProjetos,
    recomendacoes,
    notificacoes,
    api,
    profissionais,
    projetos,
    notificador,
    async iniciar(...servicos) {
      for (const servico of servicos.length > 0 ? servicos : [profissionais, projetos, notificador, api]) await servico.iniciar();
    },
    async sincronizar() {
      for (let rodada = 0; rodada < 20; rodada++) {
        await new Promise((resolve) => setImmediate(resolve));
        await barramento.aguardarEntregas();
      }
    },
    async encerrar() {
      for (const servico of [api, profissionais, projetos, notificador]) await servico.encerrar();
    },
  };
}
