import type { AdaptadorArmazenamento } from '../adaptadores/armazenamento/AdaptadorArmazenamento';
import type { AdaptadorPagamento } from '../adaptadores/pagamento/AdaptadorPagamento';
import type { AdaptadorProfissional } from '../adaptadores/profissional/AdaptadorProfissional';
import type { Convite } from '../domain/entities/Convite';
import type { Projeto, ResultadoAlteracao } from '../domain/entities/Projeto';
import type { Recomendacao } from '../domain/entities/Recomendacao';
import type { CicloDeVidaDoCatalogo, FonteDeProfissionais, OrigemDosProfissionais } from '../domain/ports/FonteDeProfissionais';
import type { ProjetoRepository } from '../domain/ports/ProjetoRepository';
import type { RecomendacaoRepository } from '../domain/ports/RecomendacaoRepository';
import type { CatalogoFabricas } from '../factories/FabricaProjeto';
import type { CatalogoPrototipos } from '../prototypes/RegistroPrototipos';
import type { CatalogoEstrategias } from '../strategies/RecomendacaoStrategy';
import type { Relogio } from './contratos';
import type { ServicoDeArquivos } from './GestorDeArquivos';
import type { ServicoDeAvaliacoes } from './GestorDeAvaliacoes';
import type { ServicoDePagamentos } from './GestorDePagamentos';
import type { GeracaoDeRelatorio } from './GeradorDeRelatorio';
import type { ServicoDeConvites } from './GestorDeConvites';
import type { RecomendadorDeEquipes } from './OrquestradorDeRecomendacao';
import type { CriterioDeReavaliacao } from './PoliticaDeReavaliacao';
import type { EventosDeRecomendacao } from './PublicadorDeEventosDeRecomendacao';

export interface DependenciasSistemaRecomendacao {
  projetos: ProjetoRepository;
  recomendacoes: RecomendacaoRepository;
  profissionais: FonteDeProfissionais;
  catalogoDeProfissionais: CicloDeVidaDoCatalogo;
  fabricas: CatalogoFabricas;
  estrategias: CatalogoEstrategias;
  prototipos: CatalogoPrototipos;
  recomendador: RecomendadorDeEquipes;
  convites: ServicoDeConvites;
  relatorios: GeracaoDeRelatorio;
  eventos: EventosDeRecomendacao;
  reavaliacao: CriterioDeReavaliacao;
  arquivos: ServicoDeArquivos;
  pagamentos: ServicoDePagamentos;
  avaliacoes: ServicoDeAvaliacoes;
  adaptadorArmazenamento: AdaptadorArmazenamento;
  adaptadorPagamento: AdaptadorPagamento;
  adaptadorProfissional: AdaptadorProfissional;
  relogio: Relogio;
}

export interface ResultadoRecomendacao {
  projeto: Projeto;
  recomendacao: Recomendacao;
  fonteProfissionais: OrigemDosProfissionais;
}

export interface ResultadoAlteracaoProjeto {
  projeto: Projeto;
  alteracao: ResultadoAlteracao;
  reavaliada: boolean;
  recomendacao: Recomendacao | null;
}

export interface ResultadoRespostaConvite {
  convite: Convite;
  recomendacao: Recomendacao;
  equipeFinalizada: boolean;
}
