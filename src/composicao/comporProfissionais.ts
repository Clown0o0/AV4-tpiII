import type { FastifyServerOptions } from 'fastify';
import type { OpcoesDeRetentativa } from '../compartilhado/comRetentativas';
import type { BarramentoDeMensagens } from '../domain/ports/BarramentoDeMensagens';
import type { ProfissionalRepository } from '../domain/ports/ProfissionalRepository';
import { FILAS } from '../mensageria/filas';
import type { LoggerDeServico } from '../mensageria/LoggerDeServico';
import { ServidorRpc } from '../mensageria/ServidorRpc';
import { OperacoesDeProfissionais } from '../profissionais/OperacoesDeProfissionais';
import type { RecursoDeBanco } from '../repositories/BancoPrisma';
import { construirAppDeSaude } from '../saude/construirAppDeSaude';
import { VerificadorDeSaude } from '../saude/VerificadorDeSaude';
import { CicloDeVidaDoServico } from './CicloDeVidaDoServico';
import type { ProvedorProfissionais } from './configuracao';
import { criarAdaptadorProfissional } from './provedores';

export interface InfraestruturaDeProfissionais {
  banco: RecursoDeBanco;
  cadastro: ProfissionalRepository;
  provedor: ProvedorProfissionais;
  criarBarramento: (logger: LoggerDeServico) => BarramentoDeMensagens;
  logger?: FastifyServerOptions['logger'];
  retentativas?: Partial<OpcoesDeRetentativa>;
}

export function comporProfissionais(infra: InfraestruturaDeProfissionais): CicloDeVidaDoServico {
  const app = construirAppDeSaude(
    new VerificadorDeSaude({ banco: () => infra.banco.verificar(), mensageria: () => barramento.verificar() }),
    infra.logger,
  );
  const barramento = infra.criarBarramento(app.log);
  const operacoes = new OperacoesDeProfissionais(criarAdaptadorProfissional(infra.provedor, infra.cadastro));
  const servidor = new ServidorRpc(barramento, FILAS.CONSULTA_PROFISSIONAIS, operacoes.operacoes(), app.log);
  return new CicloDeVidaDoServico({
    nome: 'profissionais',
    app,
    banco: infra.banco,
    barramento,
    aoIniciar: () => servidor.iniciar(),
    ...(infra.retentativas ? { retentativas: infra.retentativas } : {}),
  });
}
