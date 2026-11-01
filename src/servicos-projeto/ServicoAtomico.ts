import { Competencia, type VetorCompetencias } from '../domain/entities/Competencia';
import { PAPEIS_TECNICOS, type PapelRequerido, type PapelTecnico } from '../domain/entities/papeisTecnicos';
import { ErroValidacao } from '../domain/errors';
import type { ServicoProjeto } from './ServicoProjeto';
import type { VisitanteDeServicos } from './VisitanteDeServicos';

export const PESO_PADRAO_DO_SERVICO = 1;
export const PRAZO_MINIMO_DIAS = 1;

export interface DadosServicoAtomico {
  nome: string;
  papel: PapelTecnico;
  custo: number;
  prazoDias: number;
  peso?: number;
  competenciasDesejadas?: VetorCompetencias;
}

const SEM_SUBSERVICOS: readonly ServicoProjeto[] = Object.freeze([]);

export function erroDePapelInvalido(papel: unknown): ErroValidacao {
  return new ErroValidacao(`Papel técnico inválido: ${String(papel)}`);
}

export class ServicoAtomico implements ServicoProjeto {
  private readonly _nome: string;
  private readonly _papel: PapelTecnico;
  private readonly _custo: number;
  private readonly _prazoDias: number;
  private readonly _peso: number;
  private readonly _competenciasDesejadas: VetorCompetencias | undefined;

  constructor(dados: DadosServicoAtomico) {
    this._nome = dados.nome.trim();
    this._papel = dados.papel;
    this._custo = dados.custo;
    this._prazoDias = dados.prazoDias;
    this._peso = dados.peso ?? PESO_PADRAO_DO_SERVICO;
    this._competenciasDesejadas = dados.competenciasDesejadas ? Competencia.normalizarVetor(dados.competenciasDesejadas) : undefined;
  }

  get nome(): string {
    return this._nome;
  }

  get papel(): PapelTecnico {
    return this._papel;
  }

  get peso(): number {
    return this._peso;
  }

  get competenciasDesejadas(): VetorCompetencias | undefined {
    return this._competenciasDesejadas ? { ...this._competenciasDesejadas } : undefined;
  }

  calcularCusto(): number {
    return this._custo;
  }

  obterPrazo(): number {
    return this._prazoDias;
  }

  listarSubservicos(): readonly ServicoProjeto[] {
    return SEM_SUBSERVICOS;
  }

  validar(): void {
    if (!this._nome) throw new ErroValidacao('Nome do serviço é obrigatório');
    if (!PAPEIS_TECNICOS.includes(this._papel)) throw erroDePapelInvalido(this._papel);
    if (!Number.isFinite(this._custo) || this._custo < 0) {
      throw new ErroValidacao(`Custo do serviço "${this._nome}" deve ser um número maior ou igual a zero`);
    }
    if (!Number.isInteger(this._prazoDias) || this._prazoDias < PRAZO_MINIMO_DIAS) {
      throw new ErroValidacao(`Prazo do serviço "${this._nome}" deve ser um número inteiro de dias maior ou igual a ${PRAZO_MINIMO_DIAS}`);
    }
    if (!Number.isFinite(this._peso) || this._peso <= 0) throw new ErroValidacao(`Peso do papel ${this._papel} deve ser positivo`);
  }

  aceitar(visitante: VisitanteDeServicos): void {
    visitante.visitarServicoAtomico(this);
  }

  papelRequerido(): PapelRequerido {
    const competenciasDesejadas = this.competenciasDesejadas;
    return { papel: this._papel, peso: this._peso, ...(competenciasDesejadas ? { competenciasDesejadas } : {}) };
  }

  dados(): DadosServicoAtomico {
    const competenciasDesejadas = this.competenciasDesejadas;
    return {
      nome: this._nome,
      papel: this._papel,
      custo: this._custo,
      prazoDias: this._prazoDias,
      peso: this._peso,
      ...(competenciasDesejadas ? { competenciasDesejadas } : {}),
    };
  }
}
