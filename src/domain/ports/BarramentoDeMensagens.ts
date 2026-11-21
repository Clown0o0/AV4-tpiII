export type TratadorDeMensagem = (conteudo: unknown) => Promise<void>;
export type TratadorDeConsulta = (pedido: unknown) => Promise<unknown>;

export interface BarramentoDeMensagens {
  conectar(): Promise<void>;
  publicar(fila: string, conteudo: unknown): Promise<void>;
  consumir(fila: string, tratador: TratadorDeMensagem): Promise<void>;
  responder(fila: string, tratador: TratadorDeConsulta): Promise<void>;
  consultar(fila: string, pedido: unknown, timeoutMs: number): Promise<unknown>;
  verificar(): Promise<boolean>;
  encerrar(): Promise<void>;
}
