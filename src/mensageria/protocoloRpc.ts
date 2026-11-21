import { ErroDominio } from '../domain/errors';
import { ErroRemoto } from './ErroRemoto';
import { booleano, numero, objeto, texto } from './leitorJson';

export interface PedidoRpc {
  readonly operacao: string;
  readonly dados: unknown;
}

export interface FalhaRpc {
  readonly codigo: string;
  readonly codigoHttp: number;
  readonly mensagem: string;
}

export type RespostaRpc = { readonly ok: true; readonly resultado: unknown } | { readonly ok: false; readonly erro: FalhaRpc };

export const FALHA_INTERNA: FalhaRpc = { codigo: 'ERRO_INTERNO', codigoHttp: 500, mensagem: 'Erro interno no serviço remoto' };

export function lerPedido(valor: unknown): PedidoRpc {
  const pedido = objeto(valor, 'pedido');
  return { operacao: texto(pedido, 'operacao'), dados: pedido.dados };
}

export function sucesso(resultado: unknown): RespostaRpc {
  return { ok: true, resultado: resultado ?? null };
}

export function falha(erro: unknown): RespostaRpc {
  if (erro instanceof ErroDominio) return { ok: false, erro: { codigo: erro.codigo, codigoHttp: erro.codigoHttp, mensagem: erro.message } };
  return { ok: false, erro: FALHA_INTERNA };
}

export function abrirResposta(valor: unknown): unknown {
  const resposta = objeto(valor, 'resposta');
  if (booleano(resposta, 'ok')) return resposta.resultado;
  const erro = objeto(resposta.erro, 'erro');
  throw new ErroRemoto(texto(erro, 'codigo'), numero(erro, 'codigoHttp'), texto(erro, 'mensagem'));
}
