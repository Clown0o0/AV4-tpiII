import { ErroDominio } from '../domain/errors';

export class ErroRemoto extends ErroDominio {
  constructor(
    readonly codigo: string,
    readonly codigoHttp: number,
    mensagem: string,
  ) {
    super(mensagem);
  }
}
