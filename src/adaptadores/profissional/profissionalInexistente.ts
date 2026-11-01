import { ErroNaoEncontrado } from '../../domain/errors';

export function profissionalInexistente(id: string): ErroNaoEncontrado {
  return new ErroNaoEncontrado(`Profissional ${id} não encontrado`);
}
