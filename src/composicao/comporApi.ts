import type { FastifyBaseLogger, FastifyServerOptions } from 'fastify';
import { AdaptadorPorMensagens } from '../adaptadores/profissional/AdaptadorPorMensagens';
import { construirApp } from '../app';
import type { OpcoesDeRetentativa } from '../compartilhado/comRetentativas';
import type { BarramentoDeMensagens } from '../domain/ports/BarramentoDeMensagens';
import type { ConviteRepository } from '../domain/ports/ConviteRepository';
import type { RecomendacaoRepository } from '../domain/ports/RecomendacaoRepository';
import { AuditoriaObservador } from '../events/observadores/AuditoriaObservador';
import { FinalizacaoDeProjetoObservador } from '../events/observadores/FinalizacaoDeProjetoObservador';
import { PublicadorEmFilaObservador } from '../events/observadores/PublicadorEmFilaObservador';
import { RecomendacaoEventEmitter } from '../events/RecomendacaoEventEmitter';
import { RegistroFabricas } from '../factories/RegistroFabricas';
import { ClienteRpc } from '../mensageria/ClienteRpc';
import { FILAS } from '../mensageria/filas';
import type { LoggerDeServico } from '../mensageria/LoggerDeServico';
import type { RecursoDeBanco } from '../repositories/BancoPrisma';
import { ProjetoRepositoryPorMensagens } from '../repositories/ProjetoRepositoryPorMensagens';
import { RepositorioDeProjetosComposto } from '../repositories/RepositorioDeProjetosComposto';
import { VerificadorDeSaude } from '../saude/VerificadorDeSaude';
import type { OpcoesFonteResiliente } from '../services/FonteProfissionaisResiliente';
import type { Relogio } from '../services/contratos';
import type { SistemaRecomendacao } from '../services/SistemaRecomendacao';
import { PoliticaDeDecoradores } from '../strategies/decoradores/PoliticaDeDecoradores';
import { RegistroDeAuditoriaNoLogger } from '../strategies/decoradores/RegistroDeAuditoriaNoLogger';
import { CicloDeVidaDoServico } from './CicloDeVidaDoServico';
import type { Configuracao, ConfiguracaoDeMensageria } from './configuracao';
import { criarSistemaRecomendacao } from './criarSistemaRecomendacao';

export interface InfraestruturaDaApi {
  configuracao: Configuracao;
  mensageria: ConfiguracaoDeMensageria;
  banco: RecursoDeBanco;
  recomendacoes: RecomendacaoRepository & ConviteRepository;
  criarBarramento: (logger: LoggerDeServico) => BarramentoDeMensagens;
  logger?: FastifyServerOptions['logger'];
  relogio?: Relogio;
  retentativas?: Partial<OpcoesDeRetentativa>;
}

export function comporApi(infra: InfraestruturaDaApi): CicloDeVidaDoServico {
  let montado: MontagemDaApi | undefined;
  const app = construirApp({
    logger: infra.logger ?? { level: infra.configuracao.nivelLog },
    saude: new VerificadorDeSaude({ banco: () => infra.banco.verificar(), mensageria: () => barramento.verificar() }),
    montarServico: (logger) => {
      montado = montarApi(infra, logger);
      return montado.servico;
    },
  });
  const { servico, eventos, barramento } = exigirMontagem(montado);
  return new CicloDeVidaDoServico({
    nome: 'api',
    app,
    banco: infra.banco,
    barramento,
    aoIniciar: () => servico.iniciarCatalogo(),
    aoEncerrar: async () => {
      servico.encerrarCatalogo();
      await eventos.aguardarPendentes();
    },
    ...(infra.retentativas ? { retentativas: infra.retentativas } : {}),
  });
}

interface MontagemDaApi {
  servico: SistemaRecomendacao;
  eventos: RecomendacaoEventEmitter;
  barramento: BarramentoDeMensagens;
}

function montarApi(infra: InfraestruturaDaApi, logger: FastifyBaseLogger): MontagemDaApi {
  const { configuracao, mensageria } = infra;
  const barramento = infra.criarBarramento(logger);
  const fabricas = RegistroFabricas.padrao({ logger });
  const projetos = new ProjetoRepositoryPorMensagens(new ClienteRpc(barramento, FILAS.CONSULTA_PROJETOS, mensageria.mensagensTimeoutMs), fabricas);
  const eventos = new RecomendacaoEventEmitter((erro, evento, observador) => logger.error({ err: erro, evento, observador }, 'falha em observador')).registrar(
    new AuditoriaObservador(logger),
    new PublicadorEmFilaObservador(barramento, FILAS.EVENTOS_RECOMENDACOES),
    new FinalizacaoDeProjetoObservador(projetos),
    ...fabricas.todas().map((fabrica) => fabrica.criarNotificador()),
  );
  const servico = criarSistemaRecomendacao({
    projetos: new RepositorioDeProjetosComposto(projetos, infra.recomendacoes),
    eventos,
    fabricas,
    provedores: configuracao.provedores,
    adaptadores: { profissional: new AdaptadorPorMensagens(new ClienteRpc(barramento, FILAS.CONSULTA_PROFISSIONAIS, mensageria.mensagensTimeoutMs)) },
    politicaDeDecoradores: new PoliticaDeDecoradores(configuracao.decoradores, configuracao.decoradoresPorProdutor),
    registroDeAuditoria: new RegistroDeAuditoriaNoLogger(logger),
    opcoesFonte: opcoesDaFonte(logger, configuracao),
    ...(infra.relogio ? { relogio: infra.relogio } : {}),
  });
  return { servico, eventos, barramento };
}

function opcoesDaFonte(logger: FastifyBaseLogger, configuracao: Configuracao): Partial<OpcoesFonteResiliente> {
  return {
    timeoutMs: configuracao.profissionaisTimeoutMs,
    ttlMs: configuracao.catalogoTtlMs,
    aoFalhar: (erro, operacao) => logger.warn({ err: erro, operacao }, 'serviço de profissionais indisponível; usando fallback'),
  };
}

function exigirMontagem<T>(montado: T | undefined): T {
  if (montado === undefined) throw new TypeError('A API não montou o sistema de recomendação');
  return montado;
}
