import { createHash } from 'node:crypto';
import { obterOuCalcular } from '../../compartilhado/memoizacao';
import type { Profissional } from '../../domain/entities/Profissional';
import type { TipoEstrategia } from '../../domain/entities/Projeto';
import type { ContextoEstrategia } from '../RecomendacaoStrategy';

export class ChaveDeRecomendacao {
  private readonly idsDosProfissionais = new WeakMap<Profissional, number>();
  private readonly impressoesDosUniversos = new WeakMap<readonly Profissional[], string>();
  private proximoId = 0;

  gerar(estrategia: TipoEstrategia, candidatos: readonly Profissional[], contexto: ContextoEstrategia): string {
    return createHash('sha256')
      .update(JSON.stringify(camposDoContexto(estrategia, contexto)))
      .update('|')
      .update(this.impressao(candidatos))
      .update('|')
      .update(obterOuCalcular(this.impressoesDosUniversos, contexto.universo, () => this.impressao(contexto.universo)))
      .digest('base64');
  }

  private impressao(profissionais: readonly Profissional[]): string {
    return profissionais.map((profissional) => this.idDe(profissional)).join(',');
  }

  private idDe(profissional: Profissional): number {
    return obterOuCalcular(this.idsDosProfissionais, profissional, () => {
      this.proximoId += 1;
      return this.proximoId;
    });
  }
}

function camposDoContexto(estrategia: TipoEstrategia, contexto: ContextoEstrategia): unknown[] {
  const { projeto } = contexto;
  const perfil = Object.entries(contexto.perfilDesejado).sort(([a], [b]) => a.localeCompare(b));
  return [
    estrategia,
    contexto.papel,
    perfil,
    contexto.orcamentoPapel,
    projeto.produtorId,
    projeto.tipoCaptacao,
    projeto.genero,
    projeto.localizacao,
    projeto.dataEntrega.getTime(),
    projeto.detalhes,
  ];
}
