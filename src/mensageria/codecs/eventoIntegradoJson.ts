import { data, lista, objeto, opcao, texto, textoOuNulo } from '../leitorJson';

export const ORIGENS_DE_EVENTO = ['PROJETOS', 'RECOMENDACOES'] as const;
export type OrigemDoEvento = (typeof ORIGENS_DE_EVENTO)[number];

export const EVENTOS_DE_PROJETO = {
  CRIADO: 'projeto.criado',
  ATUALIZADO: 'projeto.atualizado',
  FINALIZADO: 'projeto.finalizado',
} as const;

export interface Destinatario {
  readonly id: string;
  readonly email: string | null;
  readonly nome: string | null;
}

export interface EventoIntegrado {
  readonly id: string;
  readonly nome: string;
  readonly origem: OrigemDoEvento;
  readonly projetoId: string;
  readonly titulo: string;
  readonly produtor: Destinatario;
  readonly destinatarios: readonly Destinatario[];
  readonly ocorridoEm: Date;
}

export interface EventoIntegradoJson {
  id: string;
  nome: string;
  origem: OrigemDoEvento;
  projetoId: string;
  titulo: string;
  produtor: Destinatario;
  destinatarios: Destinatario[];
  ocorridoEm: string;
}

export function eventoIntegradoParaJson(evento: EventoIntegrado): EventoIntegradoJson {
  return { ...evento, produtor: { ...evento.produtor }, destinatarios: evento.destinatarios.map((d) => ({ ...d })), ocorridoEm: evento.ocorridoEm.toISOString() };
}

export function eventoIntegradoDeJson(valor: unknown): EventoIntegrado {
  const json = objeto(valor, 'evento');
  return {
    id: texto(json, 'id'),
    nome: texto(json, 'nome'),
    origem: opcao(json, 'origem', ORIGENS_DE_EVENTO),
    projetoId: texto(json, 'projetoId'),
    titulo: texto(json, 'titulo'),
    produtor: destinatarioDeJson(json.produtor),
    destinatarios: lista(json.destinatarios, 'destinatarios').map(destinatarioDeJson),
    ocorridoEm: data(json, 'ocorridoEm'),
  };
}

function destinatarioDeJson(valor: unknown): Destinatario {
  const json = objeto(valor, 'destinatario');
  return { id: texto(json, 'id'), email: textoOuNulo(json, 'email'), nome: textoOuNulo(json, 'nome') };
}
