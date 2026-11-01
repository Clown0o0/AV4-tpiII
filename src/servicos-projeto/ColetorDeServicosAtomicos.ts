import type { PapelTecnico } from '../domain/entities/papeisTecnicos';
import { ErroValidacao } from '../domain/errors';
import type { PacoteServico } from './PacoteServico';
import type { ServicoAtomico } from './ServicoAtomico';
import type { ServicoProjeto } from './ServicoProjeto';
import type { VisitanteDeServicos } from './VisitanteDeServicos';

export const PROFUNDIDADE_MAXIMA_DE_SERVICOS = 10;

export class ColetorDeServicosAtomicos implements VisitanteDeServicos {
  private readonly atomicos: ServicoAtomico[] = [];
  private readonly visitados = new Set<ServicoProjeto>();
  private readonly papeis = new Set<PapelTecnico>();
  private profundidade = 0;

  static coletar(raiz: ServicoProjeto): readonly ServicoAtomico[] {
    const coletor = new ColetorDeServicosAtomicos();
    coletor.percorrer(raiz);
    return Object.freeze([...coletor.atomicos]);
  }

  visitarServicoAtomico(servico: ServicoAtomico): void {
    if (this.papeis.has(servico.papel)) throw new ErroValidacao(`Papel ${servico.papel} informado mais de uma vez`);
    this.papeis.add(servico.papel);
    this.atomicos.push(servico);
  }

  visitarPacoteServico(pacote: PacoteServico): void {
    for (const servico of pacote.listarSubservicos()) this.percorrer(servico);
  }

  private percorrer(servico: ServicoProjeto): void {
    if (this.visitados.has(servico)) throw new ErroValidacao('O mesmo serviço aparece mais de uma vez na estrutura de serviços');
    this.visitados.add(servico);
    this.profundidade += 1;
    if (this.profundidade > PROFUNDIDADE_MAXIMA_DE_SERVICOS) {
      throw new ErroValidacao(`A estrutura de serviços excede a profundidade máxima de ${PROFUNDIDADE_MAXIMA_DE_SERVICOS} níveis`);
    }
    servico.aceitar(this);
    this.profundidade -= 1;
  }
}
