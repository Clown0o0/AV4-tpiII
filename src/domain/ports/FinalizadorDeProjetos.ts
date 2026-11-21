export interface FinalizadorDeProjetos {
  finalizar(projetoId: string): Promise<void>;
}
