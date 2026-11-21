import { ErroMensagemInvalida } from './ErroMensagemInvalida';

export type ObjetoJson = Readonly<Record<string, unknown>>;

export function objeto(valor: unknown, contexto: string): ObjetoJson {
  if (typeof valor !== 'object' || valor === null || Array.isArray(valor)) throw new ErroMensagemInvalida(`${contexto} deve ser um objeto`);
  return Object.fromEntries(Object.entries(valor));
}

export function lista(valor: unknown, contexto: string): readonly unknown[] {
  if (!Array.isArray(valor)) throw new ErroMensagemInvalida(`${contexto} deve ser uma lista`);
  return valor;
}

export function texto(origem: ObjetoJson, campo: string): string {
  const valor = origem[campo];
  if (typeof valor !== 'string') throw new ErroMensagemInvalida(`${campo} deve ser texto`);
  return valor;
}

export function textoOuNulo(origem: ObjetoJson, campo: string): string | null {
  const valor = origem[campo];
  return valor === null || valor === undefined ? null : texto(origem, campo);
}

export function numero(origem: ObjetoJson, campo: string): number {
  const valor = origem[campo];
  if (typeof valor !== 'number') throw new ErroMensagemInvalida(`${campo} deve ser número`);
  return valor;
}

export function booleano(origem: ObjetoJson, campo: string): boolean {
  const valor = origem[campo];
  if (typeof valor !== 'boolean') throw new ErroMensagemInvalida(`${campo} deve ser booleano`);
  return valor;
}

export function data(origem: ObjetoJson, campo: string): Date {
  const valor = new Date(texto(origem, campo));
  if (Number.isNaN(valor.getTime())) throw new ErroMensagemInvalida(`${campo} deve ser uma data ISO`);
  return valor;
}

export function textos(origem: ObjetoJson, campo: string): string[] {
  return lista(origem[campo], campo).map((item, indice) => texto({ [indice]: item }, String(indice)));
}

export function opcao<T extends string>(origem: ObjetoJson, campo: string, opcoes: readonly T[]): T {
  const bruto = texto(origem, campo);
  const escolhida = opcoes.find((item) => item === bruto);
  if (escolhida === undefined) throw new ErroMensagemInvalida(`${campo}="${bruto}" não é um valor aceito`);
  return escolhida;
}

export function opcoesDe<T extends string>(origem: ObjetoJson, campo: string, opcoes: readonly T[]): T[] {
  return lista(origem[campo], campo).map((item) => opcao({ [campo]: item }, campo, opcoes));
}
