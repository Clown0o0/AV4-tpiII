import { ErroValidacao } from '../../domain/errors';
import { NOMES_DECORADORES, PILHA_PADRAO_DE_DECORADORES, type NomeDecorador } from './nomesDosDecoradores';

export class PoliticaDeDecoradores {
  private pilhaPadrao: readonly NomeDecorador[];
  private readonly pilhasPorProdutor = new Map<string, readonly NomeDecorador[]>();

  constructor(
    pilhaPadrao: readonly NomeDecorador[] = PILHA_PADRAO_DE_DECORADORES,
    pilhasPorProdutor: ReadonlyMap<string, readonly NomeDecorador[]> = new Map(),
  ) {
    this.pilhaPadrao = pilhaValidada(pilhaPadrao);
    for (const [produtorId, nomes] of pilhasPorProdutor) this.definirPilha(produtorId, nomes);
  }

  pilhaPara(produtorId: string): readonly NomeDecorador[] {
    return this.pilhasPorProdutor.get(produtorId) ?? this.pilhaPadrao;
  }

  definirPilhaPadrao(nomes: readonly NomeDecorador[]): void {
    this.pilhaPadrao = pilhaValidada(nomes);
  }

  definirPilha(produtorId: string, nomes: readonly NomeDecorador[]): void {
    if (!produtorId.trim()) throw new ErroValidacao('Informe o produtor da pilha de decoradores');
    this.pilhasPorProdutor.set(produtorId, pilhaValidada(nomes));
  }
}

function pilhaValidada(nomes: readonly NomeDecorador[]): readonly NomeDecorador[] {
  const desconhecido = nomes.find((nome) => !NOMES_DECORADORES.includes(nome));
  if (desconhecido !== undefined) {
    throw new ErroValidacao(`Decorador desconhecido: ${String(desconhecido)} (use ${NOMES_DECORADORES.join(', ')})`);
  }
  if (new Set(nomes).size !== nomes.length) throw new ErroValidacao(`Decorador repetido na pilha: ${nomes.join(',')}`);
  return Object.freeze([...nomes]);
}
