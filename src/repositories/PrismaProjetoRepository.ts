import type { Prisma, PrismaClient } from '../../generated/projetos';
import type { VetorCompetencias } from '../domain/entities/Competencia';
import type { DadosProjeto, DetalhesProjeto, PapelRequerido, Projeto } from '../domain/entities/Projeto';
import type { CadastroDeProjetos } from '../domain/ports/CadastroDeProjetos';
import type { CatalogoFabricas } from '../factories/FabricaProjeto';
import { lerServicoProjeto } from '../servicos-projeto/lerServicoProjeto';
import { servicoParaJson } from '../servicos-projeto/ServicoJson';
import { ehUuid } from './identificadores';

type ProjetoPersistido = Prisma.ProjetoGetPayload<{ include: { papeis: true } }>;
type PapelPersistido = ProjetoPersistido['papeis'][number];

type CamposObrigatoriosDoProjeto = Omit<DadosProjeto, 'id' | 'criadoEm' | 'papeis' | 'detalhes' | 'servicoPrincipal'>;

type CamposDoProjeto = Required<CamposObrigatoriosDoProjeto> & {
  detalhes: Prisma.InputJsonObject | undefined;
  servicoPrincipal: Prisma.InputJsonObject;
};

export class PrismaProjetoRepository implements CadastroDeProjetos {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly fabricas: CatalogoFabricas,
  ) {}

  async salvar(projeto: Projeto): Promise<void> {
    const campos = camposDoProjeto(projeto);
    await this.prisma.$transaction(async (tx) => {
      await tx.projeto.upsert({
        where: { id: projeto.id },
        create: { id: projeto.id, criadoEm: projeto.criadoEm, ...campos },
        update: campos,
      });
      await tx.projetoPapel.deleteMany({ where: { projetoId: projeto.id } });
      await tx.projetoPapel.createMany({ data: projeto.papeis.map((papel) => papelParaGravar(projeto.id, papel)) });
    });
  }

  async buscarPorId(id: string): Promise<Projeto | null> {
    if (!ehUuid(id)) return null;
    const registro = await this.prisma.projeto.findUnique({ where: { id }, include: { papeis: true } });
    return registro ? projetoParaDominio(registro, this.fabricas) : null;
  }

  async existe(id: string): Promise<boolean> {
    if (!ehUuid(id)) return false;
    return (await this.prisma.projeto.count({ where: { id } })) > 0;
  }

  async finalizar(id: string, em: Date): Promise<boolean> {
    if (!ehUuid(id)) return false;
    const { count } = await this.prisma.projeto.updateMany({ where: { id }, data: { finalizadoEm: em } });
    return count > 0;
  }

}

function camposDoProjeto(projeto: Projeto): CamposDoProjeto {
  return {
    titulo: projeto.titulo,
    produtorId: projeto.produtorId,
    produtorEmail: projeto.produtorEmail,
    genero: projeto.genero,
    duracaoEstimadaMin: projeto.duracaoEstimadaMin,
    orcamentoTotal: projeto.orcamentoTotal,
    dataEntrega: projeto.dataEntrega,
    tipoCaptacao: projeto.tipoCaptacao,
    localizacao: projeto.localizacao,
    estrategia: projeto.estrategia,
    detalhes: projeto.detalhes ? detalhesComoJson(projeto.detalhes) : undefined,
    servicoPrincipal: servicoParaJson(projeto.servicoPrincipal),
  };
}

function detalhesComoJson(detalhes: DetalhesProjeto): Prisma.InputJsonObject {
  if (!ehObjetoJsonDeEntrada(detalhes)) throw new TypeError('Os atributos específicos do projeto não são JSON');
  return detalhes;
}

function ehObjetoJsonDeEntrada(valor: unknown): valor is Prisma.InputJsonObject {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor) && Object.values(valor).every(ehValorJsonDeEntrada);
}

function ehValorJsonDeEntrada(valor: unknown): boolean {
  if (valor === null || ['string', 'number', 'boolean'].includes(typeof valor)) return true;
  if (Array.isArray(valor)) return valor.every(ehValorJsonDeEntrada);
  return ehObjetoJsonDeEntrada(valor);
}

function papelParaGravar(projetoId: string, papel: PapelRequerido): Prisma.ProjetoPapelCreateManyInput {
  return { projetoId, papel: papel.papel, peso: papel.peso, competenciasDesejadas: papel.competenciasDesejadas };
}

export function projetoParaDominio(registro: ProjetoPersistido, fabricas: CatalogoFabricas): Projeto {
  const { papeis, detalhes, servicoPrincipal, orcamentoTotal, finalizadoEm: _finalizadoEm, ...campos } = registro;
  return fabricas.obter(registro.tipoCaptacao).criarProjeto({
    ...campos,
    orcamentoTotal: Number(orcamentoTotal),
    detalhes: ehObjetoJson(detalhes) ? detalhes : null,
    ...(servicoPrincipal === null ? { papeis: papeis.map(papelParaDominio) } : { servicoPrincipal: lerServicoProjeto(servicoPrincipal) }),
  });
}

function papelParaDominio(registro: PapelPersistido): PapelRequerido {
  const { papel, peso, competenciasDesejadas } = registro;
  return ehVetorDeNiveis(competenciasDesejadas) ? { papel, peso, competenciasDesejadas } : { papel, peso };
}

function ehObjetoJson(valor: Prisma.JsonValue): valor is Prisma.JsonObject {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor);
}

function ehVetorDeNiveis(valor: Prisma.JsonValue): valor is Prisma.JsonObject & VetorCompetencias {
  return ehObjetoJson(valor) && Object.values(valor).every((nivel) => typeof nivel === 'number');
}
