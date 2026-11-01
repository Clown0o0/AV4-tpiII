import type { PacoteServico } from './PacoteServico';
import type { ServicoAtomico } from './ServicoAtomico';
import type { ServicoProjeto } from './ServicoProjeto';
import type { VisitanteDeServicos } from './VisitanteDeServicos';

export interface RegrasDeTransformacao<R> {
  atomico(servico: ServicoAtomico): R;
  pacote(pacote: PacoteServico, subservicos: readonly R[]): R;
}

export class TransformadorDeServicos<R> implements VisitanteDeServicos {
  private readonly resultados: R[] = [];

  private constructor(private readonly regras: RegrasDeTransformacao<R>) {}

  static aplicar<R>(servico: ServicoProjeto, regras: RegrasDeTransformacao<R>): R {
    const transformador = new TransformadorDeServicos(regras);
    servico.aceitar(transformador);
    const [resultado] = transformador.resultados;
    if (transformador.resultados.length !== 1 || resultado === undefined) {
      throw new TypeError('O serviço não se apresentou ao visitante exatamente uma vez');
    }
    return resultado;
  }

  visitarServicoAtomico(servico: ServicoAtomico): void {
    this.resultados.push(this.regras.atomico(servico));
  }

  visitarPacoteServico(pacote: PacoteServico): void {
    const subservicos = pacote.listarSubservicos().map((servico) => TransformadorDeServicos.aplicar(servico, this.regras));
    this.resultados.push(this.regras.pacote(pacote, subservicos));
  }
}
