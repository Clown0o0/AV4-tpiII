import type { PapelTecnico } from '../domain/entities/papeisTecnicos';
import type { ServicoProjeto } from './ServicoProjeto';
import { TransformadorDeServicos } from './TransformadorDeServicos';

export const TIPOS_SERVICO = ['ATOMICO', 'PACOTE'] as const;
export type TipoServico = (typeof TIPOS_SERVICO)[number];

export type ServicoAtomicoJson = {
  tipo: 'ATOMICO';
  nome: string;
  papel: PapelTecnico;
  custo: number;
  prazoDias: number;
  peso: number;
  competenciasDesejadas?: Readonly<Record<string, number>>;
};

export type PacoteServicoJson = {
  tipo: 'PACOTE';
  nome: string;
  custo: number;
  prazoDias: number;
  servicos: ServicoJson[];
};

export type ServicoJson = ServicoAtomicoJson | PacoteServicoJson;

export function servicoParaJson(servico: ServicoProjeto): ServicoJson {
  return TransformadorDeServicos.aplicar<ServicoJson>(servico, {
    atomico: (atomico) => ({ tipo: 'ATOMICO', ...atomico.dados(), peso: atomico.peso }),
    pacote: (pacote, servicos) => ({
      tipo: 'PACOTE',
      nome: pacote.nome,
      custo: pacote.calcularCusto(),
      prazoDias: pacote.obterPrazo(),
      servicos: [...servicos],
    }),
  });
}
