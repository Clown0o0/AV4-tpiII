import { randomUUID } from 'node:crypto';
import {
  CATEGORIAS_ARQUIVO,
  type AdaptadorArmazenamento,
  type CategoriaArquivo,
  type MetadadosArquivo,
} from '../adaptadores/armazenamento/AdaptadorArmazenamento';
import { lerChaveDoArquivo, prefixoDoArquivo, prefixoDoProjeto } from '../adaptadores/armazenamento/chaveDeArquivo';
import type { Projeto } from '../domain/entities/Projeto';
import { ErroNaoEncontrado, ErroValidacao } from '../domain/errors';

export const TAMANHO_MAXIMO_ARQUIVO_BYTES = 512 * 1024;
export const TAMANHO_MAXIMO_NOME_ARQUIVO = 200;
const CARACTERES_PROIBIDOS_NO_NOME = /[\\/\p{Cc}]/u;

export interface NovoArquivo {
  nome: string;
  categoria: CategoriaArquivo;
  conteudo: Buffer;
}

export type ArquivoDoProjeto = MetadadosArquivo;

export interface ArquivoComConteudo extends ArquivoDoProjeto {
  conteudo: Buffer;
}

export interface ServicoDeArquivos {
  anexar(adaptador: AdaptadorArmazenamento, projeto: Projeto, arquivo: NovoArquivo): Promise<ArquivoDoProjeto>;
  listar(adaptador: AdaptadorArmazenamento, projeto: Projeto): Promise<ArquivoDoProjeto[]>;
  obter(adaptador: AdaptadorArmazenamento, projeto: Projeto, arquivoId: string): Promise<ArquivoComConteudo>;
}

export class GestorDeArquivos implements ServicoDeArquivos {
  constructor(private readonly gerarId: () => string = randomUUID) {}

  async anexar(adaptador: AdaptadorArmazenamento, projeto: Projeto, arquivo: NovoArquivo): Promise<ArquivoDoProjeto> {
    validarConteudo(arquivo.conteudo);
    const metadados: MetadadosArquivo = {
      projetoId: projeto.id,
      arquivoId: this.gerarId(),
      categoria: validarCategoria(arquivo.categoria),
      nome: validarNome(arquivo.nome),
    };
    await adaptador.salvarArquivo(arquivo.conteudo, metadados);
    return metadados;
  }

  async listar(adaptador: AdaptadorArmazenamento, projeto: Projeto): Promise<ArquivoDoProjeto[]> {
    const chaves = await adaptador.listarArquivos(prefixoDoProjeto(projeto.id));
    return chaves.flatMap((chave) => lerChaveDoArquivo(chave) ?? []);
  }

  async obter(adaptador: AdaptadorArmazenamento, projeto: Projeto, arquivoId: string): Promise<ArquivoComConteudo> {
    const [chave] = await adaptador.listarArquivos(prefixoDoArquivo(projeto.id, arquivoId));
    const metadados = chave === undefined ? null : lerChaveDoArquivo(chave);
    if (chave === undefined || !metadados) throw new ErroNaoEncontrado(`Arquivo ${arquivoId} não encontrado no projeto ${projeto.id}`);
    return { ...metadados, conteudo: await adaptador.recuperarArquivo(chave) };
  }
}

function validarConteudo(conteudo: Buffer): void {
  if (conteudo.byteLength === 0) throw new ErroValidacao('O conteúdo do arquivo não pode ser vazio');
  if (conteudo.byteLength > TAMANHO_MAXIMO_ARQUIVO_BYTES) {
    throw new ErroValidacao(`O arquivo excede o tamanho máximo de ${TAMANHO_MAXIMO_ARQUIVO_BYTES} bytes`);
  }
}

function validarCategoria(categoria: string): CategoriaArquivo {
  const valida = CATEGORIAS_ARQUIVO.find((opcao) => opcao === categoria);
  if (!valida) throw new ErroValidacao(`Categoria de arquivo inválida: ${categoria}`);
  return valida;
}

function validarNome(nome: string): string {
  const limpo = nome.trim();
  if (!limpo || limpo.length > TAMANHO_MAXIMO_NOME_ARQUIVO || CARACTERES_PROIBIDOS_NO_NOME.test(limpo)) {
    throw new ErroValidacao(`Nome de arquivo inválido: use até ${TAMANHO_MAXIMO_NOME_ARQUIVO} caracteres, sem barras`);
  }
  return limpo;
}
