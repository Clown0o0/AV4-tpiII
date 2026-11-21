import { TIPOS_CAPTACAO, TIPOS_ESTRATEGIA, type DetalhesProjeto, type Projeto } from '../../domain/entities/Projeto';
import type { CatalogoFabricas } from '../../factories/FabricaProjeto';
import { lerServicoProjeto } from '../../servicos-projeto/lerServicoProjeto';
import { servicoParaJson, type ServicoJson } from '../../servicos-projeto/ServicoJson';
import { data, numero, objeto, opcao, texto, textoOuNulo } from '../leitorJson';

export interface ProjetoJson {
  id: string;
  titulo: string;
  produtorId: string;
  produtorEmail: string | null;
  genero: string;
  duracaoEstimadaMin: number;
  orcamentoTotal: number;
  dataEntrega: string;
  tipoCaptacao: string;
  localizacao: string;
  estrategia: string;
  detalhes: DetalhesProjeto | null;
  servicoPrincipal: ServicoJson;
  criadoEm: string;
}

export function projetoParaJson(projeto: Projeto): ProjetoJson {
  return {
    id: projeto.id,
    titulo: projeto.titulo,
    produtorId: projeto.produtorId,
    produtorEmail: projeto.produtorEmail,
    genero: projeto.genero,
    duracaoEstimadaMin: projeto.duracaoEstimadaMin,
    orcamentoTotal: projeto.orcamentoTotal,
    dataEntrega: projeto.dataEntrega.toISOString(),
    tipoCaptacao: projeto.tipoCaptacao,
    localizacao: projeto.localizacao,
    estrategia: projeto.estrategia,
    detalhes: projeto.detalhes,
    servicoPrincipal: servicoParaJson(projeto.servicoPrincipal),
    criadoEm: projeto.criadoEm.toISOString(),
  };
}

export function projetoDeJson(valor: unknown, fabricas: CatalogoFabricas): Projeto {
  const json = objeto(valor, 'projeto');
  const tipoCaptacao = opcao(json, 'tipoCaptacao', TIPOS_CAPTACAO);
  return fabricas.obter(tipoCaptacao).criarProjeto({
    id: texto(json, 'id'),
    titulo: texto(json, 'titulo'),
    produtorId: texto(json, 'produtorId'),
    produtorEmail: textoOuNulo(json, 'produtorEmail'),
    genero: texto(json, 'genero'),
    duracaoEstimadaMin: numero(json, 'duracaoEstimadaMin'),
    orcamentoTotal: numero(json, 'orcamentoTotal'),
    dataEntrega: data(json, 'dataEntrega'),
    tipoCaptacao,
    localizacao: texto(json, 'localizacao'),
    estrategia: opcao(json, 'estrategia', TIPOS_ESTRATEGIA),
    detalhes: json.detalhes === null || json.detalhes === undefined ? null : objeto(json.detalhes, 'detalhes'),
    servicoPrincipal: lerServicoProjeto(json.servicoPrincipal),
    criadoEm: data(json, 'criadoEm'),
  });
}
