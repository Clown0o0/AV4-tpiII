import type { AdaptadorProfissional, AvaliacaoProfissional } from '../adaptadores/profissional/AdaptadorProfissional';
import { Avaliacao } from '../domain/entities/Avaliacao';
import type { FonteDeProfissionais } from '../domain/ports/FonteDeProfissionais';

export interface AvaliacaoRegistrada extends AvaliacaoProfissional {
  profissionalId: string;
}

export interface ServicoDeAvaliacoes {
  avaliar(adaptador: AdaptadorProfissional, profissionalId: string, avaliacao: AvaliacaoProfissional): Promise<AvaliacaoRegistrada>;
}

export class GestorDeAvaliacoes implements ServicoDeAvaliacoes {
  constructor(private readonly catalogo: FonteDeProfissionais) {}

  async avaliar(adaptador: AdaptadorProfissional, profissionalId: string, avaliacao: AvaliacaoProfissional): Promise<AvaliacaoRegistrada> {
    const validada = new Avaliacao({ profissionalId, ...avaliacao });
    const registrada: AvaliacaoRegistrada = {
      profissionalId,
      autorId: validada.autorId,
      nota: validada.nota,
      comentario: validada.comentario,
    };
    await adaptador.registrarAvaliacao(profissionalId, registrada);
    this.catalogo.invalidar();
    return registrada;
  }
}
