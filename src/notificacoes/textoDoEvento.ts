import { EVENTOS } from '../events/EventTypes';
import { EVENTOS_DE_PROJETO, type EventoIntegrado } from '../mensageria/codecs/eventoIntegradoJson';

const TEXTOS: Readonly<Record<string, (titulo: string) => string>> = {
  [EVENTOS_DE_PROJETO.CRIADO]: (titulo) => `Projeto "${titulo}" cadastrado`,
  [EVENTOS_DE_PROJETO.ATUALIZADO]: (titulo) => `Projeto "${titulo}" atualizado`,
  [EVENTOS_DE_PROJETO.FINALIZADO]: (titulo) => `Projeto "${titulo}" finalizado: equipe completa`,
  [EVENTOS.RECOMENDACAO_GERADA]: (titulo) => `Nova recomendação de equipe para "${titulo}"`,
  [EVENTOS.MEMBRO_REJEITADO]: (titulo) => `Um papel de "${titulo}" voltou a ficar em aberto`,
  [EVENTOS.MEMBRO_SUBSTITUIDO]: (titulo) => `Nova sugestão de substituto em "${titulo}"`,
  [EVENTOS.INTERESSE_PRODUTOR]: (titulo) => `Convite enviado para o projeto "${titulo}"`,
  [EVENTOS.CONVITE_ACEITO]: (titulo) => `Convite aceito no projeto "${titulo}"`,
  [EVENTOS.CONVITE_RECUSADO]: (titulo) => `Convite recusado no projeto "${titulo}"`,
  [EVENTOS.PROJETO_ALTERADO]: (titulo) => `Projeto "${titulo}" alterado`,
  [EVENTOS.EQUIPE_FINALIZADA]: (titulo) => `A equipe de "${titulo}" está completa`,
};

export function textoDoEvento(evento: EventoIntegrado): string {
  return TEXTOS[evento.nome]?.(evento.titulo) ?? `Evento ${evento.nome} no projeto "${evento.titulo}"`;
}
