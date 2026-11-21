// submarino
import { PrismaClient } from '../generated/api';
import { comporApi } from './composicao/comporApi';
import { lerConfiguracao, lerConfiguracaoDeMensageria, lerOuEncerrar } from './composicao/configuracao';
import { carregarArquivoEnv, executarServico } from './entradas/executarServico';
import { BarramentoAmqp } from './mensageria/BarramentoAmqp';
import { BancoPrisma } from './repositories/BancoPrisma';
import { PrismaRecomendacaoRepository } from './repositories/PrismaRecomendacaoRepository';

carregarArquivoEnv();

const configuracao = lerOuEncerrar(() => lerConfiguracao(process.env));
const mensageria = lerOuEncerrar(() => lerConfiguracaoDeMensageria(process.env));
const prisma = new PrismaClient();

executarServico(
  comporApi({
    configuracao,
    mensageria,
    banco: new BancoPrisma(prisma),
    recomendacoes: new PrismaRecomendacaoRepository(prisma),
    criarBarramento: (logger) => new BarramentoAmqp({ url: mensageria.rabbitmqUrl, logger }),
  }),
  configuracao,
);
