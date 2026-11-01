import { performance } from 'node:perf_hooks';
import type { Profissional } from '../../domain/entities/Profissional';
import { arredondar, type CandidatoPontuado, type ContextoEstrategia, type RecomendacaoStrategy } from '../RecomendacaoStrategy';
import { DecoradorDeRecomendacao } from './DecoradorDeRecomendacao';
import { EVENTO_AUDITORIA_RECOMENDACAO, type RegistroDeAuditoria } from './RegistroDeAuditoria';

const CASAS_DECIMAIS_DA_DURACAO = 3;

export class AuditoriaDecorator extends DecoradorDeRecomendacao {
  constructor(
    interno: RecomendacaoStrategy,
    private readonly registro: RegistroDeAuditoria,
    private readonly medirTempo: () => number = () => performance.now(),
  ) {
    super(interno);
  }

  recomendar(candidatos: readonly Profissional[], contexto: ContextoEstrategia): CandidatoPontuado[] {
    const inicio = this.medirTempo();
    const ranking = this.interno.recomendar(candidatos, contexto);
    this.registro.registrar({
      evento: EVENTO_AUDITORIA_RECOMENDACAO,
      estrategia: this.tipo,
      papel: contexto.papel,
      projetoId: contexto.projeto.id,
      candidatos: candidatos.length,
      devolvidos: ranking.length,
      duracaoMs: arredondar(this.medirTempo() - inicio, CASAS_DECIMAIS_DA_DURACAO),
    });
    return ranking;
  }
}
