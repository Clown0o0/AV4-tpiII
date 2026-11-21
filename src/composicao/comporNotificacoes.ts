import type { FastifyServerOptions } from 'fastify';
import type { OpcoesDeRetentativa } from '../compartilhado/comRetentativas';
import type { BarramentoDeMensagens } from '../domain/ports/BarramentoDeMensagens';
import type { NotificacaoRepository } from '../domain/ports/NotificacaoRepository';
import { FILAS } from '../mensageria/filas';
import type { LoggerDeServico } from '../mensageria/LoggerDeServico';
import { AlertaPersistidoObservador } from '../notificacoes/AlertaPersistidoObservador';
import { CentralDeNotificacoes } from '../notificacoes/CentralDeNotificacoes';
import { ConsumidorDeEventos } from '../notificacoes/ConsumidorDeEventos';
import { EmailSimuladoObservador } from '../notificacoes/EmailSimuladoObservador';
import { MensagemInternaSimuladaObservador } from '../notificacoes/MensagemInternaSimuladaObservador';
import type { RecursoDeBanco } from '../repositories/BancoPrisma';
import { construirAppDeSaude } from '../saude/construirAppDeSaude';
import { VerificadorDeSaude } from '../saude/VerificadorDeSaude';
import { CicloDeVidaDoServico } from './CicloDeVidaDoServico';

export interface InfraestruturaDeNotificacoes {
  banco: RecursoDeBanco;
  notificacoes: NotificacaoRepository;
  criarBarramento: (logger: LoggerDeServico) => BarramentoDeMensagens;
  logger?: FastifyServerOptions['logger'];
  retentativas?: Partial<OpcoesDeRetentativa>;
}

export const FILAS_DE_EVENTOS: readonly string[] = [FILAS.EVENTOS_PROJETOS, FILAS.EVENTOS_RECOMENDACOES];

export function comporNotificacoes(infra: InfraestruturaDeNotificacoes): CicloDeVidaDoServico {
  const app = construirAppDeSaude(
    new VerificadorDeSaude({ banco: () => infra.banco.verificar(), mensageria: () => barramento.verificar() }),
    infra.logger,
  );
  const barramento = infra.criarBarramento(app.log);
  const central = new CentralDeNotificacoes()
    .adicionar(new AlertaPersistidoObservador(infra.notificacoes))
    .adicionar(new EmailSimuladoObservador(app.log))
    .adicionar(new MensagemInternaSimuladaObservador(app.log));
  const consumidor = new ConsumidorDeEventos(barramento, central);
  return new CicloDeVidaDoServico({
    nome: 'notificacoes',
    app,
    banco: infra.banco,
    barramento,
    aoIniciar: () => consumidor.iniciar(FILAS_DE_EVENTOS),
    ...(infra.retentativas ? { retentativas: infra.retentativas } : {}),
  });
}
