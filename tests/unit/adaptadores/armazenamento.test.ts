import { File } from 'node:buffer';
import type { AdaptadorArmazenamento, MetadadosArquivo } from '../../../src/adaptadores/armazenamento/AdaptadorArmazenamento';
import { AdaptadorGoogleCloud } from '../../../src/adaptadores/armazenamento/AdaptadorGoogleCloud';
import { AdaptadorLocal } from '../../../src/adaptadores/armazenamento/AdaptadorLocal';
import { AdaptadorS3 } from '../../../src/adaptadores/armazenamento/AdaptadorS3';
import { ArmazenamentoExterno } from '../../../src/adaptadores/armazenamento/ArmazenamentoExterno';
import {
  chaveDoArquivo,
  lerChaveDoArquivo,
  prefixoDoArquivo,
  prefixoDoProjeto,
} from '../../../src/adaptadores/armazenamento/chaveDeArquivo';
import { GoogleCloudStorageSimulado } from '../../../src/adaptadores/armazenamento/GoogleCloudStorageSimulado';
import { S3Simulado } from '../../../src/adaptadores/armazenamento/S3Simulado';
import { ErroNaoEncontrado } from '../../../src/domain/errors';

const roteiro: MetadadosArquivo = { projetoId: 'p1', arquivoId: 'a1', categoria: 'ROTEIRO', nome: 'roteiro.txt' };
const storyboard: MetadadosArquivo = { projetoId: 'p1', arquivoId: 'a2', categoria: 'STORYBOARD', nome: 'cenas.pdf' };
const deOutroProjeto: MetadadosArquivo = { projetoId: 'p2', arquivoId: 'a3', categoria: 'AMOSTRA_VIDEO', nome: 'teaser.mp4' };

describe('chave de arquivo', () => {
  it('monta e lê a chave a partir dos metadados', () => {
    const chave = chaveDoArquivo(roteiro);
    expect(chave).toBe('projetos/p1/a1/ROTEIRO/roteiro.txt');
    expect(chave.startsWith(prefixoDoProjeto('p1'))).toBe(true);
    expect(chave.startsWith(prefixoDoArquivo('p1', 'a1'))).toBe(true);
    expect(lerChaveDoArquivo(chave)).toEqual(roteiro);
  });

  it.each(['outra/p1/a1/ROTEIRO/x', 'projetos/p1/a1/OUTRA/x', 'projetos/p1/a1/ROTEIRO', 'projetos/p1/a1/ROTEIRO/x/y', 'projetos//a1/ROTEIRO/x'])(
    'chave fora do formato (%s) não é lida',
    (chave) => {
      expect(lerChaveDoArquivo(chave)).toBeNull();
    },
  );
});

describe.each<[string, () => AdaptadorArmazenamento]>([
  ['AdaptadorS3', () => new AdaptadorS3(new S3Simulado())],
  ['AdaptadorGoogleCloud', () => new AdaptadorGoogleCloud(new GoogleCloudStorageSimulado())],
  ['AdaptadorLocal', () => new AdaptadorLocal(new ArmazenamentoExterno())],
])('%s cumpre o contrato de AdaptadorArmazenamento', (_nome, criar) => {
  let adaptador: AdaptadorArmazenamento;

  beforeEach(() => {
    adaptador = criar();
  });

  it('salva, recupera exatamente os mesmos bytes e devolve a chave derivada dos metadados', async () => {
    const conteudo = Buffer.from([0, 1, 2, 250, 255]);
    const id = await adaptador.salvarArquivo(conteudo, roteiro);
    expect(id).toBe(chaveDoArquivo(roteiro));
    const recuperado = await adaptador.recuperarArquivo(id);
    expect(recuperado.equals(conteudo)).toBe(true);
    recuperado[0] = 9;
    expect((await adaptador.recuperarArquivo(id))[0]).toBe(0);
  });

  it('lista por prefixo, sem misturar projetos', async () => {
    await adaptador.salvarArquivo(Buffer.from('a'), roteiro);
    await adaptador.salvarArquivo(Buffer.from('b'), storyboard);
    await adaptador.salvarArquivo(Buffer.from('c'), deOutroProjeto);
    expect(await adaptador.listarArquivos(prefixoDoProjeto('p1'))).toEqual([chaveDoArquivo(roteiro), chaveDoArquivo(storyboard)]);
    expect(await adaptador.listarArquivos(prefixoDoArquivo('p1', 'a2'))).toEqual([chaveDoArquivo(storyboard)]);
    expect(await adaptador.listarArquivos(prefixoDoProjeto('vazio'))).toEqual([]);
  });

  it('id inexistente gera ErroNaoEncontrado', async () => {
    await expect(adaptador.recuperarArquivo('projetos/x/y/ROTEIRO/z')).rejects.toBeInstanceOf(ErroNaoEncontrado);
  });
});

describe('sistemas externos simulados de armazenamento', () => {
  it('ArmazenamentoExterno trabalha com File (upload, download, listar)', async () => {
    const armazenamento = new ArmazenamentoExterno();
    expect(await armazenamento.upload(new File(['oi'], 'pasta/a.txt'))).toBe('pasta/a.txt');
    expect(await (await armazenamento.download('pasta/a.txt'))?.text()).toBe('oi');
    expect(await armazenamento.download('nada')).toBeNull();
    expect(await armazenamento.listar('pasta/')).toEqual(['pasta/a.txt']);
  });

  it('S3Simulado separa buckets e guarda metadados e ETag', async () => {
    const s3 = new S3Simulado();
    const { ETag } = await s3.putObject({ Bucket: 'b1', Key: 'k', Body: Uint8Array.from([1]), Metadata: { nome: 'x' } });
    expect(ETag).toBe('"1"');
    expect((await s3.getObject({ Bucket: 'b1', Key: 'k' }))?.Metadata).toEqual({ nome: 'x' });
    expect(await s3.getObject({ Bucket: 'b2', Key: 'k' })).toBeNull();
    expect(await s3.listObjectsV2({ Bucket: 'b1', Prefix: '' })).toEqual({ Contents: [{ Key: 'k', Size: 1 }], KeyCount: 1 });
  });

  it('GoogleCloudStorageSimulado guarda os dados em base64 e informa o tamanho', async () => {
    const google = new GoogleCloudStorageSimulado();
    expect(await google.gravar({ bucket: 'b', nome: 'n', dadosBase64: Buffer.from('abc').toString('base64'), metadados: {} })).toEqual({
      nome: 'n',
      tamanho: 3,
    });
    expect((await google.listar('b', '')).itens).toEqual([{ nome: 'n', tamanho: 3 }]);
    expect(await google.listar('outro', '')).toEqual({ itens: [] });
    expect(await google.ler('b', 'x')).toBeNull();
  });
});
