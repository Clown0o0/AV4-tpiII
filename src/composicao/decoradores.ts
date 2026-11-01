import { AuditoriaDecorator } from '../strategies/decoradores/AuditoriaDecorator';
import { CacheDecorator, type OpcoesCache } from '../strategies/decoradores/CacheDecorator';
import { CatalogoDeFabricasDecoradas } from '../strategies/decoradores/CatalogoDeFabricasDecoradas';
import { CompressaoDecorator } from '../strategies/decoradores/CompressaoDecorator';
import { MontadorDePilhaDeDecoradores, type CriadoresDeDecoradores } from '../strategies/decoradores/MontadorDePilhaDeDecoradores';
import type { PoliticaDeDecoradores } from '../strategies/decoradores/PoliticaDeDecoradores';
import { RecomendadoresDecorados } from '../strategies/decoradores/RecomendadoresDecorados';
import type { RegistroDeAuditoria } from '../strategies/decoradores/RegistroDeAuditoria';
import type { CatalogoFabricas } from '../factories/FabricaProjeto';

export interface OpcoesDosDecoradores {
  politica: PoliticaDeDecoradores;
  registroDeAuditoria: RegistroDeAuditoria;
  opcoesCache?: Partial<OpcoesCache>;
}

export function criarMontadorDePilha(opcoes: OpcoesDosDecoradores): MontadorDePilhaDeDecoradores {
  const criadores: CriadoresDeDecoradores = {
    cache: (interno) => new CacheDecorator(interno, opcoes.opcoesCache),
    auditoria: (interno) => new AuditoriaDecorator(interno, opcoes.registroDeAuditoria),
    compressao: (interno) => new CompressaoDecorator(interno),
  };
  return new MontadorDePilhaDeDecoradores(criadores);
}

export function decorarFabricas(fabricas: CatalogoFabricas, opcoes: OpcoesDosDecoradores): CatalogoFabricas {
  return new CatalogoDeFabricasDecoradas(fabricas, new RecomendadoresDecorados(opcoes.politica, criarMontadorDePilha(opcoes)));
}
