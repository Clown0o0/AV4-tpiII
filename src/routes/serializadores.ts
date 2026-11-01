import { servicoParaJson, type ServicoJson } from '../servicos-projeto/ServicoJson';
import type { ArquivoComConteudo, ArquivoDoProjeto } from '../services/GestorDeArquivos';
import type { Convite, StatusConvite } from '../domain/entities/Convite';
import type { VetorCompetencias } from '../domain/entities/Competencia';
import type { Profissional } from '../domain/entities/Profissional';
import type {
  DetalhesProjeto,
  PapelRequerido,
  PapelTecnico,
  Projeto,
  TipoCaptacao,
  TipoEstrategia,
} from '../domain/entities/Projeto';
import type {
  Alternativa,
  MembroRecomendadoLeitura,
  Recomendacao,
  StatusMembro,
  StatusRecomendacao,
} from '../domain/entities/Recomendacao';

export interface ProjetoJson {
  id: string;
  titulo: string;
  produtorId: string;
  produtorEmail: string | null;
  genero: string;
  duracaoEstimadaMin: number;
  orcamentoTotal: number;
  dataEntrega: string;
  tipoCaptacao: TipoCaptacao;
  localizacao: string;
  estrategia: TipoEstrategia;
  papeis: readonly PapelRequerido[];
  servicoPrincipal: ServicoJson;
  custoTotal: number;
  prazoTotalDias: number;
  detalhes: DetalhesProjeto | null;
}

export interface MembroJson {
  id: string;
  papel: PapelTecnico;
  profissionalId: string;
  score: number;
  custo: number;
  status: StatusMembro;
  rodada: number;
  alternativas: readonly Alternativa[];
}

export interface RecomendacaoJson {
  id: string;
  projetoId: string;
  estrategia: TipoEstrategia;
  status: StatusRecomendacao;
  parcial: boolean;
  avisos: readonly string[];
  rodadas: number;
  custoTotal: number;
  criadaEm: string;
  finalizadaEm: string | null;
  equipe: MembroJson[];
  historico: MembroJson[];
}

export interface ConviteJson {
  id: string;
  recomendacaoId: string;
  projetoId: string;
  profissionalId: string;
  papel: PapelTecnico;
  status: StatusConvite;
  criadoEm: string;
  respondidoEm: string | null;
}

export interface ArquivoJson {
  arquivoId: string;
  projetoId: string;
  nome: string;
  categoria: string;
}

export interface ArquivoComConteudoJson extends ArquivoJson {
  tamanhoBytes: number;
  conteudoBase64: string;
}

export interface ProfissionalJson {
  id: string;
  nome: string;
  especialidades: readonly PapelTecnico[];
  precoMin: number;
  precoMax: number;
  localizacao: string;
  competencias: VetorCompetencias;
  historicoProjetos: readonly string[];
  disponibilidade: Array<{ inicio: string; fim: string }>;
  mediaAvaliacoes: number | null;
  totalAvaliacoes: number;
}

export function arquivoJson(arquivo: ArquivoDoProjeto): ArquivoJson {
  return { arquivoId: arquivo.arquivoId, projetoId: arquivo.projetoId, nome: arquivo.nome, categoria: arquivo.categoria };
}

export function arquivoComConteudoJson(arquivo: ArquivoComConteudo): ArquivoComConteudoJson {
  return { ...arquivoJson(arquivo), tamanhoBytes: arquivo.conteudo.byteLength, conteudoBase64: arquivo.conteudo.toString('base64') };
}

export function profissionalJson(profissional: Profissional): ProfissionalJson {
  return {
    id: profissional.id,
    nome: profissional.nome,
    especialidades: [...profissional.especialidades],
    precoMin: profissional.precoMin,
    precoMax: profissional.precoMax,
    localizacao: profissional.localizacao,
    competencias: { ...profissional.vetorCompetencias() },
    historicoProjetos: [...profissional.historicoProjetos],
    disponibilidade: profissional.disponibilidade.map((j) => ({ inicio: j.inicio.toISOString(), fim: j.fim.toISOString() })),
    mediaAvaliacoes: profissional.mediaAvaliacoes(),
    totalAvaliacoes: profissional.avaliacoes.length,
  };
}

export function projetoJson(projeto: Projeto): ProjetoJson {
  return {
    id: projeto.id,
    titulo: projeto.titulo,
    produtorId: projeto.produtorId,
    produtorEmail: projeto.produtorEmail,
    genero: projeto.genero,
    duracaoEstimadaMin: projeto.duracaoEstimadaMin,
    orcamentoTotal: projeto.orcamentoTotal,
    dataEntrega: projeto.dataEntrega.toISOString(),
    tipoCaptacao: projeto.tipoCaptacao,
    localizacao: projeto.localizacao,
    estrategia: projeto.estrategia,
    papeis: projeto.papeis,
    servicoPrincipal: servicoParaJson(projeto.servicoPrincipal),
    custoTotal: projeto.calcularCustoTotal(),
    prazoTotalDias: projeto.calcularPrazoTotalDias(),
    detalhes: projeto.detalhes,
  };
}

export function membroJson(membro: MembroRecomendadoLeitura): MembroJson {
  return {
    id: membro.id,
    papel: membro.papel,
    profissionalId: membro.profissionalId,
    score: membro.score,
    custo: membro.custo,
    status: membro.status,
    rodada: membro.rodada,
    alternativas: membro.alternativas,
  };
}

export function recomendacaoJson(recomendacao: Recomendacao): RecomendacaoJson {
  return {
    id: recomendacao.id,
    projetoId: recomendacao.projetoId,
    estrategia: recomendacao.estrategia,
    status: recomendacao.status,
    parcial: recomendacao.parcial,
    avisos: recomendacao.avisos,
    rodadas: recomendacao.rodadas,
    custoTotal: recomendacao.custoTotal(),
    criadaEm: recomendacao.criadaEm.toISOString(),
    finalizadaEm: recomendacao.finalizadaEm?.toISOString() ?? null,
    equipe: recomendacao.membrosAtivos().map(membroJson),
    historico: recomendacao.membros.filter((m) => !m.ativo).map(membroJson),
  };
}

export function conviteJson(convite: Convite): ConviteJson {
  return {
    id: convite.id,
    recomendacaoId: convite.recomendacaoId,
    projetoId: convite.projetoId,
    profissionalId: convite.profissionalId,
    papel: convite.papel,
    status: convite.status,
    criadoEm: convite.criadoEm.toISOString(),
    respondidoEm: convite.respondidoEm?.toISOString() ?? null,
  };
}
