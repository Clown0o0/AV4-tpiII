import { comRetentativas } from '../../../src/compartilhado/comRetentativas';
import { CicloDeVidaDoServico } from '../../../src/composicao/CicloDeVidaDoServico';
import { BarramentoEmMemoria } from '../../../src/mensageria/BarramentoEmMemoria';
import { construirAppDeSaude } from '../../../src/saude/construirAppDeSaude';
import { VerificadorDeSaude } from '../../../src/saude/VerificadorDeSaude';
import { BancoEmMemoria } from '../../support/servicosEmMemoria';

describe('VerificadorDeSaude e GET /health', () => {
  it('ok só com banco e mensageria ok; erro e demora contam como falha', async () => {
    const ok = async (): Promise<boolean> => true;
    expect(await new VerificadorDeSaude({ banco: ok, mensageria: ok }).estado()).toEqual({ status: 'ok', banco: 'ok', mensageria: 'ok' });
    const quebrado = async (): Promise<boolean> => {
      throw new Error('ECONNREFUSED');
    };
    const lento = (): Promise<boolean> => new Promise((resolve) => setTimeout(() => resolve(true), 50));
    expect(await new VerificadorDeSaude({ banco: quebrado, mensageria: lento }, 5).estado()).toEqual({ status: 'indisponivel', banco: 'falha', mensageria: 'falha' });
    expect(await new VerificadorDeSaude({ banco: ok, mensageria: async () => false }).estado()).toMatchObject({ status: 'indisponivel', mensageria: 'falha' });
  });

  it('o app de saúde responde 200/503 em JSON curto e 404 para outras rotas', async () => {
    let mensageria = true;
    const app = construirAppDeSaude(new VerificadorDeSaude({ banco: async () => true, mensageria: async () => mensageria }));
    expect((await app.inject('/health')).statusCode).toBe(200);
    mensageria = false;
    const indisponivel = await app.inject('/health');
    expect([indisponivel.statusCode, indisponivel.json()]).toEqual([503, { status: 'indisponivel', banco: 'ok', mensageria: 'falha' }]);
    expect((await app.inject('/x')).json()).toEqual({ erro: 'NAO_ENCONTRADO', mensagem: 'Rota GET /x não existe' });
    await app.close();
  });
});

describe('comRetentativas', () => {
  it('repete com backoff exponencial limitado e devolve o resultado', async () => {
    const esperas: number[] = [];
    const aoFalhar = jest.fn();
    let falhas = 3;
    const resultado = await comRetentativas(
      async () => {
        if (falhas-- > 0) throw new Error('fora');
        return 'ok';
      },
      { tentativas: 5, esperaInicialMs: 100, esperaMaximaMs: 250, aoFalhar, esperar: async (ms) => void esperas.push(ms) },
    );
    expect(resultado).toBe('ok');
    expect(esperas).toEqual([100, 200, 250]);
    expect(aoFalhar).toHaveBeenCalledTimes(3);
  });

  it('desiste após o número de tentativas e usa o temporizador real por padrão', async () => {
    await expect(comRetentativas(async () => Promise.reject(new Error('sempre')), { tentativas: 2, esperaInicialMs: 1, esperaMaximaMs: 1 })).rejects.toThrow('sempre');
  });
});

describe('CicloDeVidaDoServico', () => {
  it('conecta banco e RabbitMQ com retentativas antes de iniciar e encerra na ordem inversa', async () => {
    const banco = new BancoEmMemoria();
    const conectar = jest.spyOn(banco, 'conectar').mockRejectedValueOnce(new Error('banco subindo'));
    const barramento = new BarramentoEmMemoria();
    const ordem: string[] = [];
    const app = construirAppDeSaude(new VerificadorDeSaude({ banco: () => banco.verificar(), mensageria: () => barramento.verificar() }));
    const avisos = jest.spyOn(app.log, 'warn');
    const ciclo = new CicloDeVidaDoServico({
      nome: 'teste',
      app,
      banco,
      barramento,
      aoIniciar: async () => void ordem.push('iniciar'),
      aoEncerrar: async () => void ordem.push('encerrar'),
      retentativas: { esperar: async () => undefined },
    });
    expect(ciclo.nome).toBe('teste');
    await ciclo.iniciar();
    expect(conectar).toHaveBeenCalledTimes(2);
    expect(avisos).toHaveBeenCalledWith(expect.objectContaining({ recurso: 'banco', tentativa: 1 }), 'falha ao conectar; nova tentativa');
    await ciclo.encerrar();
    expect(ordem).toEqual(['iniciar', 'encerrar']);
    expect(banco.desconectado).toBe(true);
    expect(await barramento.verificar()).toBe(false);
  });

  it('sem aoEncerrar também encerra', async () => {
    const banco = new BancoEmMemoria();
    const barramento = new BarramentoEmMemoria();
    const app = construirAppDeSaude(new VerificadorDeSaude({ banco: async () => true, mensageria: async () => true }));
    const ciclo = new CicloDeVidaDoServico({ nome: 'x', app, banco, barramento, aoIniciar: async () => undefined });
    await ciclo.iniciar();
    await ciclo.encerrar();
    expect(banco.desconectado).toBe(true);
  });
});
