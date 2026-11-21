import { ErroDominio } from '../domain/errors';

export class ErroServicoIndisponivel extends ErroDominio {
  readonly codigo = 'SERVICO_INDISPONIVEL';
  readonly codigoHttp = 503;
}
