import { File } from 'node:buffer';
import { ErroNaoEncontrado } from '../../domain/errors';
import type { AdaptadorArmazenamento, MetadadosArquivo } from './AdaptadorArmazenamento';
import type { ArmazenamentoExterno } from './ArmazenamentoExterno';
import { chaveDoArquivo } from './chaveDeArquivo';

export class AdaptadorLocal implements AdaptadorArmazenamento {
  constructor(private readonly armazenamento: ArmazenamentoExterno) {}

  salvarArquivo(conteudo: Buffer, metadados: MetadadosArquivo): Promise<string> {
    return this.armazenamento.upload(new File([conteudo], chaveDoArquivo(metadados)));
  }

  async recuperarArquivo(id: string): Promise<Buffer> {
    const arquivo = await this.armazenamento.download(id);
    if (!arquivo) throw new ErroNaoEncontrado(`Arquivo ${id} não encontrado`);
    return Buffer.from(await arquivo.arrayBuffer());
  }

  listarArquivos(prefixo: string): Promise<string[]> {
    return this.armazenamento.listar(prefixo);
  }
}
