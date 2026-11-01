// submarino
import { PrismaClient } from '@prisma/client';
import type { FastifyBaseLogger } from 'fastify';
import { construirApp } from './app';
import { RecomendacaoEventEmitter } from './events/RecomendacaoEventEmitter';
import { AuditoriaObservador } from './events/observadores/AuditoriaObservador';
import { EmailObservador } from './events/observadores/EmailObservador';
import { MensagemInternaObservador } from './events/observadores/MensagemInternaObservador';
import { RegistroFabricas } from './factories/RegistroFabricas';
import { PrismaProfissionalRepository } from './repositories/PrismaProfissionalRepository';
import { PrismaProjetoRepository } from './repositories/PrismaProjetoRepository';
import { criarSistemaRecomendacao } from './composicao/criarSistemaRecomendacao';
import { lerConfiguracao, lerOuEncerrar, type Configuracao } from './composicao/configuracao';
import type { OpcoesFonteResiliente } from './services/FonteProfissionaisResiliente';
import type { SistemaRecomendacao } from './services/SistemaRecomendacao';
import { PoliticaDeDecoradores } from './strategies/decoradores/PoliticaDeDecoradores';
import { RegistroDeAuditoriaNoLogger } from './strategies/decoradores/RegistroDeAuditoriaNoLogger';

try {
  process.loadEnvFile();
} catch {
}

const configuracao = lerOuEncerrar(() => lerConfiguracao(process.env));
const prisma = new PrismaClient();
let eventos: RecomendacaoEventEmitter | undefined;
let servico: SistemaRecomendacao | undefined;

const app = construirApp({
  logger: { level: configuracao.nivelLog },
  montarServico: (logger) => {
    const fabricas = RegistroFabricas.padrao({ logger });
    eventos = criarPublicadorDeEventos(logger, fabricas);
    servico = criarSistemaRecomendacao({
      profissionais: new PrismaProfissionalRepository(prisma),
      projetos: new PrismaProjetoRepository(prisma, fabricas),
      eventos,
      fabricas,
      provedores: configuracao.provedores,
      politicaDeDecoradores: new PoliticaDeDecoradores(configuracao.decoradores, configuracao.decoradoresPorProdutor),
      registroDeAuditoria: new RegistroDeAuditoriaNoLogger(logger),
      opcoesFonte: opcoesDaFonteDeProfissionais(logger, configuracao),
    });
    return servico;
  },
});

function criarPublicadorDeEventos(logger: FastifyBaseLogger, fabricas: RegistroFabricas): RecomendacaoEventEmitter {
  return new RecomendacaoEventEmitter((erro, evento, observador) =>
    logger.error({ err: erro, evento, observador }, 'falha em observador'),
  ).registrar(
    new EmailObservador(logger),
    new MensagemInternaObservador(logger),
    new AuditoriaObservador(logger),
    ...fabricas.todas().map((fabrica) => fabrica.criarNotificador()),
  );
}

function opcoesDaFonteDeProfissionais(logger: FastifyBaseLogger, config: Configuracao): Partial<OpcoesFonteResiliente> {
  return {
    timeoutMs: config.profissionaisTimeoutMs,
    ttlMs: config.catalogoTtlMs,
    aoFalhar: (erro, operacao) => logger.warn({ err: erro, operacao }, 'repositório de profissionais indisponível; usando fallback'),
  };
}

async function encerrar(sinal: string): Promise<void> {
  app.log.info({ sinal }, 'encerrando');
  servico?.encerrarCatalogo();
  await app.close();
  await eventos?.aguardarPendentes();
  await prisma.$disconnect();
  process.exit(0);
}

function encerrarPorFalha(erro: unknown, origem: string): void {
  app.log.fatal({ err: erro, origem }, 'falha não tratada; encerrando');
  setTimeout(() => process.exit(1), 3000).unref();
  servico?.encerrarCatalogo();
  void prisma.$disconnect().finally(() => process.exit(1));
}

process.on('SIGINT', () => void encerrar('SIGINT'));
process.on('SIGTERM', () => void encerrar('SIGTERM'));
process.on('unhandledRejection', (motivo) => encerrarPorFalha(motivo, 'unhandledRejection'));
process.on('uncaughtException', (erro) => encerrarPorFalha(erro, 'uncaughtException'));

async function iniciar(): Promise<void> {
  await servico?.iniciarCatalogo();
  await app.listen({ port: configuracao.porta, host: configuracao.host });
  app.log.info({ provedores: configuracao.provedores, decoradores: configuracao.decoradores }, 'configuração ativa');
}

iniciar().catch(async (erro: unknown) => {
  app.log.error({ err: erro }, 'falha ao iniciar o servidor');
  await prisma.$disconnect();
  process.exit(1);
});
