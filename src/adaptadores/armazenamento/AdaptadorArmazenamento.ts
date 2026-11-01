export const CATEGORIAS_ARQUIVO = ['ROTEIRO', 'STORYBOARD', 'AMOSTRA_VIDEO'] as const;
export type CategoriaArquivo = (typeof CATEGORIAS_ARQUIVO)[number];

export interface MetadadosArquivo {
  readonly projetoId: string;
  readonly arquivoId: string;
  readonly categoria: CategoriaArquivo;
  readonly nome: string;
}

export interface AdaptadorArmazenamento {
  salvarArquivo(conteudo: Buffer, metadados: MetadadosArquivo): Promise<string>;
  recuperarArquivo(id: string): Promise<Buffer>;
  listarArquivos(prefixo: string): Promise<string[]>;
}
