import { ErroDominio } from '../domain/errors';

export class ErroMensagemInvalida extends ErroDominio {
  readonly codigo = 'MENSAGEM_INVALIDA';
  readonly codigoHttp = 422;
}
