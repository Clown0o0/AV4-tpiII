import type { EntradaDeAuditoria, RegistroDeAuditoria } from './RegistroDeAuditoria';

export const LIMITE_PADRAO_DE_ENTRADAS = 1000;

export class RegistroDeAuditoriaEmMemoria implements RegistroDeAuditoria {
  private readonly _entradas: EntradaDeAuditoria[] = [];

  constructor(private readonly limite: number = LIMITE_PADRAO_DE_ENTRADAS) {}

  registrar(entrada: EntradaDeAuditoria): void {
    this._entradas.push({ ...entrada });
    if (this._entradas.length > this.limite) this._entradas.splice(0, this._entradas.length - this.limite);
  }

  get entradas(): readonly EntradaDeAuditoria[] {
    return this._entradas.map((entrada) => ({ ...entrada }));
  }
}
