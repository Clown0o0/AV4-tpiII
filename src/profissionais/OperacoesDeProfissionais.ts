import type { AdaptadorProfissional } from '../adaptadores/profissional/AdaptadorProfissional';
import { profissionalParaJson, type ProfissionalJson } from '../mensageria/codecs/profissionalJson';
import { OPERACOES_PROFISSIONAIS } from '../mensageria/filas';
import { numero, objeto, texto, textoOuNulo, textos } from '../mensageria/leitorJson';
import type { OperacoesRpc } from '../mensageria/ServidorRpc';

export class OperacoesDeProfissionais {
  constructor(private readonly cadastro: AdaptadorProfissional) {}

  operacoes(): OperacoesRpc {
    return {
      [OPERACOES_PROFISSIONAIS.LISTAR]: (dados) => this.listar(dados),
      [OPERACOES_PROFISSIONAIS.DETALHAR]: (dados) => this.detalhar(dados),
      [OPERACOES_PROFISSIONAIS.AVALIAR]: (dados) => this.avaliar(dados),
    };
  }

  private async listar(dados: unknown): Promise<ProfissionalJson[]> {
    const pedido = objeto(dados, 'dados');
    const criterios = pedido.ids === undefined ? {} : { ids: textos(pedido, 'ids') };
    return (await this.cadastro.listarProfissionais(criterios)).map(profissionalParaJson);
  }

  private async detalhar(dados: unknown): Promise<ProfissionalJson> {
    return profissionalParaJson(await this.cadastro.detalharProfissional(texto(objeto(dados, 'dados'), 'id')));
  }

  private async avaliar(dados: unknown): Promise<null> {
    const pedido = objeto(dados, 'dados');
    const avaliacao = objeto(pedido.avaliacao, 'avaliacao');
    await this.cadastro.registrarAvaliacao(texto(pedido, 'id'), {
      autorId: texto(avaliacao, 'autorId'),
      nota: numero(avaliacao, 'nota'),
      comentario: textoOuNulo(avaliacao, 'comentario'),
    });
    return null;
  }
}
