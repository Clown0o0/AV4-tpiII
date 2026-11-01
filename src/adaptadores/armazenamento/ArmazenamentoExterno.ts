import { File } from 'node:buffer';

export class ArmazenamentoExterno {
  private readonly arquivos = new Map<string, File>();

  async upload(arquivo: File): Promise<string> {
    this.arquivos.set(arquivo.name, arquivo);
    return arquivo.name;
  }

  async download(id: string): Promise<File | null> {
    return this.arquivos.get(id) ?? null;
  }

  async listar(pasta: string): Promise<string[]> {
    return [...this.arquivos.keys()].filter((nome) => nome.startsWith(pasta)).sort();
  }
}
