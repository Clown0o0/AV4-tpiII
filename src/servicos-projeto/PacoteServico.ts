import { ErroValidacao } from '../domain/errors';
import { ColetorDeServicosAtomicos } from './ColetorDeServicosAtomicos';
import type { ServicoProjeto } from './ServicoProjeto';
import type { VisitanteDeServicos } from './VisitanteDeServicos';

export class PacoteServico implements ServicoProjeto {
  private readonly _nome: string;
  private readonly _servicos: readonly ServicoProjeto[];

  constructor(nome: string, servicos: readonly ServicoProjeto[]) {
    this._nome = nome.trim();
    this._servicos = Object.freeze([...servicos]);
  }

  get nome(): string {
    return this._nome;
  }

  calcularCusto(): number {
    return this._servicos.reduce((total, servico) => total + servico.calcularCusto(), 0);
  }

  obterPrazo(): number {
    return this._servicos.reduce((total, servico) => total + servico.obterPrazo(), 0);
  }

  listarSubservicos(): readonly ServicoProjeto[] {
    return Object.freeze([...this._servicos]);
  }

  validar(): void {
    if (!this._nome) throw new ErroValidacao('Nome do pacote de serviços é obrigatório');
    if (this._servicos.length === 0) throw new ErroValidacao(`O pacote "${this._nome}" deve conter ao menos um serviço`);
    ColetorDeServicosAtomicos.coletar(this);
    for (const servico of this._servicos) servico.validar();
  }

  aceitar(visitante: VisitanteDeServicos): void {
    visitante.visitarPacoteServico(this);
  }
}
