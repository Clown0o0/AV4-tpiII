export type SituacaoTransacao = 'APROVADA' | 'ESTORNADA';

export interface DadosTransacao {
  readonly origem: string;
  readonly destino: string;
  readonly moeda: string;
}

export class Transacao {
  private _situacao: SituacaoTransacao = 'APROVADA';

  constructor(
    readonly id: string,
    readonly valor: number,
    readonly dados: DadosTransacao,
    readonly criadaEm: Date,
  ) {}

  get situacao(): SituacaoTransacao {
    return this._situacao;
  }

  estornar(): boolean {
    if (this._situacao === 'ESTORNADA') return false;
    this._situacao = 'ESTORNADA';
    return true;
  }
}
