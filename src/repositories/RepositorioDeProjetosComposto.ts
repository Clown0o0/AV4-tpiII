import type { Convite } from '../domain/entities/Convite';
import type { Projeto } from '../domain/entities/Projeto';
import type { Recomendacao } from '../domain/entities/Recomendacao';
import type { ConviteRepository } from '../domain/ports/ConviteRepository';
import type { ProjetoRepository } from '../domain/ports/ProjetoRepository';
import type { RecomendacaoRepository } from '../domain/ports/RecomendacaoRepository';

export class RepositorioDeProjetosComposto implements ProjetoRepository, RecomendacaoRepository, ConviteRepository {
  constructor(
    private readonly projetos: ProjetoRepository,
    private readonly recomendacoes: RecomendacaoRepository & ConviteRepository,
  ) {}

  salvar(projeto: Projeto): Promise<void> {
    return this.projetos.salvar(projeto);
  }

  buscarPorId(id: string): Promise<Projeto | null> {
    return this.projetos.buscarPorId(id);
  }

  salvarRecomendacao(recomendacao: Recomendacao): Promise<void> {
    return this.recomendacoes.salvarRecomendacao(recomendacao);
  }

  buscarRecomendacao(id: string): Promise<Recomendacao | null> {
    return this.recomendacoes.buscarRecomendacao(id);
  }

  buscarRecomendacaoVigente(projetoId: string): Promise<Recomendacao | null> {
    return this.recomendacoes.buscarRecomendacaoVigente(projetoId);
  }

  salvarConvite(convite: Convite): Promise<void> {
    return this.recomendacoes.salvarConvite(convite);
  }

  buscarConvite(id: string): Promise<Convite | null> {
    return this.recomendacoes.buscarConvite(id);
  }

  listarConvites(recomendacaoId: string): Promise<Convite[]> {
    return this.recomendacoes.listarConvites(recomendacaoId);
  }
}
