import { obterOuCalcular } from '../../compartilhado/memoizacao';
import type { Profissional } from '../../domain/entities/Profissional';
import type { TipoEstrategia } from '../../domain/entities/Projeto';
import type { CandidatoPontuado, ContextoEstrategia, RecomendacaoStrategy } from '../RecomendacaoStrategy';
import type { MontadorDePilhaDeDecoradores } from './MontadorDePilhaDeDecoradores';
import type { NomeDecorador } from './nomesDosDecoradores';
import type { PoliticaDeDecoradores } from './PoliticaDeDecoradores';

const SEPARADOR_DA_PILHA = ',';

export class RecomendadorConfiguravel implements RecomendacaoStrategy {
  private readonly pilhas = new Map<string, RecomendacaoStrategy>();

  constructor(
    private readonly estrategia: RecomendacaoStrategy,
    private readonly politica: PoliticaDeDecoradores,
    private readonly montador: MontadorDePilhaDeDecoradores,
  ) {}

  get tipo(): TipoEstrategia {
    return this.estrategia.tipo;
  }

  get descricao(): string {
    return this.estrategia.descricao;
  }

  recomendar(candidatos: readonly Profissional[], contexto: ContextoEstrategia): CandidatoPontuado[] {
    return this.pilha(this.politica.pilhaPara(contexto.projeto.produtorId)).recomendar(candidatos, contexto);
  }

  private pilha(nomes: readonly NomeDecorador[]): RecomendacaoStrategy {
    return obterOuCalcular(this.pilhas, nomes.join(SEPARADOR_DA_PILHA), () => this.montador.montar(this.estrategia, nomes));
  }
}
