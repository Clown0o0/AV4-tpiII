import { PrismaClient } from '../../generated/projetos';
import { comporProjetos } from '../composicao/comporProjetos';
import { lerConfiguracaoDeServico, lerOuEncerrar } from '../composicao/configuracao';
import { BarramentoAmqp } from '../mensageria/BarramentoAmqp';
import { BancoPrisma } from '../repositories/BancoPrisma';
import { PrismaProjetoRepository } from '../repositories/PrismaProjetoRepository';
import { carregarArquivoEnv, executarServico } from './executarServico';

carregarArquivoEnv();

const configuracao = lerOuEncerrar(() => lerConfiguracaoDeServico(process.env, 3002));
const prisma = new PrismaClient();

executarServico(
  comporProjetos({
    banco: new BancoPrisma(prisma),
    criarCadastro: (fabricas) => new PrismaProjetoRepository(prisma, fabricas),
    criarBarramento: (logger) => new BarramentoAmqp({ url: configuracao.rabbitmqUrl, logger }),
    logger: { level: configuracao.nivelLog },
  }),
  configuracao,
);
