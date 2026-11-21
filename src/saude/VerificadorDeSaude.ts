export type Verificacao = () => Promise<boolean>;
export type SituacaoDoRecurso = 'ok' | 'falha';

export interface RelatorioDeSaude {
  readonly status: 'ok' | 'indisponivel';
  readonly banco: SituacaoDoRecurso;
  readonly mensageria: SituacaoDoRecurso;
}

export interface FonteDeSaude {
  estado(): Promise<RelatorioDeSaude>;
}

export interface VerificacoesDeSaude {
  readonly banco: Verificacao;
  readonly mensageria: Verificacao;
}

export const LIMITE_DA_VERIFICACAO_MS = 2000;

export class VerificadorDeSaude implements FonteDeSaude {
  constructor(
    private readonly verificacoes: VerificacoesDeSaude,
    private readonly limiteMs = LIMITE_DA_VERIFICACAO_MS,
  ) {}

  async estado(): Promise<RelatorioDeSaude> {
    const [banco, mensageria] = await Promise.all([this.avaliar(this.verificacoes.banco), this.avaliar(this.verificacoes.mensageria)]);
    return { status: banco === 'ok' && mensageria === 'ok' ? 'ok' : 'indisponivel', banco, mensageria };
  }

  private async avaliar(verificacao: Verificacao): Promise<SituacaoDoRecurso> {
    let temporizador: NodeJS.Timeout | undefined;
    const limite = new Promise<boolean>((resolve) => {
      temporizador = setTimeout(() => resolve(false), this.limiteMs);
    });
    try {
      return (await Promise.race([verificacao(), limite])) ? 'ok' : 'falha';
    } catch {
      return 'falha';
    } finally {
      clearTimeout(temporizador);
    }
  }
}
