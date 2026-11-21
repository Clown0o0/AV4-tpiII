import type { FastifyServerOptions } from 'fastify';
import type { OpcoesDeRetentativa } from '../compartilhado/comRetentativas';
import type { BarramentoDeMensagens } from '../domain/ports/BarramentoDeMensagens';
import type { CadastroDeProjetos } from '../domain/ports/CadastroDeProjetos';
import type { CatalogoFabricas } from '../factories/FabricaProjeto';
import { RegistroFabricas } from '../factories/RegistroFabricas';
import { FILAS } from '../mensageria/filas';
import type { LoggerDeServico } from '../mensageria/LoggerDeServico';
import { PublicadorDeEventosIntegrados } from '../mensageria/PublicadorDeEventosIntegrados';
import { ServidorRpc } from '../mensageria/ServidorRpc';
import { OperacoesDeProjetos } from '../projetos/OperacoesDeProjetos';
import type { RecursoDeBanco } from '../repositories/BancoPrisma';
import { construirAppDeSaude } from '../saude/construirAppDeSaude';
import { VerificadorDeSaude } from '../saude/VerificadorDeSaude';
import { CicloDeVidaDoServico } from './CicloDeVidaDoServico';

export interface InfraestruturaDeProjetos {
  banco: RecursoDeBanco;
  criarCadastro: (fabricas: CatalogoFabricas) => CadastroDeProjetos;
  criarBarramento: (logger: LoggerDeServico) => BarramentoDeMensagens;
  logger?: FastifyServerOptions['logger'];
  retentativas?: Partial<OpcoesDeRetentativa>;
}

export function comporProjetos(infra: InfraestruturaDeProjetos): CicloDeVidaDoServico {
  const app = construirAppDeSaude(
    new VerificadorDeSaude({ banco: () => infra.banco.verificar(), mensageria: () => barramento.verificar() }),
    infra.logger,
  );
  const barramento = infra.criarBarramento(app.log);
  const fabricas = RegistroFabricas.padrao({ logger: app.log });
  const operacoes = new OperacoesDeProjetos({
    cadastro: infra.criarCadastro(fabricas),
    fabricas,
    eventos: new PublicadorDeEventosIntegrados(barramento, FILAS.EVENTOS_PROJETOS),
  });
  const servidor = new ServidorRpc(barramento, FILAS.CONSULTA_PROJETOS, operacoes.operacoes(), app.log);
  return new CicloDeVidaDoServico({
    nome: 'projetos',
    app,
    banco: infra.banco,
    barramento,
    aoIniciar: () => servidor.iniciar(),
    ...(infra.retentativas ? { retentativas: infra.retentativas } : {}),
  });
}
