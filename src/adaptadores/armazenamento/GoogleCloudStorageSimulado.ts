export interface ObjetoParaGravar {
  readonly bucket: string;
  readonly nome: string;
  readonly dadosBase64: string;
  readonly metadados: Readonly<Record<string, string>>;
}

export interface ObjetoGravado {
  readonly nome: string;
  readonly dadosBase64: string;
  readonly metadados: Readonly<Record<string, string>>;
  readonly tamanho: number;
}

export interface ListagemGoogle {
  readonly itens: ReadonlyArray<{ readonly nome: string; readonly tamanho: number }>;
}

export class GoogleCloudStorageSimulado {
  private readonly objetos = new Map<string, ObjetoGravado>();

  async gravar(objeto: ObjetoParaGravar): Promise<{ nome: string; tamanho: number }> {
    const gravado: ObjetoGravado = {
      nome: objeto.nome,
      dadosBase64: objeto.dadosBase64,
      metadados: { ...objeto.metadados },
      tamanho: Buffer.byteLength(objeto.dadosBase64, 'base64'),
    };
    this.objetos.set(this.caminho(objeto.bucket, objeto.nome), gravado);
    return { nome: gravado.nome, tamanho: gravado.tamanho };
  }

  async ler(bucket: string, nome: string): Promise<ObjetoGravado | null> {
    return this.objetos.get(this.caminho(bucket, nome)) ?? null;
  }

  async listar(bucket: string, prefixo: string): Promise<ListagemGoogle> {
    const inicio = this.caminho(bucket, prefixo);
    const itens = [...this.objetos]
      .filter(([caminho]) => caminho.startsWith(inicio))
      .map(([, objeto]) => ({ nome: objeto.nome, tamanho: objeto.tamanho }))
      .sort((a, b) => a.nome.localeCompare(b.nome));
    return { itens };
  }

  private caminho(bucket: string, nome: string): string {
    return `gs:${bucket}:${nome}`;
  }
}
