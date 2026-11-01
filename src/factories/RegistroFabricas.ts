// submarino
import { ErroValidacao } from '../domain/errors';
import type { TipoCaptacao } from '../domain/entities/Projeto';
import { FabricaAnimacao } from './animacao/FabricaAnimacao';
import { FabricaDocumentario } from './documentario/FabricaDocumentario';
import { CossenoStrategy } from '../strategies/CossenoStrategy';
import type { CatalogoFabricas, FabricaProjeto, OpcoesFabrica } from './FabricaProjeto';
import { FabricaFiccao } from './ficcao/FabricaFiccao';
import { FabricaPublicitario } from './publicitario/FabricaPublicitario';

export class RegistroFabricas implements CatalogoFabricas {
  private readonly fabricas = new Map<TipoCaptacao, FabricaProjeto>();

  constructor(fabricas: readonly FabricaProjeto[] = []) {
    for (const fabrica of fabricas) this.registrar(fabrica);
  }

  static padrao(opcoes: Partial<OpcoesFabrica> = {}): RegistroFabricas {
    const completas: OpcoesFabrica = { estrategiaBase: new CossenoStrategy(), ...opcoes };
    return new RegistroFabricas([
      new FabricaDocumentario(completas),
      new FabricaFiccao(completas),
      new FabricaAnimacao(completas),
      new FabricaPublicitario(completas),
    ]);
  }

  registrar(fabrica: FabricaProjeto): void {
    this.fabricas.set(fabrica.tipo, fabrica);
  }

  obter(tipo: TipoCaptacao): FabricaProjeto {
    const fabrica = this.fabricas.get(tipo);
    if (!fabrica) throw new ErroValidacao(`Tipo de projeto sem fábrica registrada: ${tipo}`);
    return fabrica;
  }

  tipos(): TipoCaptacao[] {
    return [...this.fabricas.keys()];
  }

  todas(): FabricaProjeto[] {
    return [...this.fabricas.values()];
  }
}
