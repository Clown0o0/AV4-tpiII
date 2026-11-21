import type { Projeto } from '../../domain/entities/Projeto';
import type { Profissional } from '../../domain/entities/Profissional';
import type { Recomendacao } from '../../domain/entities/Recomendacao';
import { EVENTOS, type EventoRecomendacao } from '../../events/EventTypes';
import type { Destinatario, EventoIntegrado } from './eventoIntegradoJson';

export function eventoDeRecomendacaoIntegrado(evento: EventoRecomendacao, id: string): EventoIntegrado {
  const { payload } = evento;
  const projeto = 'projeto' in payload ? payload.projeto : undefined;
  return {
    id,
    nome: evento.nome,
    origem: 'RECOMENDACOES',
    projetoId: payload.projetoId,
    titulo: projeto?.titulo ?? payload.projetoId,
    produtor: projeto ? produtorDe(projeto) : { id: payload.ator.id, email: null, nome: null },
    destinatarios: destinatariosDe(evento),
    ocorridoEm: payload.ocorridoEm,
  };
}

export function produtorDe(projeto: Projeto): Destinatario {
  return { id: projeto.produtorId, email: projeto.produtorEmail ?? `${projeto.produtorId}@produtores.cinebridge.local`, nome: null };
}

function destinatariosDe(evento: EventoRecomendacao): Destinatario[] {
  switch (evento.nome) {
    case EVENTOS.RECOMENDACAO_GERADA:
      return evento.payload.profissionaisSugeridos.map(deProfissional);
    case EVENTOS.MEMBRO_SUBSTITUIDO:
      return evento.payload.profissionalNovo ? [deProfissional(evento.payload.profissionalNovo)] : [];
    case EVENTOS.INTERESSE_PRODUTOR:
    case EVENTOS.CONVITE_ACEITO:
    case EVENTOS.CONVITE_RECUSADO:
      return [evento.payload.profissional ? deProfissional(evento.payload.profissional) : apenasId(evento.payload.convite.profissionalId)];
    case EVENTOS.EQUIPE_FINALIZADA:
      return membrosDe(evento.payload.recomendacao);
    case EVENTOS.INTEGRACAO_GERENCIAMENTO_PROJETOS:
      return evento.payload.equipe.map((membro) => apenasId(membro.profissionalId));
    case EVENTOS.INTEGRACAO_FINANCEIRO:
      return evento.payload.pagamentos.map((pagamento) => apenasId(pagamento.profissionalId));
    default:
      return [];
  }
}

function deProfissional(profissional: Profissional): Destinatario {
  return { id: profissional.id, email: profissional.email, nome: profissional.nome };
}

function apenasId(id: string): Destinatario {
  return { id, email: null, nome: null };
}

function membrosDe(recomendacao: Recomendacao): Destinatario[] {
  return recomendacao.membrosAtivos().map((membro) => apenasId(membro.profissionalId));
}
