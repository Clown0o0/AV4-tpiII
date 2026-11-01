import { Avaliacao } from '../../domain/entities/Avaliacao';
import { Competencia } from '../../domain/entities/Competencia';
import { Profissional } from '../../domain/entities/Profissional';
import type { AdaptadorProfissional, AvaliacaoProfissional, CriteriosBusca } from './AdaptadorProfissional';
import { ESCALA_PROFICIENCIA_LINKEDIN, LinkedInSimulado, type PerfilLinkedIn } from './LinkedInSimulado';
import { papeisReconhecidos } from './papeisReconhecidos';
import { profissionalInexistente } from './profissionalInexistente';

export class AdaptadorLinkedIn implements AdaptadorProfissional {
  constructor(private readonly linkedIn: LinkedInSimulado) {}

  async listarProfissionais(criterios: CriteriosBusca): Promise<Profissional[]> {
    const urns = criterios.ids?.map(LinkedInSimulado.urnDe);
    const { elements } = await this.linkedIn.pesquisarPessoas(urns ? { urns } : {});
    return elements.map(profissionalDoPerfil);
  }

  async detalharProfissional(id: string): Promise<Profissional> {
    return profissionalDoPerfil(await this.obterPerfil(id));
  }

  async registrarAvaliacao(id: string, avaliacao: AvaliacaoProfissional): Promise<void> {
    const perfil = await this.obterPerfil(id);
    await this.linkedIn.recomendarPessoa(perfil.urn, { stars: avaliacao.nota });
  }

  private async obterPerfil(id: string): Promise<PerfilLinkedIn> {
    const perfil = await this.linkedIn.obterPessoa(LinkedInSimulado.urnDe(id));
    if (!perfil) throw profissionalInexistente(id);
    return perfil;
  }
}

function profissionalDoPerfil(perfil: PerfilLinkedIn): Profissional {
  const id = LinkedInSimulado.idDe(perfil.urn);
  return new Profissional({
    id,
    nome: perfil.localizedName,
    email: perfil.email,
    especialidades: papeisReconhecidos(perfil.occupations),
    precoMin: perfil.rate.minimum,
    precoMax: perfil.rate.maximum,
    localizacao: perfil.location.city,
    historicoProjetos: perfil.positions.map((posicao) => posicao.title),
    disponibilidade: perfil.availability.map((janela) => ({ inicio: new Date(janela.start), fim: new Date(janela.end) })),
    competencias: perfil.skills.map((skill) => new Competencia(skill.name, skill.proficiency / ESCALA_PROFICIENCIA_LINKEDIN)),
    avaliacoes: perfil.recommendations.map((r) => new Avaliacao({ profissionalId: id, autorId: r.author, nota: r.stars })),
  });
}
