import { TIMEOUT_PADRAO_MS, TTL_CATALOGO_PADRAO_MS } from '../services/FonteProfissionaisResiliente';
import { NOMES_DECORADORES, PILHA_PADRAO_DE_DECORADORES, type NomeDecorador } from '../strategies/decoradores/nomesDosDecoradores';

export const NIVEIS_DE_LOG = ['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'] as const;
export type NivelDeLog = (typeof NIVEIS_DE_LOG)[number];

export const PORTA_PADRAO = 3000;
export const HOST_PADRAO = '0.0.0.0';
export const MAIOR_INTERVALO_MS = 2_147_483_647;

export const PROVEDORES_ARMAZENAMENTO = ['local', 's3', 'google'] as const;
export type ProvedorArmazenamento = (typeof PROVEDORES_ARMAZENAMENTO)[number];
export const PROVEDORES_PAGAMENTO = ['stripe', 'pagseguro', 'paypal'] as const;
export type ProvedorPagamento = (typeof PROVEDORES_PAGAMENTO)[number];
export const PROVEDORES_PROFISSIONAIS = ['interno', 'linkedin', 'indeed'] as const;
export type ProvedorProfissionais = (typeof PROVEDORES_PROFISSIONAIS)[number];

export interface ProvedoresConfigurados {
  armazenamento: ProvedorArmazenamento;
  pagamento: ProvedorPagamento;
  profissionais: ProvedorProfissionais;
}

export const PROVEDORES_PADRAO: Readonly<ProvedoresConfigurados> = {
  armazenamento: 'local',
  pagamento: 'stripe',
  profissionais: 'interno',
};

export interface Configuracao {
  databaseUrl: string;
  porta: number;
  host: string;
  nivelLog: NivelDeLog;
  catalogoTtlMs: number;
  profissionaisTimeoutMs: number;
  provedores: ProvedoresConfigurados;
  decoradores: readonly NomeDecorador[];
  decoradoresPorProdutor: ReadonlyMap<string, readonly NomeDecorador[]>;
}

export type Ambiente = Readonly<Record<string, string | undefined>>;

export class ErroConfiguracao extends Error {
  constructor(readonly problemas: readonly string[]) {
    super(`Configuração inválida:\n${problemas.map((problema) => `  - ${problema}`).join('\n')}`);
    this.name = 'ErroConfiguracao';
  }
}

export class LeitorDeAmbiente {
  private readonly problemas: string[] = [];

  constructor(private readonly ambiente: Ambiente) {}

  inteiro(nome: string, padrao: number, minimo: number, maximo: number): number {
    const bruto = this.valor(nome);
    if (bruto === undefined) return padrao;
    const numero = Number(bruto);
    if (/^\d+$/.test(bruto) && numero >= minimo && numero <= maximo) return numero;
    this.problemas.push(`${nome}="${bruto}" é inválida: use um número inteiro entre ${minimo} e ${maximo}`);
    return padrao;
  }

  opcao<T extends string>(nome: string, opcoes: readonly T[], padrao: T): T {
    const bruto = this.valor(nome);
    if (bruto === undefined) return padrao;
    const escolhida = opcoes.find((opcao) => opcao === bruto);
    if (escolhida === undefined) this.problemas.push(`${nome}="${bruto}" é inválida: use um destes valores: ${opcoes.join(', ')}`);
    return escolhida ?? padrao;
  }

  texto(nome: string, padrao: string): string {
    return this.valor(nome) ?? padrao;
  }

  urlDoBanco(nome: string): string {
    const bruto = this.valor(nome);
    if (bruto === undefined) {
      this.problemas.push(`${nome} não está definida: crie o .env a partir do .env.example ou defina a variável no ambiente`);
    } else if (!/^postgres(ql)?:\/\//.test(bruto)) {
      this.problemas.push(`${nome} é inválida: use o formato postgresql://USUARIO:SENHA@HOST:PORTA/BANCO?schema=public`);
    }
    return bruto ?? '';
  }

  listaDeOpcoes<T extends string>(nome: string, opcoes: readonly T[], padrao: readonly T[]): readonly T[] {
    const bruto = this.ambiente[nome]?.trim();
    if (bruto === undefined) return padrao;
    const lista = lerListaDeOpcoes(bruto === '' ? [] : bruto.split(',').map((item) => item.trim()), opcoes);
    if (lista) return lista;
    this.problemas.push(`${nome}="${bruto}" é inválida: ${descricaoDaLista(opcoes)}, separados por vírgula (vazio = nenhum)`);
    return padrao;
  }

  mapaDeListasDeOpcoes<T extends string>(nome: string, opcoes: readonly T[]): ReadonlyMap<string, readonly T[]> {
    const bruto = this.valor(nome);
    if (bruto === undefined) return new Map();
    const mapa = lerMapaDeListas(bruto, opcoes);
    if (mapa) return mapa;
    this.problemas.push(`${nome} é inválida: use um JSON como {"produtor-1":["cache","compressao"]}; ${descricaoDaLista(opcoes)}`);
    return new Map();
  }

  confirmar(): void {
    if (this.problemas.length > 0) throw new ErroConfiguracao(this.problemas);
  }

  private valor(nome: string): string | undefined {
    const bruto = this.ambiente[nome]?.trim();
    return bruto === '' ? undefined : bruto;
  }
}

export function lerConfiguracao(ambiente: Ambiente): Configuracao {
  const leitor = new LeitorDeAmbiente(ambiente);
  const configuracao: Configuracao = {
    databaseUrl: leitor.urlDoBanco('DATABASE_URL'),
    porta: leitor.inteiro('PORT', PORTA_PADRAO, 1, 65535),
    host: leitor.texto('HOST', HOST_PADRAO),
    nivelLog: leitor.opcao('LOG_LEVEL', NIVEIS_DE_LOG, 'info'),
    catalogoTtlMs: leitor.inteiro('CATALOGO_TTL_MS', TTL_CATALOGO_PADRAO_MS, 0, MAIOR_INTERVALO_MS),
    profissionaisTimeoutMs: leitor.inteiro('PROFISSIONAIS_TIMEOUT_MS', TIMEOUT_PADRAO_MS, 1, MAIOR_INTERVALO_MS),
    provedores: lerProvedores(leitor),
    decoradores: leitor.listaDeOpcoes('DECORADORES', NOMES_DECORADORES, PILHA_PADRAO_DE_DECORADORES),
    decoradoresPorProdutor: leitor.mapaDeListasDeOpcoes('DECORADORES_POR_PRODUTOR', NOMES_DECORADORES),
  };
  leitor.confirmar();
  return configuracao;
}

function lerProvedores(leitor: LeitorDeAmbiente): ProvedoresConfigurados {
  return {
    armazenamento: leitor.opcao('ARMAZENAMENTO', PROVEDORES_ARMAZENAMENTO, PROVEDORES_PADRAO.armazenamento),
    pagamento: leitor.opcao('PAGAMENTO', PROVEDORES_PAGAMENTO, PROVEDORES_PADRAO.pagamento),
    profissionais: leitor.opcao('PROFISSIONAIS', PROVEDORES_PROFISSIONAIS, PROVEDORES_PADRAO.profissionais),
  };
}

function descricaoDaLista(opcoes: readonly string[]): string {
  return `use nomes sem repetição dentre: ${opcoes.join(', ')}`;
}

function lerListaDeOpcoes<T extends string>(itens: readonly unknown[], opcoes: readonly T[]): T[] | null {
  const lista = itens.flatMap((item) => opcoes.filter((opcao) => opcao === item));
  return lista.length === itens.length && new Set(lista).size === lista.length ? lista : null;
}

function lerMapaDeListas<T extends string>(bruto: string, opcoes: readonly T[]): Map<string, T[]> | null {
  const dados = lerJson(bruto);
  if (typeof dados !== 'object' || dados === null || Array.isArray(dados)) return null;
  const entradas: Array<[string, unknown]> = Object.entries(dados);
  const mapa = new Map<string, T[]>();
  for (const [produtorId, valor] of entradas) {
    const lista = Array.isArray(valor) && produtorId.trim() !== '' ? lerListaDeOpcoes(valor, opcoes) : null;
    if (!lista) return null;
    mapa.set(produtorId, lista);
  }
  return mapa;
}

function lerJson(texto: string): unknown {
  try {
    return JSON.parse(texto);
  } catch {
    return undefined;
  }
}

export function lerOuEncerrar<T>(ler: () => T, sair: (mensagem: string) => never = sairComErro): T {
  try {
    return ler();
  } catch (erro) {
    if (erro instanceof ErroConfiguracao) return sair(erro.message);
    throw erro;
  }
}

function sairComErro(mensagem: string): never {
  console.error(mensagem);
  process.exit(1);
}
