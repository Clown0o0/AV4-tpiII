import { ErroNaoEncontrado } from '../../domain/errors';
import type { AdaptadorArmazenamento, MetadadosArquivo } from './AdaptadorArmazenamento';
import { chaveDoArquivo } from './chaveDeArquivo';
import type { GoogleCloudStorageSimulado } from './GoogleCloudStorageSimulado';

export const BUCKET_PADRAO_GOOGLE = 'cinebridge-midias';

export class AdaptadorGoogleCloud implements AdaptadorArmazenamento {
  constructor(
    private readonly storage: GoogleCloudStorageSimulado,
    private readonly bucket: string = BUCKET_PADRAO_GOOGLE,
  ) {}

  async salvarArquivo(conteudo: Buffer, metadados: MetadadosArquivo): Promise<string> {
    const nome = chaveDoArquivo(metadados);
    await this.storage.gravar({ bucket: this.bucket, nome, dadosBase64: conteudo.toString('base64'), metadados: { ...metadados } });
    return nome;
  }

  async recuperarArquivo(id: string): Promise<Buffer> {
    const objeto = await this.storage.ler(this.bucket, id);
    if (!objeto) throw new ErroNaoEncontrado(`Arquivo ${id} não encontrado`);
    return Buffer.from(objeto.dadosBase64, 'base64');
  }

  async listarArquivos(prefixo: string): Promise<string[]> {
    const { itens } = await this.storage.listar(this.bucket, prefixo);
    return itens.map((item) => item.nome);
  }
}
