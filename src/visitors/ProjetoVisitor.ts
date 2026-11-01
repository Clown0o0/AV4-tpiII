import type { Profissional } from '../domain/entities/Profissional';
import type { Projeto } from '../domain/entities/Projeto';
import type { Recomendacao } from '../domain/entities/Recomendacao';
import type { Visitante } from '../domain/entities/Visitante';

export interface ProjetoVisitor<R> extends Visitante {
  resultado(): R;
}

export class EstruturaEquipe {
  constructor(
    readonly projeto: Projeto,
    readonly recomendacao: Recomendacao,
    readonly profissionais: readonly Profissional[],
  ) {}

  aceitar<R>(visitor: ProjetoVisitor<R>): R {
    this.projeto.aceitar(visitor);
    this.recomendacao.aceitar(visitor);
    const ativos = new Set(this.recomendacao.membrosAtivos().map((m) => m.profissionalId));
    for (const profissional of this.profissionais) {
      if (ativos.has(profissional.id)) profissional.aceitar(visitor);
    }
    return visitor.resultado();
  }
}
