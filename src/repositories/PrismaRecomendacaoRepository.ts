import type { Prisma, PrismaClient } from '../../generated/api';
import { Convite } from '../domain/entities/Convite';
import {
  MembroRecomendado,
  Recomendacao,
  type Alternativa,
  type MembroRecomendadoLeitura,
  type StatusRecomendacao,
} from '../domain/entities/Recomendacao';
import type { ConviteRepository } from '../domain/ports/ConviteRepository';
import type { RecomendacaoRepository } from '../domain/ports/RecomendacaoRepository';
import { ehUuid } from './identificadores';

type RecomendacaoPersistida = Prisma.RecomendacaoGetPayload<{ include: { membros: true } }>;
type MembroPersistido = RecomendacaoPersistida['membros'][number];
type ConvitePersistido = Prisma.ConviteGetPayload<object>;

interface CamposDaRecomendacao {
  status: StatusRecomendacao;
  parcial: boolean;
  avisos: string[];
  rodadas: number;
  finalizadaEm: Date | null;
}

export class PrismaRecomendacaoRepository implements RecomendacaoRepository, ConviteRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async salvarRecomendacao(recomendacao: Recomendacao): Promise<void> {
    const campos = camposDaRecomendacao(recomendacao);
    await this.prisma.$transaction(async (tx) => {
      await tx.recomendacao.upsert({
        where: { id: recomendacao.id },
        create: { ...campos, id: recomendacao.id, projetoId: recomendacao.projetoId, estrategia: recomendacao.estrategia, criadaEm: recomendacao.criadaEm },
        update: campos,
      });
      await tx.membroRecomendado.deleteMany({ where: { recomendacaoId: recomendacao.id } });
      await tx.membroRecomendado.createMany({ data: recomendacao.membros.map((membro) => membroParaGravar(recomendacao.id, membro)) });
    });
  }

  async buscarRecomendacao(id: string): Promise<Recomendacao | null> {
    if (!ehUuid(id)) return null;
    const registro = await this.prisma.recomendacao.findUnique({ where: { id }, include: { membros: true } });
    return registro ? recomendacaoParaDominio(registro) : null;
  }

  async buscarRecomendacaoVigente(projetoId: string): Promise<Recomendacao | null> {
    const registro = await this.prisma.recomendacao.findFirst({
      where: { projetoId, status: { not: 'OBSOLETA' } },
      orderBy: { criadaEm: 'desc' },
      include: { membros: true },
    });
    return registro ? recomendacaoParaDominio(registro) : null;
  }

  async salvarConvite(convite: Convite): Promise<void> {
    const campos = { status: convite.status, respondidoEm: convite.respondidoEm };
    await this.prisma.convite.upsert({
      where: { id: convite.id },
      create: {
        id: convite.id,
        recomendacaoId: convite.recomendacaoId,
        projetoId: convite.projetoId,
        profissionalId: convite.profissionalId,
        papel: convite.papel,
        criadoEm: convite.criadoEm,
        ...campos,
      },
      update: campos,
    });
  }

  async buscarConvite(id: string): Promise<Convite | null> {
    if (!ehUuid(id)) return null;
    const registro = await this.prisma.convite.findUnique({ where: { id } });
    return registro ? conviteParaDominio(registro) : null;
  }

  async listarConvites(recomendacaoId: string): Promise<Convite[]> {
    const registros = await this.prisma.convite.findMany({ where: { recomendacaoId }, orderBy: { criadoEm: 'asc' } });
    return registros.map(conviteParaDominio);
  }
}

function camposDaRecomendacao(recomendacao: Recomendacao): CamposDaRecomendacao {
  return {
    status: recomendacao.status,
    parcial: recomendacao.parcial,
    avisos: [...recomendacao.avisos],
    rodadas: recomendacao.rodadas,
    finalizadaEm: recomendacao.finalizadaEm,
  };
}

function membroParaGravar(recomendacaoId: string, membro: MembroRecomendadoLeitura): Prisma.MembroRecomendadoCreateManyInput {
  return {
    id: membro.id,
    recomendacaoId,
    papel: membro.papel,
    profissionalId: membro.profissionalId,
    score: membro.score,
    custo: membro.custo,
    status: membro.status,
    rodada: membro.rodada,
    alternativas: membro.alternativas.map((a) => ({ ...a })),
  };
}

export function recomendacaoParaDominio(registro: RecomendacaoPersistida): Recomendacao {
  const { membros, ...campos } = registro;
  return new Recomendacao({ ...campos, membros: membros.map(membroParaDominio) });
}

function membroParaDominio(registro: MembroPersistido): MembroRecomendado {
  const { recomendacaoId: _recomendacaoId, custo, alternativas, ...campos } = registro;
  return new MembroRecomendado({ ...campos, custo: Number(custo), alternativas: ehListaDeAlternativas(alternativas) ? alternativas : [] });
}

export function conviteParaDominio(registro: ConvitePersistido): Convite {
  return new Convite(registro);
}

function ehObjetoJson(valor: Prisma.JsonValue): valor is Prisma.JsonObject {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor);
}

function ehListaDeAlternativas(valor: Prisma.JsonValue): valor is Array<Prisma.JsonObject & Alternativa> {
  return Array.isArray(valor) && valor.every(ehAlternativa);
}

function ehAlternativa(valor: Prisma.JsonValue): boolean {
  return (
    ehObjetoJson(valor) &&
    typeof valor.profissionalId === 'string' &&
    typeof valor.score === 'number' &&
    typeof valor.custo === 'number'
  );
}
