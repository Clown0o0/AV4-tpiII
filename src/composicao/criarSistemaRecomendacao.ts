import type { AdaptadorProfissional } from '../adaptadores/profissional/AdaptadorProfissional';
import type { ConviteRepository } from '../domain/ports/ConviteRepository';
import type { ProfissionalRepository } from '../domain/ports/ProfissionalRepository';
import type { ProjetoRepository } from '../domain/ports/ProjetoRepository';
import type { RecomendacaoRepository } from '../domain/ports/RecomendacaoRepository';
import type { PublicadorEventos } from '../events/PublicadorEventos';
import type { CatalogoFabricas } from '../factories/FabricaProjeto';
import { RegistroFabricas } from '../factories/RegistroFabricas';
import { OrquestradorPadrao } from '../orchestration/OrquestradorPadrao';
import { RegistroPrototipos, type CatalogoPrototipos } from '../prototypes/RegistroPrototipos';
import type { CriadorDeOrquestrador, Relogio } from '../services/contratos';
import { FonteProfissionaisResiliente, type OpcoesFonteResiliente } from '../services/FonteProfissionaisResiliente';
import { GeradorDeRelatorio } from '../services/GeradorDeRelatorio';
import { GestorDeArquivos } from '../services/GestorDeArquivos';
import { GestorDeAvaliacoes } from '../services/GestorDeAvaliacoes';
import { GestorDePagamentos } from '../services/GestorDePagamentos';
import { GestorDeConvites } from '../services/GestorDeConvites';
import { OrquestradorDeRecomendacao } from '../services/OrquestradorDeRecomendacao';
import { LIMIARES_PADRAO, PoliticaDeReavaliacao, type LimiaresReavaliacao } from '../services/PoliticaDeReavaliacao';
import { PublicadorDeEventosDeRecomendacao } from '../services/PublicadorDeEventosDeRecomendacao';
import { SistemaRecomendacao } from '../services/SistemaRecomendacao';
import type { OpcoesCache } from '../strategies/decoradores/CacheDecorator';
import { PoliticaDeDecoradores } from '../strategies/decoradores/PoliticaDeDecoradores';
import type { RegistroDeAuditoria } from '../strategies/decoradores/RegistroDeAuditoria';
import { RegistroDeAuditoriaEmMemoria } from '../strategies/decoradores/RegistroDeAuditoriaEmMemoria';
import type { CatalogoEstrategias } from '../strategies/RecomendacaoStrategy';
import { RegistroEstrategias } from '../strategies/RegistroEstrategias';
import { CompatibilidadeEquipeVisitor } from '../visitors/CompatibilidadeEquipeVisitor';
import { PROVEDORES_PADRAO, type ProvedoresConfigurados } from './configuracao';
import { decorarFabricas, type OpcoesDosDecoradores } from './decoradores';
import {
  criarAdaptadorArmazenamento,
  criarAdaptadorPagamento,
  criarAdaptadorProfissional,
  type AdaptadoresDoSistema,
} from './provedores';

export type RepositorioDeProjetos = ProjetoRepository & RecomendacaoRepository & ConviteRepository;

export interface OpcoesSistemaRecomendacao {
  profissionais?: ProfissionalRepository;
  projetos: RepositorioDeProjetos;
  eventos: PublicadorEventos;
  estrategias?: CatalogoEstrategias;
  fabricas?: CatalogoFabricas;
  prototipos?: CatalogoPrototipos;
  criarOrquestrador?: CriadorDeOrquestrador;
  relogio?: Relogio;
  limiares?: Partial<LimiaresReavaliacao>;
  opcoesFonte?: Partial<OpcoesFonteResiliente>;
  provedores?: Partial<ProvedoresConfigurados>;
  adaptadores?: Partial<AdaptadoresDoSistema>;
  politicaDeDecoradores?: PoliticaDeDecoradores;
  registroDeAuditoria?: RegistroDeAuditoria;
  opcoesCache?: Partial<OpcoesCache>;
}

type OpcoesOpcionais = 'profissionais' | 'limiares' | 'opcoesFonte' | 'provedores' | 'adaptadores' | 'politicaDeDecoradores' | 'registroDeAuditoria' | 'opcoesCache';

type OpcoesCompletas = Required<Omit<OpcoesSistemaRecomendacao, OpcoesOpcionais>> &
  Pick<OpcoesSistemaRecomendacao, 'opcoesFonte'> & {
    limiares: LimiaresReavaliacao;
    adaptadores: AdaptadoresDoSistema;
    decoradores: OpcoesDosDecoradores;
  };

export function criarSistemaRecomendacao(opcoes: OpcoesSistemaRecomendacao): SistemaRecomendacao {
  return montarSistema(completarComPadroes(opcoes));
}

function completarComPadroes(opcoes: OpcoesSistemaRecomendacao): OpcoesCompletas {
  return {
    ...opcoes,
    estrategias: opcoes.estrategias ?? RegistroEstrategias.padrao(),
    fabricas: opcoes.fabricas ?? RegistroFabricas.padrao(),
    prototipos: opcoes.prototipos ?? RegistroPrototipos.padrao(),
    criarOrquestrador: opcoes.criarOrquestrador ?? ((fabrica) => new OrquestradorPadrao(fabrica)),
    relogio: opcoes.relogio ?? ((): Date => new Date()),
    limiares: { ...LIMIARES_PADRAO, ...opcoes.limiares },
    adaptadores: completarAdaptadores(opcoes),
    decoradores: {
      politica: opcoes.politicaDeDecoradores ?? new PoliticaDeDecoradores(),
      registroDeAuditoria: opcoes.registroDeAuditoria ?? new RegistroDeAuditoriaEmMemoria(),
      ...(opcoes.opcoesCache ? { opcoesCache: opcoes.opcoesCache } : {}),
    },
  };
}

function completarAdaptadores(opcoes: OpcoesSistemaRecomendacao): AdaptadoresDoSistema {
  const provedores = { ...PROVEDORES_PADRAO, ...opcoes.provedores };
  return {
    armazenamento: opcoes.adaptadores?.armazenamento ?? criarAdaptadorArmazenamento(provedores.armazenamento),
    pagamento: opcoes.adaptadores?.pagamento ?? criarAdaptadorPagamento(provedores.pagamento),
    profissional: opcoes.adaptadores?.profissional ?? adaptadorDoCadastro(provedores.profissionais, opcoes.profissionais),
  };
}

function adaptadorDoCadastro(provedor: ProvedoresConfigurados['profissionais'], cadastro: ProfissionalRepository | undefined): AdaptadorProfissional {
  if (!cadastro) throw new TypeError('Informe o cadastro de profissionais ou o adaptador de profissionais');
  return criarAdaptadorProfissional(provedor, cadastro);
}

function montarSistema(opcoes: OpcoesCompletas): SistemaRecomendacao {
  const { projetos, fabricas, estrategias, criarOrquestrador, relogio, adaptadores } = opcoes;
  const profissionais = new FonteProfissionaisResiliente(adaptadores.profissional, opcoes.opcoesFonte);
  return new SistemaRecomendacao({
    projetos,
    recomendacoes: projetos,
    profissionais,
    catalogoDeProfissionais: profissionais,
    fabricas,
    estrategias,
    prototipos: opcoes.prototipos,
    recomendador: new OrquestradorDeRecomendacao({
      fabricas: decorarFabricas(fabricas, opcoes.decoradores),
      estrategias,
      profissionais,
      criarOrquestrador,
      relogio,
    }),
    convites: new GestorDeConvites(projetos, relogio),
    relatorios: new GeradorDeRelatorio(profissionais, () => new CompatibilidadeEquipeVisitor(), relogio),
    eventos: new PublicadorDeEventosDeRecomendacao(opcoes.eventos, relogio),
    reavaliacao: new PoliticaDeReavaliacao(opcoes.limiares),
    arquivos: new GestorDeArquivos(),
    pagamentos: new GestorDePagamentos(profissionais),
    avaliacoes: new GestorDeAvaliacoes(profissionais),
    adaptadorArmazenamento: adaptadores.armazenamento,
    adaptadorPagamento: adaptadores.pagamento,
    adaptadorProfissional: adaptadores.profissional,
    relogio,
  });
}
