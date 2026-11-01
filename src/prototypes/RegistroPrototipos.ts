// submarino
import { ErroValidacao } from '../domain/errors';
import { ProjetoAnimacao } from '../domain/entities/ProjetoAnimacao';
import { ProjetoDocumentario } from '../domain/entities/ProjetoDocumentario';
import { ProjetoPublicitario } from '../domain/entities/ProjetoPublicitario';
import { Projeto, type AjustesProjeto, type DadosProjeto } from '../domain/entities/Projeto';

const BASE_MODELO: Omit<DadosProjeto, 'genero' | 'duracaoEstimadaMin' | 'tipoCaptacao' | 'papeis'> = {
  titulo: 'Modelo',
  produtorId: 'modelo',
  orcamentoTotal: 1,
  dataEntrega: new Date(0),
  localizacao: 'A definir',
};

export interface CatalogoPrototipos {
  criarAPartirDe(chave: string, ajustes?: AjustesProjeto): Projeto;
  chaves(): string[];
}

export class RegistroPrototipos implements CatalogoPrototipos {
  private readonly prototipos = new Map<string, Projeto>();

  static padrao(): RegistroPrototipos {
    const registro = new RegistroPrototipos();
    registro.registrar('ficcao', modeloFiccao());
    registro.registrar('documentario', modeloDocumentario());
    registro.registrar('animacao', modeloAnimacao());
    registro.registrar('publicitario', modeloPublicitario());
    return registro;
  }

  registrar(chave: string, prototipo: Projeto): void {
    this.prototipos.set(chave, prototipo.clonar());
  }

  criarAPartirDe(chave: string, ajustes: AjustesProjeto = {}): Projeto {
    const prototipo = this.prototipos.get(chave);
    if (!prototipo) throw new ErroValidacao(`Modelo de projeto inexistente: ${chave}`);
    return prototipo.clonar(ajustes);
  }

  chaves(): string[] {
    return [...this.prototipos.keys()];
  }
}

function modeloFiccao(): Projeto {
  return new Projeto({
    ...BASE_MODELO,
    genero: 'Drama',
    duracaoEstimadaMin: 100,
    tipoCaptacao: 'FICCAO',
    papeis: [
      { papel: 'DIRETOR', peso: 3 },
      { papel: 'ROTEIRISTA', peso: 2 },
      { papel: 'DIRETOR_FOTOGRAFIA', peso: 2 },
      { papel: 'EDITOR', peso: 1 },
    ],
  });
}

function modeloDocumentario(): ProjetoDocumentario {
  return new ProjetoDocumentario({
    ...BASE_MODELO,
    genero: 'Documentário',
    duracaoEstimadaMin: 80,
    tipoCaptacao: 'DOCUMENTARIO',
    estrategia: 'ORCAMENTO_REDUZIDO',
    papeis: [
      { papel: 'DIRETOR', peso: 3 },
      { papel: 'ROTEIRISTA', peso: 2 },
      { papel: 'EDITOR', peso: 2 },
    ],
  });
}

function modeloAnimacao(): ProjetoAnimacao {
  return new ProjetoAnimacao({
    ...BASE_MODELO,
    genero: 'Animação',
    duracaoEstimadaMin: 85,
    tipoCaptacao: 'ANIMACAO',
    detalhes: { tecnica: '3D', softwares: ['Blender'], quadrosPorSegundo: 24 },
    papeis: [
      { papel: 'DIRETOR', peso: 3 },
      { papel: 'EFEITOS_VISUAIS', peso: 3 },
      { papel: 'SONOPLASTA', peso: 1 },
    ],
  });
}

function modeloPublicitario(): ProjetoPublicitario {
  return new ProjetoPublicitario({
    ...BASE_MODELO,
    genero: 'Publicidade',
    duracaoEstimadaMin: 1,
    tipoCaptacao: 'PUBLICITARIO',
    detalhes: { canais: ['TV', 'redes sociais'], duracaoMaxSegundos: 60 },
    papeis: [
      { papel: 'DIRETOR', peso: 2 },
      { papel: 'DIRETOR_FOTOGRAFIA', peso: 3 },
      { papel: 'EDITOR', peso: 2 },
    ],
  });
}
