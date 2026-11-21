import { PrismaClient } from '../../generated/notificacoes';
import { comporNotificacoes } from '../composicao/comporNotificacoes';
import { lerConfiguracaoDeServico, lerOuEncerrar } from '../composicao/configuracao';
import { BarramentoAmqp } from '../mensageria/BarramentoAmqp';
import { BancoPrisma } from '../repositories/BancoPrisma';
import { PrismaNotificacaoRepository } from '../repositories/PrismaNotificacaoRepository';
import { carregarArquivoEnv, executarServico } from './executarServico';

carregarArquivoEnv();

const configuracao = lerOuEncerrar(() => lerConfiguracaoDeServico(process.env, 3003));
const prisma = new PrismaClient();

executarServico(
  comporNotificacoes({
    banco: new BancoPrisma(prisma),
    notificacoes: new PrismaNotificacaoRepository(prisma),
    criarBarramento: (logger) => new BarramentoAmqp({ url: configuracao.rabbitmqUrl, logger }),
    logger: { level: configuracao.nivelLog },
  }),
  configuracao,
);
