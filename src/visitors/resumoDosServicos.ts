import type { PapelTecnico, Projeto } from '../domain/entities/Projeto';
import type { Profissional } from '../domain/entities/Profissional';
import type { MembroRecomendadoLeitura, Recomendacao } from '../domain/entities/Recomendacao';
import { ColetorDeServicosAtomicos } from '../servicos-projeto/ColetorDeServicosAtomicos';
import type { ServicoAtomico } from '../servicos-projeto/ServicoAtomico';
import { servicoParaJson, type ServicoJson } from '../servicos-projeto/ServicoJson';

const MS_POR_DIA = 24 * 60 * 60 * 1000;

export interface LinhaServico {
  servico: string;
  papel: PapelTecnico;
  custo: number;
  prazoDias: number;
  profissionalId: string | null;
  profissional: string | null;
  disponivel: boolean | null;
}

export interface ResumoServicos {
  arvore: ServicoJson;
  custoTotal: number;
  prazoTotalDias: number;
  porServico: LinhaServico[];
  avisos: string[];
}

export interface EquipeParaResumo {
  projeto: Projeto;
  recomendacao: Recomendacao;
  membros: readonly MembroRecomendadoLeitura[];
  profissionais: ReadonlyMap<string, Profissional>;
}

export function resumirServicos(equipe: EquipeParaResumo): ResumoServicos {
  const { projeto } = equipe;
  const custoTotal = projeto.calcularCustoTotal();
  const prazoTotalDias = projeto.calcularPrazoTotalDias();
  return {
    arvore: servicoParaJson(projeto.servicoPrincipal),
    custoTotal,
    prazoTotalDias,
    porServico: ColetorDeServicosAtomicos.coletar(projeto.servicoPrincipal).map((servico) => linhaDoServico(servico, equipe)),
    avisos: avisosDosServicos(projeto, equipe.recomendacao, custoTotal, prazoTotalDias),
  };
}

function linhaDoServico(servico: ServicoAtomico, equipe: EquipeParaResumo): LinhaServico {
  const membro = equipe.membros.find((m) => m.papel === servico.papel);
  const profissional = membro ? equipe.profissionais.get(membro.profissionalId) : undefined;
  return {
    servico: servico.nome,
    papel: servico.papel,
    custo: servico.calcularCusto(),
    prazoDias: servico.obterPrazo(),
    profissionalId: membro?.profissionalId ?? null,
    profissional: profissional?.nome ?? null,
    disponivel: profissional ? profissional.disponivelEntre(equipe.recomendacao.criadaEm, equipe.projeto.dataEntrega) : null,
  };
}

function avisosDosServicos(projeto: Projeto, recomendacao: Recomendacao, custoTotal: number, prazoTotalDias: number): string[] {
  const diasAteAEntrega = Math.floor((projeto.dataEntrega.getTime() - recomendacao.criadaEm.getTime()) / MS_POR_DIA);
  return [
    ...(custoTotal > projeto.orcamentoTotal ? [`Custo dos serviços (${custoTotal}) excede o orçamento total (${projeto.orcamentoTotal})`] : []),
    ...(prazoTotalDias > diasAteAEntrega
      ? [`Prazo dos serviços (${prazoTotalDias} dias) não cabe até a entrega (${Math.max(diasAteAEntrega, 0)} dias)`]
      : []),
  ];
}

export function formatarServicos(resumo: ResumoServicos): string[] {
  return [
    `Serviços: custo total ${resumo.custoTotal.toFixed(2)} | prazo total ${resumo.prazoTotalDias} dia(s)`,
    ...resumo.porServico.map(
      (linha) =>
        `  - ${linha.servico} (${linha.papel}): custo=${linha.custo.toFixed(2)} prazo=${linha.prazoDias}d ` +
        `profissional=${linha.profissional ?? '(em aberto)'} disponível=${formatarDisponibilidade(linha.disponivel)}`,
    ),
    ...resumo.avisos.map((aviso) => `Aviso: ${aviso}`),
  ];
}

function formatarDisponibilidade(disponivel: boolean | null): string {
  if (disponivel === null) return '-';
  return disponivel ? 'sim' : 'não';
}
