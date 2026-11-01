import { Avaliacao } from '../../domain/entities/Avaliacao';
import { Competencia } from '../../domain/entities/Competencia';
import { Profissional } from '../../domain/entities/Profissional';
import type { AdaptadorProfissional, AvaliacaoProfissional, CriteriosBusca } from './AdaptadorProfissional';
import { ESCALA_HABILIDADE_INDEED, PONTOS_POR_ESTRELA_INDEED, type CandidatoIndeed, type IndeedSimulado } from './IndeedSimulado';
import { papeisReconhecidos } from './papeisReconhecidos';
import { profissionalInexistente } from './profissionalInexistente';

export class AdaptadorIndeed implements AdaptadorProfissional {
  constructor(private readonly indeed: IndeedSimulado) {}

  async listarProfissionais(criterios: CriteriosBusca): Promise<Profissional[]> {
    const { results } = await this.indeed.searchCandidates(criterios.ids ? { candidateIds: criterios.ids } : {});
    return results.map(profissionalDoCandidato);
  }

  async detalharProfissional(id: string): Promise<Profissional> {
    return profissionalDoCandidato(await this.obterCandidato(id));
  }

  async registrarAvaliacao(id: string, avaliacao: AvaliacaoProfissional): Promise<void> {
    const candidato = await this.obterCandidato(id);
    await this.indeed.rateCandidate(candidato.candidateId, { score: avaliacao.nota * PONTOS_POR_ESTRELA_INDEED });
  }

  private async obterCandidato(id: string): Promise<CandidatoIndeed> {
    const candidato = await this.indeed.getCandidate(id);
    if (!candidato) throw profissionalInexistente(id);
    return candidato;
  }
}

function profissionalDoCandidato(candidato: CandidatoIndeed): Profissional {
  const id = candidato.candidateId;
  return new Profissional({
    id,
    nome: candidato.name,
    email: candidato.email,
    especialidades: papeisReconhecidos(candidato.jobTitles),
    precoMin: candidato.salary.min,
    precoMax: candidato.salary.max,
    localizacao: candidato.city,
    historicoProjetos: [...candidato.workHistory],
    disponibilidade: candidato.availability.map((janela) => ({ inicio: new Date(janela.from), fim: new Date(janela.to) })),
    competencias: Object.entries(candidato.skills).map(([nome, nivel]) => new Competencia(nome, nivel / ESCALA_HABILIDADE_INDEED)),
    avaliacoes: candidato.ratings.map(
      (r) => new Avaliacao({ profissionalId: id, autorId: r.reviewer, nota: Math.round(r.score / PONTOS_POR_ESTRELA_INDEED) }),
    ),
  });
}
