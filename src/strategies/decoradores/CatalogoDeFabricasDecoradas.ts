import type { TipoCaptacao } from '../../domain/entities/Projeto';
import type { CatalogoFabricas, FabricaProjeto } from '../../factories/FabricaProjeto';
import { FabricaComRecomendadorDecorado } from './FabricaComRecomendadorDecorado';
import type { RecomendadoresDecorados } from './RecomendadoresDecorados';

export class CatalogoDeFabricasDecoradas implements CatalogoFabricas {
  constructor(
    private readonly catalogo: CatalogoFabricas,
    private readonly recomendadores: RecomendadoresDecorados,
  ) {}

  obter(tipo: TipoCaptacao): FabricaProjeto {
    return new FabricaComRecomendadorDecorado(this.catalogo.obter(tipo), this.recomendadores);
  }

  tipos(): TipoCaptacao[] {
    return this.catalogo.tipos();
  }
}
