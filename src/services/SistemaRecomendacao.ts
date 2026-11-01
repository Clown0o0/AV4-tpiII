import type { AdaptadorArmazenamento } from '../adaptadores/armazenamento/AdaptadorArmazenamento';
import type { AdaptadorPagamento } from '../adaptadores/pagamento/AdaptadorPagamento';
import type { AdaptadorProfissional, AvaliacaoProfissional } from '../adaptadores/profissional/AdaptadorProfissional';
import type { Convite } from '../domain/entities/Convite';
import {
  ESTRATEGIA_PADRAO,
  type AjustesProjeto,
  type AlteracoesProjeto,
  type DadosProjeto,
  type PapelTecnico,
  type Projeto,
  type TipoCaptacao,
  type TipoEstrategia,
} from '../domain/entities/Projeto';
import type { Profissional } from '../domain/entities/Profissional';
import type { Equipe, MembroRecomendadoLeitura, Recomendacao } from '../domain/entities/Recomendacao';
import { ErroEstadoInvalido, ErroNaoEncontrado, ErroValidacao } from '../domain/errors';
import type { RecomendacaoStrategy } from '../strategies/RecomendacaoStrategy';
import type { DependenciasSistemaRecomendacao, ResultadoAlteracaoProjeto, ResultadoRecomendacao, ResultadoRespostaConvite } from './contratosDoSistema';
import type { ArquivoComConteudo, ArquivoDoProjeto, NovoArquivo } from './GestorDeArquivos';
import type { AvaliacaoRegistrada } from './GestorDeAvaliacoes';
import type { PagamentoDoMembro, SituacaoDoPagamento } from './GestorDePagamentos';
import type { RelatorioCompleto } from './GeradorDeRelatorio';
import type { EquipeRecomendada } from './OrquestradorDeRecomendacao';
import type { MotivoDaRecomendacao } from './PublicadorDeEventosDeRecomendacao';

export type { DependenciasSistemaRecomendacao, ResultadoAlteracaoProjeto, ResultadoRecomendacao, ResultadoRespostaConvite } from './contratosDoSistema';

interface RecomendacaoEProjeto {
  recomendacao: Recomendacao;
  projeto: Projeto;
}

export class SistemaRecomendacao {
  private adaptadorArmazenamento: AdaptadorArmazenamento;
  private adaptadorPagamento: AdaptadorPagamento;
  private adaptadorProfissional: AdaptadorProfissional;
  private estrategiaAtual: RecomendacaoStrategy;

  constructor(private readonly deps: DependenciasSistemaRecomendacao) {
    this.adaptadorArmazenamento = deps.adaptadorArmazenamento;
    this.adaptadorPagamento = deps.adaptadorPagamento;
    this.adaptadorProfissional = deps.adaptadorProfissional;
    this.estrategiaAtual = deps.estrategias.obter(ESTRATEGIA_PADRAO);
  }

  configurarAdaptadores(armazenamento: AdaptadorArmazenamento, pagamento: AdaptadorPagamento, profissional: AdaptadorProfissional): void {
    this.adaptadorArmazenamento = armazenamento;
    this.adaptadorPagamento = pagamento;
    this.adaptadorProfissional = profissional;
    this.deps.catalogoDeProfissionais.trocarOrigem(profissional);
  }

  definirEstrategia(estrategia: RecomendacaoStrategy): void {
    this.deps.estrategias.obter(estrategia.tipo);
    this.estrategiaAtual = estrategia;
  }

  async executarRecomendacao(projeto: Projeto): Promise<Equipe> {
    return (await this.recomendarProjeto(projeto)).recomendacao;
  }

  recomendar(dados: DadosProjeto): Promise<ResultadoRecomendacao> {
    const fabrica = this.deps.fabricas.obter(dados.tipoCaptacao);
    return this.recomendarProjeto(fabrica.criarProjeto({ ...dados, estrategia: dados.estrategia ?? this.estrategiaAtual.tipo }));
  }

  recomendarAPartirDoModelo(modelo: string, ajustes: AjustesProjeto & { tipoCaptacao?: TipoCaptacao }): Promise<ResultadoRecomendacao> {
    const { tipoCaptacao, ...resto } = ajustes;
    const projeto = this.deps.prototipos.criarAPartirDe(modelo, resto);
    if (tipoCaptacao !== undefined && tipoCaptacao !== projeto.tipoCaptacao) {
      throw new ErroValidacao(`O modelo ${modelo} é do tipo ${projeto.tipoCaptacao}, não ${tipoCaptacao}`);
    }
    return this.recomendarProjeto(projeto);
  }

  tiposCaptacao(): TipoCaptacao[] {
    return this.deps.fabricas.tipos();
  }

  tiposEstrategia(): TipoEstrategia[] {
    return this.deps.estrategias.tipos();
  }

  modelos(): string[] {
    return this.deps.prototipos.chaves();
  }

  async obterRecomendacaoComConvites(id: string): Promise<{ recomendacao: Recomendacao; convites: Convite[] }> {
    const recomendacao = await this.obterRecomendacao(id);
    return { recomendacao, convites: await this.deps.convites.listar(id) };
  }

  async aceitarMembro(recomendacaoId: string, papel: PapelTecnico): Promise<{ recomendacao: Recomendacao; convite: Convite }> {
    const { recomendacao, projeto } = await this.obterRecomendacaoEProjeto(recomendacaoId);
    const membro = recomendacao.convidar(papel);
    await this.deps.recomendacoes.salvarRecomendacao(recomendacao);
    const convite = await this.deps.convites.criar(recomendacaoId, projeto.id, membro);
    this.deps.eventos.interesseDoProdutor(projeto, convite, await this.buscarProfissional(membro.profissionalId));
    return { recomendacao, convite };
  }

  async rejeitarMembro(recomendacaoId: string, papel: PapelTecnico): Promise<Recomendacao> {
    const { recomendacao, projeto } = await this.obterRecomendacaoEProjeto(recomendacaoId);
    const membro = recomendacao.rejeitar(papel);
    await this.deps.convites.cancelarPendentes(recomendacaoId, membro);
    recomendacao.registrarResultadoRodada(true, [...recomendacao.avisos, `Papel ${papel} em aberto após rejeição`]);
    await this.deps.recomendacoes.salvarRecomendacao(recomendacao);
    this.deps.eventos.membroRejeitado(projeto, recomendacaoId, papel, membro.profissionalId);
    return recomendacao;
  }

  async substituirMembro(
    recomendacaoId: string,
    papel: PapelTecnico,
    estrategia?: TipoEstrategia,
  ): Promise<{ recomendacao: Recomendacao; novoMembro: MembroRecomendadoLeitura | null }> {
    const { recomendacao, projeto } = await this.obterRecomendacaoEProjeto(recomendacaoId);
    projeto.papelRequerido(papel);
    const estrategiaDaRodada = this.deps.estrategias.obter(estrategia ?? recomendacao.estrategia);
    const anterior = recomendacao.substituir(papel);
    if (anterior) await this.deps.convites.cancelarPendentes(recomendacaoId, anterior);
    const substituto = await this.deps.recomendador.recomendarSubstituto(projeto, recomendacao, papel, estrategiaDaRodada);
    await this.deps.recomendacoes.salvarRecomendacao(recomendacao);
    const anteriorId = anterior?.profissionalId ?? null;
    this.deps.eventos.membroSubstituido(projeto, recomendacao, { papel, anteriorId, ...substituto });
    return { recomendacao, novoMembro: substituto.novoMembro };
  }

  async responderConvite(conviteId: string, aceito: boolean): Promise<ResultadoRespostaConvite> {
    const convite = await this.deps.convites.obter(conviteId);
    const { recomendacao, projeto } = await this.obterRecomendacaoEProjeto(convite.recomendacaoId);
    await this.deps.convites.responder(convite, recomendacao, aceito);
    await this.deps.recomendacoes.salvarRecomendacao(recomendacao);
    this.deps.eventos.conviteRespondido(projeto, convite, aceito, await this.buscarProfissional(convite.profissionalId));
    const equipeFinalizada = aceito && recomendacao.equipeConsensual(projeto.papeis.map((p) => p.papel));
    if (equipeFinalizada) await this.finalizarEquipe(projeto, recomendacao);
    return { convite, recomendacao, equipeFinalizada };
  }

  async alterarProjeto(
    projetoId: string,
    alteracoes: AlteracoesProjeto & { forcarReavaliacao?: boolean },
  ): Promise<ResultadoAlteracaoProjeto> {
    const projeto = await this.obterProjeto(projetoId);
    const vigente = await this.obterRecomendacaoVigenteAlteravel(projetoId);
    if (alteracoes.estrategia) this.deps.estrategias.obter(alteracoes.estrategia);
    const alteracao = projeto.alterar(alteracoes);
    const reavaliada = this.deps.reavaliacao.deveReavaliar(alteracao, alteracoes.forcarReavaliacao === true);
    const nova = reavaliada ? await this.deps.recomendador.recomendarEquipe(projeto) : null;
    await this.deps.projetos.salvar(projeto);
    const recomendacao = nova ? await this.trocarRecomendacaoVigente(projeto, vigente, nova) : vigente;
    this.deps.eventos.projetoAlterado(projeto, alteracao, reavaliada);
    return { projeto, alteracao, reavaliada, recomendacao };
  }

  async gerarRelatorio(recomendacaoId: string): Promise<RelatorioCompleto> {
    const { recomendacao, projeto } = await this.obterRecomendacaoEProjeto(recomendacaoId);
    return this.deps.relatorios.gerar(projeto, recomendacao, this.deps.fabricas.obter(projeto.tipoCaptacao));
  }

  async anexarArquivo(projetoId: string, arquivo: NovoArquivo): Promise<ArquivoDoProjeto> {
    return this.deps.arquivos.anexar(this.adaptadorArmazenamento, await this.obterProjeto(projetoId), arquivo);
  }

  async listarArquivos(projetoId: string): Promise<ArquivoDoProjeto[]> {
    return this.deps.arquivos.listar(this.adaptadorArmazenamento, await this.obterProjeto(projetoId));
  }

  async obterArquivo(projetoId: string, arquivoId: string): Promise<ArquivoComConteudo> {
    return this.deps.arquivos.obter(this.adaptadorArmazenamento, await this.obterProjeto(projetoId), arquivoId);
  }

  async pagarMembro(recomendacaoId: string, papel: PapelTecnico): Promise<PagamentoDoMembro> {
    const adaptador = this.adaptadorPagamento;
    const { recomendacao, projeto } = await this.obterRecomendacaoEProjeto(recomendacaoId);
    return this.deps.pagamentos.pagarMembro(adaptador, projeto, recomendacao, papel);
  }

  consultarPagamento(pagamentoId: string): Promise<SituacaoDoPagamento> {
    return this.deps.pagamentos.consultar(this.adaptadorPagamento, pagamentoId);
  }

  cancelarPagamento(pagamentoId: string): Promise<SituacaoDoPagamento> {
    return this.deps.pagamentos.cancelar(this.adaptadorPagamento, pagamentoId);
  }

  detalharProfissional(profissionalId: string): Promise<Profissional> {
    return this.adaptadorProfissional.detalharProfissional(profissionalId);
  }

  avaliarProfissional(profissionalId: string, avaliacao: AvaliacaoProfissional): Promise<AvaliacaoRegistrada> {
    return this.deps.avaliacoes.avaliar(this.adaptadorProfissional, profissionalId, avaliacao);
  }

  iniciarCatalogo(): Promise<void> {
    return this.deps.catalogoDeProfissionais.iniciar();
  }

  encerrarCatalogo(): void {
    this.deps.catalogoDeProfissionais.parar();
  }

  private async recomendarProjeto(projeto: Projeto): Promise<ResultadoRecomendacao> {
    const equipe = await this.deps.recomendador.recomendarEquipe(projeto);
    await this.deps.projetos.salvar(projeto);
    await this.salvarEPublicarRecomendacao(projeto, equipe, 'INICIAL');
    return { projeto, recomendacao: equipe.recomendacao, fonteProfissionais: equipe.fonte };
  }

  private async trocarRecomendacaoVigente(projeto: Projeto, vigente: Recomendacao | null, nova: EquipeRecomendada): Promise<Recomendacao> {
    if (vigente) {
      await this.deps.convites.cancelarPendentes(vigente.id);
      vigente.tornarObsoleta();
      await this.deps.recomendacoes.salvarRecomendacao(vigente);
    }
    await this.salvarEPublicarRecomendacao(projeto, nova, 'REAVALIACAO');
    return nova.recomendacao;
  }

  private async salvarEPublicarRecomendacao(projeto: Projeto, equipe: EquipeRecomendada, motivo: MotivoDaRecomendacao): Promise<void> {
    await this.deps.recomendacoes.salvarRecomendacao(equipe.recomendacao);
    this.deps.eventos.recomendacaoGerada(projeto, equipe.recomendacao, motivo, equipe.fonte, equipe.sugeridos);
  }

  private async finalizarEquipe(projeto: Projeto, recomendacao: Recomendacao): Promise<void> {
    recomendacao.finalizar(this.deps.relogio());
    await this.deps.recomendacoes.salvarRecomendacao(recomendacao);
    this.deps.eventos.equipeFinalizada(projeto, recomendacao);
  }

  private async buscarProfissional(id: string): Promise<Profissional | null> {
    const { profissionais } = await this.deps.profissionais.buscarPorIds([id]);
    return profissionais[0] ?? null;
  }

  private async obterRecomendacaoVigenteAlteravel(projetoId: string): Promise<Recomendacao | null> {
    const vigente = await this.deps.recomendacoes.buscarRecomendacaoVigente(projetoId);
    if (vigente?.status === 'FINALIZADA') {
      throw new ErroEstadoInvalido('A equipe deste projeto já foi finalizada e não pode ser reavaliada');
    }
    return vigente;
  }

  private async obterProjeto(id: string): Promise<Projeto> {
    const projeto = await this.deps.projetos.buscarPorId(id);
    if (!projeto) throw new ErroNaoEncontrado(`Projeto ${id} não encontrado`);
    return projeto;
  }

  private async obterRecomendacao(id: string): Promise<Recomendacao> {
    const recomendacao = await this.deps.recomendacoes.buscarRecomendacao(id);
    if (!recomendacao) throw new ErroNaoEncontrado(`Recomendação ${id} não encontrada`);
    return recomendacao;
  }

  private async obterRecomendacaoEProjeto(recomendacaoId: string): Promise<RecomendacaoEProjeto> {
    const recomendacao = await this.obterRecomendacao(recomendacaoId);
    return { recomendacao, projeto: await this.obterProjeto(recomendacao.projetoId) };
  }
}
