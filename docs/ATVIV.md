# ATIVIDADE PRÁTICA ATVIV – cinebridge em containers

A plataforma foi dividida em 4 microsserviços (API, profissionais, projetos e notificações), cada um com o próprio PostgreSQL. Eles se comunicam só pelo RabbitMQ e são orquestrados pelo Docker Compose. O código de domínio das ATVs anteriores continua sendo um só, compartilhado; o que muda por serviço é a entrada, a raiz de composição e o schema do banco.

## Exigência → arquivo → teste

| Exigência | Onde está | Teste |
|---|---|---|
| 4 serviços com os nomes e portas do diagrama | `docker-compose.yml` (`cinebridge-api` 3000, `cinebridge-profissionais` 3001, `cinebridge-projetos` 3002, `cinebridge-notificacoes` 3003) | job `docker` do CI; prova manual (abaixo) |
| Um banco por serviço, `postgres:15-alpine`, volume nomeado | `docker-compose.yml` (`profissionais-db` 5432, `projetos-db` 5433, `recomendacoes-db` 5434, `notificacoes-db` 5435); schemas e migrations em `servicos/<nome>/prisma` | `tests/unit/repositories/*` |
| RabbitMQ com painel | `cinebridge-mq` (`rabbitmq:3-management-alpine`, 5672 e 15672, guest/guest) | prova manual |
| Rede única bridge, resolução por nome | `networks.cinebridge-net`; `DATABASE_URL`/`RABBITMQ_URL` com os nomes dos containers em `servicos/<nome>/.env.example` | job `docker` |
| Dockerfile por serviço | `servicos/<nome>/Dockerfile` (`node:24-alpine`, `WORKDIR /usr/src/app`, `npm ci`, build, `EXPOSE`, `CMD`), `.dockerignore` | job `docker` |
| Configuração por `.env` | `env_file` no compose, `servicos/<nome>/.env.example`, `npm run preparar` (`scripts/preparar.js`) | prova manual |
| Healthchecks e ordem de subida | `curl -f .../health` nos 4 serviços, `pg_isready` nos bancos, `rabbitmq-diagnostics -q ping` no MQ, `depends_on` com `condition: service_healthy` | job `docker` (`up --wait`) |
| `GET /health` 200 só com banco e RabbitMQ ok, senão 503 | `src/saude/` | `tests/unit/saude/saude.test.ts`, `tests/integration/microsservicos.integration.test.ts` |
| `amqplib`, filas duráveis, mensagens persistentes, confirmação de entrega | `src/mensageria/BarramentoAmqp.ts` (confirm channel, `durable: true`, `persistent: true`, ack manual, nack com uma reentrega) | `tests/unit/mensageria/BarramentoAmqp.test.ts` (amqplib mockado) |
| RPC `consulta-profissionais` com `correlationId` e `replyTo` exclusivo por requisição | `BarramentoAmqp.consultar`, `ClienteRpc`, `ServidorRpc`, `AdaptadorPorMensagens`, `OperacoesDeProfissionais` | `BarramentoAmqp.test.ts`, `mensageria.test.ts`, integração (RPC ponta a ponta) |
| RPC `consulta-projetos` (projetos é a fonte de verdade) | `ProjetoRepositoryPorMensagens`, `OperacoesDeProjetos` | integração (mesma recomendação do modo em processo) |
| `eventos-projetos` e `eventos-recomendacoes` consumidos com Observer | `OperacoesDeProjetos` (criado/atualizado/finalizado), `PublicadorEmFilaObservador` no EventEmitter da API, `CentralDeNotificacoes` + `AlertaPersistidoObservador`, `EmailSimuladoObservador`, `MensagemInternaSimuladaObservador` | `tests/unit/notificacoes/notificacoes.test.ts`, integração (fluxo completo) |
| Resiliência | timeout no RPC, fallback da `FonteProfissionaisResiliente`, `comRetentativas` na subida, reconexão do barramento, SIGTERM em `src/entradas/executarServico.ts` | integração (timeout → `CACHE`/`INDISPONIVEL`), `BarramentoAmqp.test.ts` (reconexão), `saude.test.ts` (retentativas e ciclo de vida) |
| CI com Docker | `.github/workflows/ci.yml`, job `docker` | — |

## Decisões

- **`node:24-alpine` no lugar de `node:18-alpine`.** O projeto exige Node 24 (`engines`) e o Fastify 5 não suporta Node 18. Decisão do autor.
- **`npm ci` no lugar de `npm install`.** Instala exatamente o `package-lock.json`. Decisão do autor.
- **`docker compose` (v2).** O README usa `docker compose` e cita `docker-compose`, que aceita o mesmo arquivo.
- **Migrations na subida.** O `CMD` roda `prisma migrate deploy` do próprio schema e depois `exec node dist/...` (o `exec` faz o Node receber o SIGTERM direto). Por isso o `CMD` usa `sh -c` em vez de `["node", "dist/..."]`.
- **Um schema por serviço, um cliente gerado por schema.** `npm run prisma:gerar` (chamado pelo `postinstall`) gera `generated/<nome>`. Sem schema na raiz. As chaves estrangeiras entre domínios foram removidas (ficam só os ids).
- **Imagem.** Cada imagem tem o código compartilhado inteiro e muda só o `CMD`; as camadas iguais são reaproveitadas pelo cache do build. Roda como o usuário `node`. Instala `curl` (healthcheck) e `openssl` (Prisma, `binaryTargets` `linux-musl-openssl-3.0.x`).
- **`amqplib` 0.10.9 e `@types/amqplib` 0.10.8.** A linha 2.x do `amqplib` já traz tipos próprios e dispensaria o `@types`; a 0.10 é a coberta pelos tipos pedidos.
- **Porta `BarramentoDeMensagens`.** O domínio e os serviços não importam `amqplib`: só `BarramentoAmqp` o faz. `BarramentoEmMemoria` é usado nos testes e copia as mensagens como JSON, para pegar erros de serialização.
- **RPC.** Cada consulta cria uma fila de retorno exclusiva, com nome gerado pelo broker (`amq.gen-...`) e `autoDelete`. O pedido vai com `expiration` igual ao timeout, para não ser processado depois que o cliente desistiu. Erros de domínio viajam como `{codigo, codigoHttp, mensagem}` e voltam como `ErroRemoto`, mantendo os mesmos status HTTP de antes (404, 422...). Timeout ou RabbitMQ fora viram `ErroServicoIndisponivel` (503).
- **Fallback.** A API carrega o catálogo de profissionais por RPC e mantém o cache/TTL da ATVIII. Sem resposta, recomenda com o cache (`CACHE`) ou parcial (`INDISPONIVEL`), nunca 500.
- **Eventos.** A API mantém o EventEmitter (Observer interno) e ganhou dois observadores: `PublicadorEmFilaObservador` (envia cada evento para `eventos-recomendacoes`) e `FinalizacaoDeProjetoObservador` (na `equipe.finalizada`, pede `finalizar` ao serviço de projetos, que grava `finalizadoEm` e publica `projeto.finalizado`). Os e-mails e mensagens internas saíram da API e foram para o serviço de notificações; os notificadores por tipo das fábricas continuam na API.
- **Notificações.** Uma linha por evento em `notificacoes` (id do evento como chave, gravação idempotente). Se um observador falhar, a mensagem volta à fila uma vez e, na segunda falha, é descartada com log.
- **Provedor de profissionais.** `PROFISSIONAIS` (`interno`, `linkedin`, `indeed`) passou para o serviço de profissionais, dono do cadastro.

## Diferenças do enunciado

- `node:24-alpine` e `npm ci` (acima).
- `CMD` com `sh -c` para aplicar as migrations antes de iniciar.
- A tabela de notificações se chama `notificacoes` (em minúsculas), para o `psql` do README funcionar igual no PowerShell e no bash.

## Checagem de anti-padrões

- **Sem `any`, `as` de tipo, `@ts-ignore` ou `console.log` em `src/`.** Os JSON das mensagens são lidos por `src/mensageria/leitorJson.ts`, que valida cada campo.
- **Sem singleton nem estado global.** Barramento, clientes RPC, repositórios e observadores são criados nas raízes de composição (`src/composicao/compor*.ts`) e injetados.
- **Sem `instanceof` por tipo de negócio.** Só há `instanceof` em erros e `Date`.
- **Um arquivo por classe; encapsulamento** com `private readonly` e getters.
- **Sem comentários** em código e configuração, exceto os 10 `// submarino` originais.
