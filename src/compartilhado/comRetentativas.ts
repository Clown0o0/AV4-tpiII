export interface OpcoesDeRetentativa {
  tentativas: number;
  esperaInicialMs: number;
  esperaMaximaMs: number;
  aoFalhar?: (erro: unknown, tentativa: number, esperaMs: number) => void;
  esperar?: (ms: number) => Promise<void>;
}

export const RETENTATIVAS_PADRAO: Readonly<OpcoesDeRetentativa> = { tentativas: 10, esperaInicialMs: 500, esperaMaximaMs: 8000 };

export async function comRetentativas<T>(acao: () => Promise<T>, opcoes: OpcoesDeRetentativa = RETENTATIVAS_PADRAO): Promise<T> {
  const esperar = opcoes.esperar ?? ((ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms)));
  let espera = opcoes.esperaInicialMs;
  for (let tentativa = 1; ; tentativa++) {
    try {
      return await acao();
    } catch (erro) {
      if (tentativa >= opcoes.tentativas) throw erro;
      opcoes.aoFalhar?.(erro, tentativa, espera);
      await esperar(espera);
      espera = Math.min(espera * 2, opcoes.esperaMaximaMs);
    }
  }
}
