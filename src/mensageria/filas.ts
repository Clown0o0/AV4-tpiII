export const FILAS = {
  CONSULTA_PROFISSIONAIS: 'consulta-profissionais',
  CONSULTA_PROJETOS: 'consulta-projetos',
  EVENTOS_PROJETOS: 'eventos-projetos',
  EVENTOS_RECOMENDACOES: 'eventos-recomendacoes',
} as const;

export type NomeFila = (typeof FILAS)[keyof typeof FILAS];

export const OPERACOES_PROFISSIONAIS = {
  LISTAR: 'listar',
  DETALHAR: 'detalhar',
  AVALIAR: 'avaliar',
} as const;

export const OPERACOES_PROJETOS = {
  SALVAR: 'salvar',
  BUSCAR: 'buscar',
  FINALIZAR: 'finalizar',
} as const;
