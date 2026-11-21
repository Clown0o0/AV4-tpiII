import { PrismaClient } from '../../generated/profissionais';
import { comporProfissionais } from '../composicao/comporProfissionais';
import { lerConfiguracaoDeServico, lerOuEncerrar } from '../composicao/configuracao';
import { BarramentoAmqp } from '../mensageria/BarramentoAmqp';
import { BancoPrisma } from '../repositories/BancoPrisma';
import { PrismaProfissionalRepository } from '../repositories/PrismaProfissionalRepository';
import { carregarArquivoEnv, executarServico } from './executarServico';

carregarArquivoEnv();

const configuracao = lerOuEncerrar(() => lerConfiguracaoDeServico(process.env, 3001));
const prisma = new PrismaClient();

executarServico(
  comporProfissionais({
    banco: new BancoPrisma(prisma),
    cadastro: new PrismaProfissionalRepository(prisma),
    provedor: configuracao.provedorProfissionais,
    criarBarramento: (logger) => new BarramentoAmqp({ url: configuracao.rabbitmqUrl, logger }),
    logger: { level: configuracao.nivelLog },
  }),
  configuracao,
);
