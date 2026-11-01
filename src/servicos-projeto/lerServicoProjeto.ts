import { PAPEIS_TECNICOS, type PapelRequerido } from '../domain/entities/papeisTecnicos';
import { ErroValidacao } from '../domain/errors';
import { PROFUNDIDADE_MAXIMA_DE_SERVICOS } from './ColetorDeServicosAtomicos';
import { PacoteServico } from './PacoteServico';
import { erroDePapelInvalido, ServicoAtomico } from './ServicoAtomico';
import { TIPOS_SERVICO, type TipoServico } from './ServicoJson';
import type { ServicoProjeto } from './ServicoProjeto';

export const NOME_DO_PACOTE_DOS_PAPEIS = 'Serviços do projeto';
export const CUSTO_PADRAO_DO_PAPEL = 0;
export const PRAZO_PADRAO_DO_PAPEL_DIAS = 1;

type ObjetoJson = Readonly<Record<string, unknown>>;
type LeitorDeServico = (objeto: ObjetoJson, profundidade: number) => ServicoProjeto;

const LEITORES: Readonly<Record<TipoServico, LeitorDeServico>> = {
  ATOMICO: lerAtomico,
  PACOTE: lerPacote,
};

export function lerServicoProjeto(valor: unknown, profundidade = 1): ServicoProjeto {
  if (profundidade > PROFUNDIDADE_MAXIMA_DE_SERVICOS) {
    throw new ErroValidacao(`A estrutura de serviços excede a profundidade máxima de ${PROFUNDIDADE_MAXIMA_DE_SERVICOS} níveis`);
  }
  const objeto = objetoJson(valor);
  const tipo = TIPOS_SERVICO.find((opcao) => opcao === objeto.tipo);
  if (!tipo) throw new ErroValidacao(`Tipo de serviço inválido: ${String(objeto.tipo)} (use ${TIPOS_SERVICO.join(' ou ')})`);
  return LEITORES[tipo](objeto, profundidade);
}

export function pacoteDosPapeis(papeis: readonly PapelRequerido[]): PacoteServico {
  return new PacoteServico(
    NOME_DO_PACOTE_DOS_PAPEIS,
    papeis.map(
      (papel) =>
        new ServicoAtomico({
          nome: papel.papel,
          papel: papel.papel,
          custo: CUSTO_PADRAO_DO_PAPEL,
          prazoDias: PRAZO_PADRAO_DO_PAPEL_DIAS,
          peso: papel.peso,
          ...(papel.competenciasDesejadas ? { competenciasDesejadas: papel.competenciasDesejadas } : {}),
        }),
    ),
  );
}

function lerAtomico(objeto: ObjetoJson): ServicoProjeto {
  const papel = PAPEIS_TECNICOS.find((opcao) => opcao === objeto.papel);
  if (!papel) throw erroDePapelInvalido(objeto.papel);
  const competenciasDesejadas = vetorOpcional(objeto.competenciasDesejadas);
  return new ServicoAtomico({
    nome: texto(objeto.nome),
    papel,
    custo: numero(objeto.custo),
    prazoDias: numero(objeto.prazoDias),
    ...(objeto.peso === undefined ? {} : { peso: numero(objeto.peso) }),
    ...(competenciasDesejadas ? { competenciasDesejadas } : {}),
  });
}

function lerPacote(objeto: ObjetoJson, profundidade: number): ServicoProjeto {
  const servicos = Array.isArray(objeto.servicos) ? objeto.servicos : [];
  return new PacoteServico(
    texto(objeto.nome),
    servicos.map((servico: unknown) => lerServicoProjeto(servico, profundidade + 1)),
  );
}

function objetoJson(valor: unknown): ObjetoJson {
  if (typeof valor !== 'object' || valor === null || Array.isArray(valor)) {
    throw new ErroValidacao('Cada serviço deve ser um objeto JSON com "tipo" ATOMICO ou PACOTE');
  }
  return Object.fromEntries(Object.entries(valor));
}

function texto(valor: unknown): string {
  return typeof valor === 'string' ? valor : '';
}

function numero(valor: unknown): number {
  return typeof valor === 'number' ? valor : Number.NaN;
}

function vetorOpcional(valor: unknown): Record<string, number> | undefined {
  if (valor === undefined) return undefined;
  if (typeof valor !== 'object' || valor === null || Array.isArray(valor)) throw erroDoVetorDeCompetencias();
  const entradas: Array<[string, unknown]> = Object.entries(valor);
  const vetor: Record<string, number> = {};
  for (const [nome, nivel] of entradas) {
    if (typeof nivel !== 'number') throw erroDoVetorDeCompetencias();
    vetor[nome] = nivel;
  }
  return vetor;
}

function erroDoVetorDeCompetencias(): ErroValidacao {
  return new ErroValidacao('competenciasDesejadas deve ser um objeto com níveis numéricos entre 0 e 1');
}
