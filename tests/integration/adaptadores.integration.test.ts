import type { AdaptadorArmazenamento } from '../../src/adaptadores/armazenamento/AdaptadorArmazenamento';
import type { AdaptadorPagamento } from '../../src/adaptadores/pagamento/AdaptadorPagamento';
import type { AdaptadorProfissional } from '../../src/adaptadores/profissional/AdaptadorProfissional';
import {
  PROVEDORES_ARMAZENAMENTO,
  PROVEDORES_PAGAMENTO,
  PROVEDORES_PROFISSIONAIS,
} from '../../src/composicao/configuracao';
import { criarAdaptadorArmazenamento, criarAdaptadorPagamento, criarAdaptadorProfissional } from '../../src/composicao/provedores';
import { ErroEstadoInvalido, ErroNaoEncontrado, ErroValidacao } from '../../src/domain/errors';
import type { SistemaRecomendacao } from '../../src/services/SistemaRecomendacao';
import { dadosProjeto, DATA_REFERENCIA, elencoCompleto } from '../support/fixtures';
import { InMemoryProfissionalRepository } from '../support/InMemoryRepositories';
import { criarSistemaDeTeste } from '../support/sistema';

type FormaDeInjecao = 'construtor' | 'configurarAdaptadores';
const FORMAS: readonly FormaDeInjecao[] = ['construtor', 'configurarAdaptadores'];

interface Injecao {
  armazenamento?: AdaptadorArmazenamento;
  pagamento?: AdaptadorPagamento;
  profissional?: (cadastro: InMemoryProfissionalRepository) => AdaptadorProfissional;
}

function montar(forma: FormaDeInjecao, injecao: Injecao) {
  const cadastro = new InMemoryProfissionalRepository(elencoCompleto());
  const armazenamento = injecao.armazenamento ?? criarAdaptadorArmazenamento('local');
  const pagamento = injecao.pagamento ?? criarAdaptadorPagamento('stripe');
  const profissional = (injecao.profissional ?? ((repo) => criarAdaptadorProfissional('interno', repo)))(cadastro);
  const base = { profissionais: cadastro, relogio: () => DATA_REFERENCIA, opcoesFonte: { ttlMs: 0, timeoutMs: 200 } };
  if (forma === 'construtor') {
    return { cadastro, sistema: criarSistemaDeTeste({ ...base, adaptadores: { armazenamento, pagamento, profissional } }) };
  }
  const sistema = criarSistemaDeTeste(base);
  sistema.configurarAdaptadores(armazenamento, pagamento, profissional);
  return { cadastro, sistema };
}

async function membroConfirmado(sistema: SistemaRecomendacao) {
  const { recomendacao, projeto } = await sistema.recomendar(dadosProjeto());
  const { convite } = await sistema.aceitarMembro(recomendacao.id, 'DIRETOR');
  await sistema.responderConvite(convite.id, true);
  return { recomendacao, projeto };
}

describe.each(PROVEDORES_ARMAZENAMENTO)('Adapter de armazenamento "%s": a lógica de negócio não muda', (provedor) => {
  describe.each(FORMAS)('injetado por %s', (forma) => {
    let sistema: SistemaRecomendacao;

    beforeEach(() => {
      ({ sistema } = montar(forma, { armazenamento: criarAdaptadorArmazenamento(provedor) }));
    });

    it('anexa, lista e recupera os arquivos de mídia do projeto', async () => {
      const { projeto } = await sistema.recomendar(dadosProjeto());
      const roteiro = await sistema.anexarArquivo(projeto.id, { nome: 'roteiro.txt', categoria: 'ROTEIRO', conteudo: Buffer.from('INT. SET') });
      const amostra = await sistema.anexarArquivo(projeto.id, { nome: 'teaser.mp4', categoria: 'AMOSTRA_VIDEO', conteudo: Buffer.from([1, 2]) });
      const listados = await sistema.listarArquivos(projeto.id);
      expect(listados.map((a) => a.arquivoId).sort()).toEqual([roteiro.arquivoId, amostra.arquivoId].sort());
      const lido = await sistema.obterArquivo(projeto.id, roteiro.arquivoId);
      expect(lido).toMatchObject({ nome: 'roteiro.txt', categoria: 'ROTEIRO', projetoId: projeto.id });
      expect(lido.conteudo.toString()).toBe('INT. SET');
    });

    it('arquivos de outro projeto não aparecem e ids inexistentes respondem 404', async () => {
      const { projeto: a } = await sistema.recomendar(dadosProjeto());
      const { projeto: b } = await sistema.recomendar(dadosProjeto({ titulo: 'Outro' }));
      const arquivo = await sistema.anexarArquivo(a.id, { nome: 'cenas.pdf', categoria: 'STORYBOARD', conteudo: Buffer.from('x') });
      expect(await sistema.listarArquivos(b.id)).toEqual([]);
      await expect(sistema.obterArquivo(b.id, arquivo.arquivoId)).rejects.toBeInstanceOf(ErroNaoEncontrado);
      await expect(sistema.listarArquivos('projeto-inexistente')).rejects.toThrow('Projeto projeto-inexistente não encontrado');
    });

    it('valida nome, categoria e conteúdo antes de chamar o provedor', async () => {
      const { projeto } = await sistema.recomendar(dadosProjeto());
      const anexar = (nome: string, conteudo: Buffer) => sistema.anexarArquivo(projeto.id, { nome, categoria: 'ROTEIRO', conteudo });
      await expect(anexar('a/b.txt', Buffer.from('x'))).rejects.toBeInstanceOf(ErroValidacao);
      await expect(anexar('   ', Buffer.from('x'))).rejects.toBeInstanceOf(ErroValidacao);
      await expect(anexar('vazio.txt', Buffer.alloc(0))).rejects.toBeInstanceOf(ErroValidacao);
      await expect(anexar('grande.bin', Buffer.alloc(512 * 1024 + 1))).rejects.toBeInstanceOf(ErroValidacao);
      await expect(
        sistema.anexarArquivo(projeto.id, { nome: 'a.txt', categoria: 'OUTRA' as 'ROTEIRO', conteudo: Buffer.from('x') }),
      ).rejects.toBeInstanceOf(ErroValidacao);
    });
  });
});

describe.each(PROVEDORES_PAGAMENTO)('Adapter de pagamento "%s": a lógica de negócio não muda', (provedor) => {
  describe.each(FORMAS)('injetado por %s', (forma) => {
    let sistema: SistemaRecomendacao;

    beforeEach(() => {
      ({ sistema } = montar(forma, { pagamento: criarAdaptadorPagamento(provedor) }));
    });

    it('paga o membro confirmado pelo preço mínimo, consulta e cancela uma vez', async () => {
      const { recomendacao, projeto } = await membroConfirmado(sistema);
      const diretor = recomendacao.membroAtivo('DIRETOR');
      const pagamento = await sistema.pagarMembro(recomendacao.id, 'DIRETOR');
      expect(pagamento).toMatchObject({
        status: 'APROVADO',
        papel: 'DIRETOR',
        recomendacaoId: recomendacao.id,
        origem: projeto.produtorId,
        destino: diretor?.profissionalId,
        valor: diretor?.custo,
      });
      expect(await sistema.consultarPagamento(pagamento.pagamentoId)).toEqual({ pagamentoId: pagamento.pagamentoId, status: 'APROVADO' });
      expect(await sistema.cancelarPagamento(pagamento.pagamentoId)).toEqual({ pagamentoId: pagamento.pagamentoId, status: 'CANCELADO' });
      await expect(sistema.cancelarPagamento(pagamento.pagamentoId)).rejects.toBeInstanceOf(ErroEstadoInvalido);
    });

    it('profissional que saiu do cadastro não pode ser pago', async () => {
      const { sistema: comCadastro, cadastro } = montar(forma, { pagamento: criarAdaptadorPagamento(provedor) });
      const { recomendacao } = await membroConfirmado(comCadastro);
      cadastro.profissionais = [];
      await expect(comCadastro.pagarMembro(recomendacao.id, 'DIRETOR')).rejects.toBeInstanceOf(ErroNaoEncontrado);
    });

    it('membro não confirmado, papel não requerido e pagamento inexistente são recusados', async () => {
      const { recomendacao } = await membroConfirmado(sistema);
      await expect(sistema.pagarMembro(recomendacao.id, 'EDITOR')).rejects.toBeInstanceOf(ErroEstadoInvalido);
      await expect(sistema.pagarMembro(recomendacao.id, 'SONOPLASTA')).rejects.toBeInstanceOf(ErroValidacao);
      await expect(sistema.consultarPagamento('inexistente')).rejects.toBeInstanceOf(ErroNaoEncontrado);
    });
  });
});

describe.each(PROVEDORES_PROFISSIONAIS)('Adapter de profissionais "%s": a lógica de negócio não muda', (provedor) => {
  describe.each(FORMAS)('injetado por %s', (forma) => {
    let sistema: SistemaRecomendacao;

    beforeEach(() => {
      ({ sistema } = montar(forma, { profissional: (repo) => criarAdaptadorProfissional(provedor, repo) }));
    });

    it('a recomendação usa o provedor como fonte e chega à mesma equipe do cadastro interno', async () => {
      const { recomendacao, fonteProfissionais } = await sistema.recomendar(dadosProjeto());
      expect(fonteProfissionais).toBe('REPOSITORIO');
      expect(recomendacao.membrosAtivos().map((m) => [m.papel, m.profissionalId])).toEqual([
        ['DIRETOR', 'DIRETOR-top'],
        ['DIRETOR_FOTOGRAFIA', 'DIRETOR_FOTOGRAFIA-top'],
        ['EDITOR', 'EDITOR-top'],
      ]);
    });

    it('detalha e avalia profissionais pelo provedor', async () => {
      expect((await sistema.detalharProfissional('EDITOR-top')).nome).toBe('EDITOR Top');
      const avaliacao = await sistema.avaliarProfissional('EDITOR-top', { autorId: 'produtor-1', nota: 5, comentario: null });
      expect(avaliacao).toEqual({ profissionalId: 'EDITOR-top', autorId: 'produtor-1', nota: 5, comentario: null });
      expect((await sistema.detalharProfissional('EDITOR-top')).avaliacoes).toHaveLength(1);
      await expect(sistema.avaliarProfissional('EDITOR-top', { autorId: 'p', nota: 6, comentario: null })).rejects.toBeInstanceOf(
        ErroValidacao,
      );
      await expect(sistema.detalharProfissional('ninguem')).rejects.toBeInstanceOf(ErroNaoEncontrado);
    });
  });
});

describe('troca de adaptadores em tempo de execução', () => {
  it('configurarAdaptadores troca os três de uma vez: o novo armazenamento não enxerga o antigo', async () => {
    const { sistema, cadastro } = montar('construtor', { armazenamento: criarAdaptadorArmazenamento('s3') });
    const { projeto } = await sistema.recomendar(dadosProjeto());
    await sistema.anexarArquivo(projeto.id, { nome: 'r.txt', categoria: 'ROTEIRO', conteudo: Buffer.from('a') });
    sistema.configurarAdaptadores(
      criarAdaptadorArmazenamento('google'),
      criarAdaptadorPagamento('paypal'),
      criarAdaptadorProfissional('linkedin', cadastro),
    );
    expect(await sistema.listarArquivos(projeto.id)).toEqual([]);
    const { recomendacao } = await sistema.recomendar(dadosProjeto());
    expect(recomendacao.membrosAtivos()).toHaveLength(3);
  });

  it('a fonte de profissionais passa a ler do novo provedor', async () => {
    const { sistema } = montar('construtor', {});
    await sistema.recomendar(dadosProjeto());
    const vazio = new InMemoryProfissionalRepository([]);
    sistema.configurarAdaptadores(criarAdaptadorArmazenamento('local'), criarAdaptadorPagamento('stripe'), criarAdaptadorProfissional('indeed', vazio));
    const { recomendacao } = await sistema.recomendar(dadosProjeto());
    expect(recomendacao.membrosAtivos()).toEqual([]);
    expect(recomendacao.parcial).toBe(true);
  });
});
