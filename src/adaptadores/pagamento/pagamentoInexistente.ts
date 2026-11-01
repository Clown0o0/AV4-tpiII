import { ErroNaoEncontrado } from '../../domain/errors';

export function pagamentoInexistente(id: string): ErroNaoEncontrado {
  return new ErroNaoEncontrado(`Pagamento ${id} não encontrado`);
}
