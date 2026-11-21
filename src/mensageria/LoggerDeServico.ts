export interface LoggerDeServico {
  info(objeto: Record<string, unknown>, mensagem: string): void;
  warn(objeto: Record<string, unknown>, mensagem: string): void;
  error(objeto: Record<string, unknown>, mensagem: string): void;
}
