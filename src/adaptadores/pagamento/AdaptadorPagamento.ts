export const STATUS_PAGAMENTO = ['APROVADO', 'CANCELADO'] as const;
export type StatusPagamento = (typeof STATUS_PAGAMENTO)[number];

export interface AdaptadorPagamento {
  efetuarPagamento(valor: number, origem: string, destino: string): Promise<string>;
  cancelarPagamento(id: string): Promise<boolean>;
  verificarPagamento(id: string): Promise<StatusPagamento>;
}
