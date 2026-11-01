import { ErroNaoEncontrado } from '../../domain/errors';
import type { AdaptadorArmazenamento, MetadadosArquivo } from './AdaptadorArmazenamento';
import { chaveDoArquivo } from './chaveDeArquivo';
import type { S3Simulado } from './S3Simulado';

export const BUCKET_PADRAO_S3 = 'cinebridge-midias';

export class AdaptadorS3 implements AdaptadorArmazenamento {
  constructor(
    private readonly s3: S3Simulado,
    private readonly bucket: string = BUCKET_PADRAO_S3,
  ) {}

  async salvarArquivo(conteudo: Buffer, metadados: MetadadosArquivo): Promise<string> {
    const Key = chaveDoArquivo(metadados);
    await this.s3.putObject({ Bucket: this.bucket, Key, Body: conteudo, Metadata: { ...metadados } });
    return Key;
  }

  async recuperarArquivo(id: string): Promise<Buffer> {
    const objeto = await this.s3.getObject({ Bucket: this.bucket, Key: id });
    if (!objeto) throw new ErroNaoEncontrado(`Arquivo ${id} não encontrado`);
    return Buffer.from(objeto.Body);
  }

  async listarArquivos(prefixo: string): Promise<string[]> {
    const { Contents } = await this.s3.listObjectsV2({ Bucket: this.bucket, Prefix: prefixo });
    return Contents.map((objeto) => objeto.Key);
  }
}
