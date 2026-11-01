import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ErroValidacao } from '../../../src/domain/errors';
import { FiltragemColaborativaStrategy } from '../../../src/strategies/FiltragemColaborativaStrategy';
import type { RecomendacaoStrategy } from '../../../src/strategies/RecomendacaoStrategy';
import { RegistroEstrategias } from '../../../src/strategies/RegistroEstrategias';
import { CossenoStrategy } from '../../../src/strategies/CossenoStrategy';
import { criarProjeto, dadosProjeto, DATA_REFERENCIA } from '../../support/fixtures';
import { InMemoryProjetoRepository } from '../../support/InMemoryRepositories';
import { criarSistemaDeTeste } from '../../support/sistema';

describe('SistemaRecomendacao: métodos do diagrama da ATVIII', () => {
  it('definirEstrategia troca a estratégia padrão, sem sobrepor a escolhida pelo produtor', async () => {
    const sistema = criarSistemaDeTeste({ relogio: () => DATA_REFERENCIA });
    const { estrategia: _omitida, ...semEstrategia } = dadosProjeto();
    expect((await sistema.recomendar(semEstrategia)).recomendacao.estrategia).toBe('COSSENO');
    sistema.definirEstrategia(new FiltragemColaborativaStrategy());
    expect((await sistema.recomendar(semEstrategia)).projeto.estrategia).toBe('FILTRAGEM_COLABORATIVA');
    expect((await sistema.recomendar(dadosProjeto({ estrategia: 'ORCAMENTO_REDUZIDO' }))).recomendacao.estrategia).toBe('ORCAMENTO_REDUZIDO');
  });

  it('definirEstrategia recusa estratégia que o catálogo não conhece', () => {
    const sistema = criarSistemaDeTeste({ estrategias: new RegistroEstrategias([new CossenoStrategy()]) });
    const desconhecida: RecomendacaoStrategy = { tipo: 'ORCAMENTO_REDUZIDO', descricao: 'x', recomendar: () => [] };
    expect(() => sistema.definirEstrategia(desconhecida)).toThrow(ErroValidacao);
  });

  it('executarRecomendacao recebe o projeto pronto, salva e devolve a equipe', async () => {
    const projetos = new InMemoryProjetoRepository();
    const sistema = criarSistemaDeTeste({ projetos, relogio: () => DATA_REFERENCIA });
    const projeto = criarProjeto();
    const equipe = await sistema.executarRecomendacao(projeto);
    expect(equipe.projetoId).toBe(projeto.id);
    expect(equipe.membrosAtivos()).toHaveLength(3);
    expect(projetos.projetos.get(projeto.id)).toBe(projeto);
    expect(projetos.recomendacoes.get(equipe.id)).toBe(equipe);
  });

  it('SistemaRecomendacao não importa nenhum adaptador concreto nem sistema simulado', () => {
    const codigo = readFileSync(join(__dirname, '..', '..', '..', 'src', 'services', 'SistemaRecomendacao.ts'), 'utf-8');
    const importacoes = codigo.split('\n').filter((linha) => linha.startsWith('import'));
    expect(importacoes.filter((linha) => linha.includes('adaptadores')).every((linha) => linha.startsWith('import type'))).toBe(true);
    expect(codigo).not.toMatch(/Adaptador(S3|GoogleCloud|Local|Stripe|PagSeguro|PayPal|LinkedIn|Indeed|Interno)|Simulado|Externo|GatewayPagamento/);
  });
});
