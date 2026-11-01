export interface ComandoPutObject {
  readonly Bucket: string;
  readonly Key: string;
  readonly Body: Uint8Array;
  readonly Metadata?: Readonly<Record<string, string>>;
}

export interface ComandoGetObject {
  readonly Bucket: string;
  readonly Key: string;
}

export interface ComandoListObjectsV2 {
  readonly Bucket: string;
  readonly Prefix: string;
}

export interface ObjetoS3 {
  readonly Body: Uint8Array;
  readonly Metadata: Readonly<Record<string, string>>;
  readonly ETag: string;
}

export interface ResultadoListObjectsV2 {
  readonly Contents: ReadonlyArray<{ readonly Key: string; readonly Size: number }>;
  readonly KeyCount: number;
}

export class S3Simulado {
  private readonly buckets = new Map<string, Map<string, ObjetoS3>>();
  private versao = 0;

  async putObject(comando: ComandoPutObject): Promise<{ ETag: string }> {
    this.versao += 1;
    const objeto: ObjetoS3 = { Body: Uint8Array.from(comando.Body), Metadata: { ...comando.Metadata }, ETag: `"${this.versao}"` };
    this.bucket(comando.Bucket).set(comando.Key, objeto);
    return { ETag: objeto.ETag };
  }

  async getObject(comando: ComandoGetObject): Promise<ObjetoS3 | null> {
    const objeto = this.bucket(comando.Bucket).get(comando.Key);
    return objeto ? { ...objeto, Body: Uint8Array.from(objeto.Body), Metadata: { ...objeto.Metadata } } : null;
  }

  async listObjectsV2(comando: ComandoListObjectsV2): Promise<ResultadoListObjectsV2> {
    const Contents = [...this.bucket(comando.Bucket)]
      .filter(([chave]) => chave.startsWith(comando.Prefix))
      .map(([Key, objeto]) => ({ Key, Size: objeto.Body.byteLength }))
      .sort((a, b) => a.Key.localeCompare(b.Key));
    return { Contents, KeyCount: Contents.length };
  }

  private bucket(nome: string): Map<string, ObjetoS3> {
    let bucket = this.buckets.get(nome);
    if (!bucket) {
      bucket = new Map();
      this.buckets.set(nome, bucket);
    }
    return bucket;
  }
}
