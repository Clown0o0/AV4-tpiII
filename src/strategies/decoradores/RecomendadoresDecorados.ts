import { obterOuCalcular } from '../../compartilhado/memoizacao';
import type { FabricaProjeto } from '../../factories/FabricaProjeto';
import type { RecomendacaoStrategy } from '../RecomendacaoStrategy';
import type { MontadorDePilhaDeDecoradores } from './MontadorDePilhaDeDecoradores';
import type { PoliticaDeDecoradores } from './PoliticaDeDecoradores';
import { RecomendadorConfiguravel } from './RecomendadorConfiguravel';

export class RecomendadoresDecorados {
  private readonly porFabrica = new WeakMap<FabricaProjeto, Map<RecomendacaoStrategy | null, RecomendacaoStrategy>>();

  constructor(
    private readonly politica: PoliticaDeDecoradores,
    private readonly montador: MontadorDePilhaDeDecoradores,
  ) {}

  obter(origem: FabricaProjeto, base: RecomendacaoStrategy | null, criarProduto: () => RecomendacaoStrategy): RecomendacaoStrategy {
    const porBase = obterOuCalcular(this.porFabrica, origem, () => new Map<RecomendacaoStrategy | null, RecomendacaoStrategy>());
    return obterOuCalcular(porBase, base, () => new RecomendadorConfiguravel(criarProduto(), this.politica, this.montador));
  }
}
