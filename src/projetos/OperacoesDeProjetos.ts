import { randomUUID } from 'node:crypto';
import type { Projeto } from '../domain/entities/Projeto';
import { ErroNaoEncontrado } from '../domain/errors';
import type { CadastroDeProjetos } from '../domain/ports/CadastroDeProjetos';
import type { CatalogoFabricas } from '../factories/FabricaProjeto';
import { produtorDe } from '../mensageria/codecs/eventoDeRecomendacaoIntegrado';
import { EVENTOS_DE_PROJETO } from '../mensageria/codecs/eventoIntegradoJson';
import { projetoDeJson, projetoParaJson, type ProjetoJson } from '../mensageria/codecs/projetoJson';
import { OPERACOES_PROJETOS } from '../mensageria/filas';
import { objeto, texto } from '../mensageria/leitorJson';
import type { PublicadorDeEventosIntegrados } from '../mensageria/PublicadorDeEventosIntegrados';
import type { OperacoesRpc } from '../mensageria/ServidorRpc';
import type { Relogio } from '../services/contratos';

type NomeEventoDeProjeto = (typeof EVENTOS_DE_PROJETO)[keyof typeof EVENTOS_DE_PROJETO];

export interface DependenciasDeProjetos {
  cadastro: CadastroDeProjetos;
  fabricas: CatalogoFabricas;
  eventos: PublicadorDeEventosIntegrados;
  relogio?: Relogio;
  gerarId?: () => string;
}

export class OperacoesDeProjetos {
  private readonly relogio: Relogio;
  private readonly gerarId: () => string;

  constructor(private readonly deps: DependenciasDeProjetos) {
    this.relogio = deps.relogio ?? ((): Date => new Date());
    this.gerarId = deps.gerarId ?? randomUUID;
  }

  operacoes(): OperacoesRpc {
    return {
      [OPERACOES_PROJETOS.SALVAR]: (dados) => this.salvar(dados),
      [OPERACOES_PROJETOS.BUSCAR]: (dados) => this.buscar(dados),
      [OPERACOES_PROJETOS.FINALIZAR]: (dados) => this.finalizar(dados),
    };
  }

  private async salvar(dados: unknown): Promise<null> {
    const projeto = projetoDeJson(objeto(dados, 'dados').projeto, this.deps.fabricas);
    const existia = await this.deps.cadastro.existe(projeto.id);
    await this.deps.cadastro.salvar(projeto);
    await this.publicar(existia ? EVENTOS_DE_PROJETO.ATUALIZADO : EVENTOS_DE_PROJETO.CRIADO, projeto);
    return null;
  }

  private async buscar(dados: unknown): Promise<ProjetoJson | null> {
    const projeto = await this.deps.cadastro.buscarPorId(texto(objeto(dados, 'dados'), 'id'));
    return projeto ? projetoParaJson(projeto) : null;
  }

  private async finalizar(dados: unknown): Promise<null> {
    const id = texto(objeto(dados, 'dados'), 'id');
    const projeto = await this.deps.cadastro.buscarPorId(id);
    if (!projeto) throw new ErroNaoEncontrado(`Projeto ${id} não encontrado`);
    await this.deps.cadastro.finalizar(id, this.relogio());
    await this.publicar(EVENTOS_DE_PROJETO.FINALIZADO, projeto);
    return null;
  }

  private publicar(nome: NomeEventoDeProjeto, projeto: Projeto): Promise<void> {
    return this.deps.eventos.publicar({
      id: this.gerarId(),
      nome,
      origem: 'PROJETOS',
      projetoId: projeto.id,
      titulo: projeto.titulo,
      produtor: produtorDe(projeto),
      destinatarios: [],
      ocorridoEm: this.relogio(),
    });
  }
}
