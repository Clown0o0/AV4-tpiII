import type { CicloDeVidaDoServico } from '../composicao/CicloDeVidaDoServico';

export interface Escuta {
  porta: number;
  host: string;
}

const PRAZO_PARA_SAIR_MS = 10000;

export function carregarArquivoEnv(): void {
  try {
    process.loadEnvFile();
  } catch {
    return;
  }
}

export function executarServico(ciclo: CicloDeVidaDoServico, escuta: Escuta): void {
  const { app } = ciclo;
  let encerrando = false;

  const encerrar = async (sinal: string, codigo: number): Promise<void> => {
    if (encerrando) return;
    encerrando = true;
    app.log.info({ sinal, servico: ciclo.nome }, 'encerrando');
    setTimeout(() => process.exit(codigo === 0 ? 1 : codigo), PRAZO_PARA_SAIR_MS).unref();
    try {
      await ciclo.encerrar();
      process.exit(codigo);
    } catch (erro) {
      app.log.error({ err: erro }, 'falha ao encerrar');
      process.exit(1);
    }
  };

  process.on('SIGINT', () => void encerrar('SIGINT', 0));
  process.on('SIGTERM', () => void encerrar('SIGTERM', 0));
  process.on('unhandledRejection', (motivo) => {
    app.log.fatal({ err: motivo, origem: 'unhandledRejection' }, 'falha não tratada; encerrando');
    void encerrar('unhandledRejection', 1);
  });
  process.on('uncaughtException', (erro) => {
    app.log.fatal({ err: erro, origem: 'uncaughtException' }, 'falha não tratada; encerrando');
    void encerrar('uncaughtException', 1);
  });

  ciclo
    .iniciar()
    .then(() => app.listen({ port: escuta.porta, host: escuta.host }))
    .catch((erro: unknown) => {
      app.log.fatal({ err: erro, servico: ciclo.nome }, 'falha ao iniciar o serviço');
      void encerrar('falha-na-subida', 1);
    });
}
