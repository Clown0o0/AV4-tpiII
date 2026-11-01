export const NOMES_DECORADORES = ['cache', 'auditoria', 'compressao'] as const;
export type NomeDecorador = (typeof NOMES_DECORADORES)[number];

export const PILHA_PADRAO_DE_DECORADORES: readonly NomeDecorador[] = ['cache', 'auditoria'];
