import { CATEGORIAS_ARQUIVO, type MetadadosArquivo } from './AdaptadorArmazenamento';

const RAIZ_DOS_PROJETOS = 'projetos';
const SEPARADOR = '/';
const PARTES_DA_CHAVE = 5;

export function prefixoDoProjeto(projetoId: string): string {
  return [RAIZ_DOS_PROJETOS, projetoId, ''].join(SEPARADOR);
}

export function prefixoDoArquivo(projetoId: string, arquivoId: string): string {
  return [RAIZ_DOS_PROJETOS, projetoId, arquivoId, ''].join(SEPARADOR);
}

export function chaveDoArquivo(metadados: MetadadosArquivo): string {
  return prefixoDoArquivo(metadados.projetoId, metadados.arquivoId) + [metadados.categoria, metadados.nome].join(SEPARADOR);
}

export function lerChaveDoArquivo(chave: string): MetadadosArquivo | null {
  const partes = chave.split(SEPARADOR);
  const [raiz, projetoId, arquivoId, textoCategoria, nome] = partes;
  const categoria = CATEGORIAS_ARQUIVO.find((opcao) => opcao === textoCategoria);
  if (partes.length !== PARTES_DA_CHAVE || raiz !== RAIZ_DOS_PROJETOS || !categoria || !projetoId || !arquivoId || !nome) return null;
  return { projetoId, arquivoId, categoria, nome };
}
