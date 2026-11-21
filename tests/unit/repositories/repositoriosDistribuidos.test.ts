import type { PrismaClient as ClienteNotificacoes } from '../../../generated/notificacoes';
import type { PrismaClient as ClienteProjetos } from '../../../generated/projetos';
import { lerConfiguracaoDeMensageria, lerConfiguracaoDeServico, ErroConfiguracao } from '../../../src/composicao/configuracao';
import { criarSistemaRecomendacao } from '../../../src/composicao/criarSistemaRecomendacao';
import { Convite } from '../../../src/domain/entities/Convite';
import { Recomendacao } from '../../../src/domain/entities/Recomendacao';
import { EVENTOS } from '../../../src/events/EventTypes';
import { FinalizacaoDeProjetoObservador } from '../../../src/events/observadores/FinalizacaoDeProjetoObservador';
import { PublicadorEmFilaObservador } from '../../../src/events/observadores/PublicadorEmFilaObservador';
import { RecomendacaoEventEmitter } from '../../../src/events/RecomendacaoEventEmitter';
import { RegistroFabricas } from '../../../src/factories/RegistroFabricas';
import { BarramentoEmMemoria } from '../../../src/mensageria/BarramentoEmMemoria';
import { FILAS } from '../../../src/mensageria/filas';
import { PublicadorDeEventosIntegrados } from '../../../src/mensageria/PublicadorDeEventosIntegrados';
import { OperacoesDeProjetos } from '../../../src/projetos/OperacoesDeProjetos';
import { BancoPrisma } from '../../../src/repositories/BancoPrisma';
import { PrismaNotificacaoRepository } from '../../../src/repositories/PrismaNotificacaoRepository';
import { PrismaProjetoRepository } from '../../../src/repositories/PrismaProjetoRepository';
import { RepositorioDeProjetosComposto } from '../../../src/repositories/RepositorioDeProjetosComposto';
import { criarProjeto, DATA_REFERENCIA } from '../../support/fixtures';
import { InMemoryProjetoRepository } from '../../support/InMemoryRepositories';
import { InMemoryCadastroDeProjetos } from '../../support/servicosEmMemoria';

const UUID = '3f0c9a52-6f6b-4d2a-9d37-0a0d2f6b1c11';

describe('repositórios por serviço', () => {
  it('PrismaProjetoRepository: existe e finalizar só consultam ids UUID', async () => {
    const mock = { projeto: { count: jest.fn().mockResolvedValue(1), updateMany: jest.fn().mockResolvedValue({ count: 0 }) } };
    const repo = new PrismaProjetoRepository(mock as unknown as ClienteProjetos, RegistroFabricas.padrao());
    expect(await repo.existe(UUID)).toBe(true);
    expect(await repo.existe('abc')).toBe(false);
    expect(await repo.finalizar(UUID, DATA_REFERENCIA)).toBe(false);
    expect(await repo.finalizar('abc', DATA_REFERENCIA)).toBe(false);
    expect(mock.projeto.updateMany).toHaveBeenCalledWith({ where: { id: UUID }, data: { finalizadoEm: DATA_REFERENCIA } });
    expect(mock.projeto.count).toHaveBeenCalledTimes(1);
  });

  it('PrismaNotificacaoRepository grava uma vez por evento (upsert idempotente)', async () => {
    const mock = { notificacao: { upsert: jest.fn() } };
    const registro = { id: UUID, evento: 'projeto.criado', origem: 'PROJETOS' as const, projetoId: 'p', titulo: 't', texto: 'x', destinatarios: ['a'], ocorridoEm: DATA_REFERENCIA };
    await new PrismaNotificacaoRepository(mock as unknown as ClienteNotificacoes).salvar(registro);
    expect(mock.notificacao.upsert).toHaveBeenCalledWith({ where: { id: UUID }, create: registro, update: {} });
  });

  it('BancoPrisma conecta, verifica com SELECT 1 e desconecta', async () => {
    const cliente = { $connect: jest.fn().mockResolvedValue(undefined), $disconnect: jest.fn().mockResolvedValue(undefined), $queryRawUnsafe: jest.fn().mockResolvedValue([]) };
    const banco = new BancoPrisma(cliente);
    await banco.conectar();
    expect(await banco.verificar()).toBe(true);
    await banco.desconectar();
    expect(cliente.$queryRawUnsafe).toHaveBeenCalledWith('SELECT 1');
    expect(cliente.$disconnect).toHaveBeenCalled();
  });

  it('RepositorioDeProjetosComposto delega projetos a um lado e recomendações/convites ao outro', async () => {
    const projetos = new InMemoryCadastroDeProjetos();
    const recomendacoes = new InMemoryProjetoRepository();
    const repo = new RepositorioDeProjetosComposto(projetos, recomendacoes);
    const projeto = criarProjeto();
    const recomendacao = new Recomendacao({ projetoId: projeto.id, estrategia: 'COSSENO', membros: [] });
    const convite = new Convite({ recomendacaoId: recomendacao.id, projetoId: projeto.id, profissionalId: 'p', papel: 'EDITOR' });
    await repo.salvar(projeto);
    await repo.salvarRecomendacao(recomendacao);
    await repo.salvarConvite(convite);
    expect(projetos.projetos.has(projeto.id) && !recomendacoes.projetos.has(projeto.id)).toBe(true);
    expect((await repo.buscarPorId(projeto.id))?.id).toBe(projeto.id);
    expect((await repo.buscarRecomendacao(recomendacao.id))?.id).toBe(recomendacao.id);
    expect((await repo.buscarRecomendacaoVigente(projeto.id))?.id).toBe(recomendacao.id);
    expect((await repo.buscarConvite(convite.id))?.id).toBe(convite.id);
    expect(await repo.listarConvites(recomendacao.id)).toHaveLength(1);
  });
});

describe('peças de integração da API e do serviço de projetos', () => {
  it('observadores: publica cada evento na fila e finaliza o projeto só quando a equipe fecha', async () => {
    const barramento = new BarramentoEmMemoria();
    const finalizador = { finalizar: jest.fn().mockResolvedValue(undefined) };
    const emitter = new RecomendacaoEventEmitter().registrar(new PublicadorEmFilaObservador(barramento, FILAS.EVENTOS_RECOMENDACOES, () => 'id-fixo'), new FinalizacaoDeProjetoObservador(finalizador));
    const projeto = criarProjeto();
    const recomendacao = new Recomendacao({ projetoId: projeto.id, estrategia: 'COSSENO', membros: [] });
    const base = { ator: { tipo: 'SISTEMA' as const, id: 'sistema' }, ocorridoEm: DATA_REFERENCIA, projetoId: projeto.id };
    emitter.publicar(EVENTOS.MEMBRO_REJEITADO, { ...base, recomendacaoId: recomendacao.id, papel: 'DIRETOR', profissionalId: 'p' });
    emitter.publicar(EVENTOS.EQUIPE_FINALIZADA, { ...base, projeto, recomendacao });
    await emitter.aguardarPendentes();
    expect(barramento.pendentes(FILAS.EVENTOS_RECOMENDACOES)).toBe(2);
    expect(finalizador.finalizar).toHaveBeenCalledTimes(1);
    expect(finalizador.finalizar).toHaveBeenCalledWith(projeto.id);
  });

  it('OperacoesDeProjetos: finalizar projeto inexistente é 404 e usa relógio/id padrão', async () => {
    const barramento = new BarramentoEmMemoria();
    const operacoes = new OperacoesDeProjetos({ cadastro: new InMemoryCadastroDeProjetos(), fabricas: RegistroFabricas.padrao(), eventos: new PublicadorDeEventosIntegrados(barramento, FILAS.EVENTOS_PROJETOS) }).operacoes();
    await expect(operacoes.finalizar?.({ id: 'nada' })).rejects.toMatchObject({ codigo: 'NAO_ENCONTRADO' });
    expect(await operacoes.buscar?.({ id: 'nada' })).toBeNull();
  });

  it('criarSistemaRecomendacao exige cadastro ou adaptador de profissionais', () => {
    expect(() => criarSistemaRecomendacao({ projetos: new InMemoryProjetoRepository(), eventos: new RecomendacaoEventEmitter() })).toThrow(TypeError);
  });
});

describe('configuração dos serviços', () => {
  it('lê RabbitMQ e timeout com padrões e valida formatos', () => {
    expect(lerConfiguracaoDeMensageria({})).toEqual({ rabbitmqUrl: 'amqp://guest:guest@localhost:5672', mensagensTimeoutMs: 10000 });
    expect(lerConfiguracaoDeServico({ DATABASE_URL: 'postgresql://u:s@profissionais-db:5432/p', RABBITMQ_URL: 'amqp://guest:guest@cinebridge-mq:5672', PROFISSIONAIS: 'linkedin' }, 3001)).toEqual({
      databaseUrl: 'postgresql://u:s@profissionais-db:5432/p',
      porta: 3001,
      host: '0.0.0.0',
      nivelLog: 'info',
      provedorProfissionais: 'linkedin',
      rabbitmqUrl: 'amqp://guest:guest@cinebridge-mq:5672',
      mensagensTimeoutMs: 10000,
    });
    expect(() => lerConfiguracaoDeMensageria({ RABBITMQ_URL: 'http://mq' })).toThrow(ErroConfiguracao);
    expect(() => lerConfiguracaoDeServico({ MENSAGENS_TIMEOUT_MS: '0' }, 3002)).toThrow(/DATABASE_URL[\s\S]*MENSAGENS_TIMEOUT_MS/);
  });
});
