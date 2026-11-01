import type { Profissional } from '../../domain/entities/Profissional';
import type { ProfissionalRepository } from '../../domain/ports/ProfissionalRepository';

export interface FiltrosDePerfis {
  readonly ids?: readonly string[];
}

export type ConversorDePerfil<P> = (profissional: Profissional, notasRecebidas: readonly number[]) => P;

export class ApiProfissionalExterna<P> {
  private readonly notasPorProfissional = new Map<string, number[]>();

  constructor(
    private readonly cadastroDaPlataforma: ProfissionalRepository,
    private readonly paraPerfil: ConversorDePerfil<P>,
  ) {}

  async buscarProfissionais(filtros: FiltrosDePerfis): Promise<P[]> {
    const profissionais = filtros.ids
      ? await this.cadastroDaPlataforma.buscarPorIds(filtros.ids)
      : await this.cadastroDaPlataforma.listarTodos();
    return profissionais.map((profissional) => this.perfilDe(profissional));
  }

  async obterPerfil(id: string): Promise<P | null> {
    const profissional = await this.cadastroDaPlataforma.buscarPorId(id);
    return profissional ? this.perfilDe(profissional) : null;
  }

  async avaliarProfissional(id: string, nota: number): Promise<void> {
    const notas = this.notasPorProfissional.get(id) ?? [];
    this.notasPorProfissional.set(id, [...notas, nota]);
  }

  private perfilDe(profissional: Profissional): P {
    return this.paraPerfil(profissional, this.notasPorProfissional.get(profissional.id) ?? []);
  }
}
