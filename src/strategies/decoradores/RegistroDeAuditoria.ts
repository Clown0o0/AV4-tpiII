import type { PapelTecnico, TipoEstrategia } from '../../domain/entities/Projeto';

export const EVENTO_AUDITORIA_RECOMENDACAO = 'recomendacao.estrategia';

export interface EntradaDeAuditoria {
  readonly evento: typeof EVENTO_AUDITORIA_RECOMENDACAO;
  readonly estrategia: TipoEstrategia;
  readonly papel: PapelTecnico;
  readonly projetoId: string;
  readonly candidatos: number;
  readonly devolvidos: number;
  readonly duracaoMs: number;
}

export interface RegistroDeAuditoria {
  registrar(entrada: EntradaDeAuditoria): void;
}
