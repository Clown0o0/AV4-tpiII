import { Avaliacao } from '../../domain/entities/Avaliacao';
import { Competencia } from '../../domain/entities/Competencia';
import { PAPEIS_TECNICOS } from '../../domain/entities/papeisTecnicos';
import { Profissional } from '../../domain/entities/Profissional';
import { data, lista, numero, objeto, opcoesDe, texto, textoOuNulo, textos } from '../leitorJson';

export interface ProfissionalJson {
  id: string;
  nome: string;
  email: string;
  especialidades: string[];
  precoMin: number;
  precoMax: number;
  localizacao: string;
  historicoProjetos: string[];
  disponibilidade: Array<{ inicio: string; fim: string }>;
  competencias: Array<{ nome: string; nivel: number }>;
  avaliacoes: Array<{
    id: string;
    profissionalId: string;
    autorId: string;
    projetoId: string | null;
    nota: number;
    comentario: string | null;
    criadaEm: string;
  }>;
}

export function profissionalParaJson(profissional: Profissional): ProfissionalJson {
  return {
    id: profissional.id,
    nome: profissional.nome,
    email: profissional.email,
    especialidades: [...profissional.especialidades],
    precoMin: profissional.precoMin,
    precoMax: profissional.precoMax,
    localizacao: profissional.localizacao,
    historicoProjetos: [...profissional.historicoProjetos],
    disponibilidade: profissional.disponibilidade.map((janela) => ({ inicio: janela.inicio.toISOString(), fim: janela.fim.toISOString() })),
    competencias: profissional.competencias.map((competencia) => ({ nome: competencia.nome, nivel: competencia.nivel })),
    avaliacoes: profissional.avaliacoes.map((avaliacao) => ({
      id: avaliacao.id,
      profissionalId: avaliacao.profissionalId,
      autorId: avaliacao.autorId,
      projetoId: avaliacao.projetoId,
      nota: avaliacao.nota,
      comentario: avaliacao.comentario,
      criadaEm: avaliacao.criadaEm.toISOString(),
    })),
  };
}

export function profissionalDeJson(valor: unknown): Profissional {
  const json = objeto(valor, 'profissional');
  return new Profissional({
    id: texto(json, 'id'),
    nome: texto(json, 'nome'),
    email: texto(json, 'email'),
    especialidades: opcoesDe(json, 'especialidades', PAPEIS_TECNICOS),
    precoMin: numero(json, 'precoMin'),
    precoMax: numero(json, 'precoMax'),
    localizacao: texto(json, 'localizacao'),
    historicoProjetos: textos(json, 'historicoProjetos'),
    disponibilidade: lista(json.disponibilidade, 'disponibilidade').map((item) => {
      const janela = objeto(item, 'janela');
      return { inicio: data(janela, 'inicio'), fim: data(janela, 'fim') };
    }),
    competencias: lista(json.competencias, 'competencias').map((item) => {
      const competencia = objeto(item, 'competencia');
      return new Competencia(texto(competencia, 'nome'), numero(competencia, 'nivel'));
    }),
    avaliacoes: lista(json.avaliacoes, 'avaliacoes').map((item) => avaliacaoDeJson(objeto(item, 'avaliacao'))),
  });
}

export function profissionaisDeJson(valor: unknown): Profissional[] {
  return lista(valor, 'profissionais').map(profissionalDeJson);
}

function avaliacaoDeJson(json: Readonly<Record<string, unknown>>): Avaliacao {
  return new Avaliacao({
    id: texto(json, 'id'),
    profissionalId: texto(json, 'profissionalId'),
    autorId: texto(json, 'autorId'),
    projetoId: textoOuNulo(json, 'projetoId'),
    nota: numero(json, 'nota'),
    comentario: textoOuNulo(json, 'comentario'),
    criadaEm: data(json, 'criadaEm'),
  });
}
