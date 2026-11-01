import { criarSistemaRecomendacao } from '../../../src/composicao/criarSistemaRecomendacao';
import { RecomendacaoEventEmitter } from '../../../src/events/RecomendacaoEventEmitter';
import type { FabricaProjeto } from '../../../src/factories/FabricaProjeto';
import { OrquestradorPadrao } from '../../../src/orchestration/OrquestradorPadrao';
import { RegistroPrototipos } from '../../../src/prototypes/RegistroPrototipos';
import { CossenoStrategy } from '../../../src/strategies/CossenoStrategy';
import { RegistroEstrategias } from '../../../src/strategies/RegistroEstrategias';
import { dadosProjeto, DATA_REFERENCIA, elencoCompleto } from '../../support/fixtures';
import { InMemoryProfissionalRepository, InMemoryProjetoRepository } from '../../support/InMemoryRepositories';

function infraestrutura() {
  return {
    profissionais: new InMemoryProfissionalRepository(elencoCompleto()),
    projetos: new InMemoryProjetoRepository(),
    eventos: new RecomendacaoEventEmitter(),
  };
}

describe('criarSistemaRecomendacao (raiz de composição)', () => {
  it('sem opções, usa os registros padrão', () => {
    const sistema = criarSistemaRecomendacao(infraestrutura());
    expect(sistema.tiposCaptacao()).toEqual(['DOCUMENTARIO', 'FICCAO', 'ANIMACAO', 'PUBLICITARIO']);
    expect(sistema.tiposEstrategia()).toEqual(['COSSENO', 'FILTRAGEM_COLABORATIVA', 'ORCAMENTO_REDUZIDO']);
    expect(sistema.modelos()).toEqual(['ficcao', 'documentario', 'animacao', 'publicitario']);
  });

  it('usa as implementações injetadas no lugar dos padrões', async () => {
    const criarOrquestrador = jest.fn((fabrica: FabricaProjeto) => new OrquestradorPadrao(fabrica));
    const sistema = criarSistemaRecomendacao({
      ...infraestrutura(),
      estrategias: new RegistroEstrategias([new CossenoStrategy()]),
      prototipos: new RegistroPrototipos(),
      criarOrquestrador,
      relogio: () => DATA_REFERENCIA,
    });
    expect(sistema.tiposEstrategia()).toEqual(['COSSENO']);
    expect(sistema.modelos()).toEqual([]);
    const { recomendacao } = await sistema.recomendar(dadosProjeto());
    expect(criarOrquestrador).toHaveBeenCalled();
    expect(recomendacao.criadaEm).toBe(DATA_REFERENCIA);
  });

  it('escolhe os adaptadores pelo nome do provedor', async () => {
    const sistema = criarSistemaRecomendacao({
      ...infraestrutura(),
      relogio: () => DATA_REFERENCIA,
      provedores: { armazenamento: 'google', pagamento: 'paypal', profissionais: 'indeed' },
    });
    const { recomendacao, projeto } = await sistema.recomendar(dadosProjeto());
    const { convite } = await sistema.aceitarMembro(recomendacao.id, 'DIRETOR');
    await sistema.responderConvite(convite.id, true);
    expect((await sistema.pagarMembro(recomendacao.id, 'DIRETOR')).pagamentoId.startsWith('PAYID-')).toBe(true);
    await sistema.anexarArquivo(projeto.id, { nome: 'a.txt', categoria: 'ROTEIRO', conteudo: Buffer.from('a') });
    expect(await sistema.listarArquivos(projeto.id)).toHaveLength(1);
    expect((await sistema.detalharProfissional('EDITOR-top')).id).toBe('EDITOR-top');
  });
});
