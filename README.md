# cinebridge

[![CI](https://github.com/Clown0o0/AV4-tpiII/actions/workflows/ci.yml/badge.svg)](https://github.com/Clown0o0/AV4-tpiII/actions/workflows/ci.yml)
![Docker](https://img.shields.io/badge/Docker-v29.9.3-2496ED?style=flat&logo=docker&logoColor=white)
![Docker Compose](https://img.shields.io/badge/Docker%20Compose-v5.7.0-2496ED?style=flat&logo=docker&logoColor=white)

Plataforma cinebridge em microsserviços: recebe um projeto audiovisual e recomenda uma equipe técnica dentro do orçamento e do prazo. São 4 serviços Node.js, 4 bancos PostgreSQL e um RabbitMQ, todos em containers orquestrados pelo Docker Compose.

## Índice

1. [Visão geral](#visão-geral)
2. [Início rápido](#início-rápido)
3. [Pré-requisitos](#pré-requisitos)
4. [Passo a passo](#passo-a-passo)
5. [Variáveis de ambiente](#variáveis-de-ambiente)
6. [Endpoints e exemplos](#endpoints-e-exemplos)
7. [Testes e CI](#testes-e-ci)
8. [Organização do código](#organização-do-código)
9. [Solução de problemas](#solução-de-problemas)
10. [Compatibilidade](#compatibilidade)
11. [Documentação técnica](#documentação-técnica)

## Visão geral

O produtor envia o projeto para a API e recebe um profissional sugerido por papel. Depois aceita, rejeita ou substitui cada sugestão, os profissionais respondem aos convites e, com todos aceitos, a equipe é finalizada. A API não chama os outros serviços por HTTP: tudo passa pelo RabbitMQ.

| Serviço | Container | Porta (host:container) | Banco próprio (porta no host) | Responsabilidade |
|---|---|---|---|---|
| API | `cinebridge-api` | 3000:3000 | `recomendacoes-db` (5434) | Ponto de entrada REST; recomendação e orquestração da equipe; dona de recomendações e convites |
| Profissionais | `cinebridge-profissionais` | 3001:3001 | `profissionais-db` (5432) | Cadastro, competências, avaliações e disponibilidades |
| Projetos | `cinebridge-projetos` | 3002:3002 | `projetos-db` (5433) | Ciclo de vida dos projetos (fonte de verdade), métricas e resultados |
| Notificações | `cinebridge-notificacoes` | 3003:3003 | `notificacoes-db` (5435) | E-mails, mensagens internas e alertas (simulados, sem SMTP) |
| Barramento | `cinebridge-mq` (`rabbitmq:3-management-alpine`) | 5672:5672 e 15672:15672 | — | Filas de mensagens e painel web |

Todos os containers ficam na rede `cinebridge-net` (driver bridge) e se encontram pelo nome. Cada banco usa `postgres:15-alpine` com volume próprio.

```
                 HTTP :3000
 produtor ───────────────────► cinebridge-api ──── recomendacoes-db
                                 │   ▲     │
        consulta-profissionais   │   │     │  eventos-recomendacoes
        (RPC, resposta em fila   │   │     │
         exclusiva por pedido)   ▼   │     ▼
              cinebridge-profissionais   cinebridge-notificacoes ── notificacoes-db
                      │                        ▲
               profissionais-db                │ eventos-projetos
                                               │
        consulta-projetos (RPC) ──► cinebridge-projetos ── projetos-db
```

| Fila | Tipo | Quem publica | Quem consome | Conteúdo |
|---|---|---|---|---|
| `consulta-profissionais` | RPC | API | Profissionais | Listar candidatos, buscar por ids, detalhar e registrar avaliação |
| `consulta-projetos` | RPC | API | Projetos | Salvar, buscar e finalizar projeto |
| `eventos-projetos` | Evento | Projetos | Notificações | `projeto.criado`, `projeto.atualizado`, `projeto.finalizado` |
| `eventos-recomendacoes` | Evento | API | Notificações | `recomendacao.gerada`, `convite.aceito`, `equipe.finalizada` e os demais eventos da recomendação |

As filas são duráveis, as mensagens são persistentes, o publicador espera a confirmação do broker (confirm channel) e os consumidores só confirmam (ack) depois de tratar a mensagem. Se o serviço de profissionais ou o RabbitMQ estiver fora, a API responde com o catálogo em cache ou com recomendação parcial (`"fonteProfissionais":"CACHE"` ou `"INDISPONIVEL"`), nunca com erro 500.

## Início rápido

Com o Docker rodando, em PowerShell ou bash:

```bash
git clone https://github.com/Clown0o0/AV4-tpiII.git
cd AV4-tpiII
npm run preparar
docker compose up -d --build
docker compose ps
curl.exe http://localhost:3000/health
```

Sem Node, troque `npm run preparar` pelos comandos do [passo 2](#2-criar-os-arquivos-env). No Ubuntu, use `curl` no lugar de `curl.exe`. Se a porta 5432 já estiver em uso, veja o [passo 2](#2-criar-os-arquivos-env).

## Pré-requisitos

| Ferramenta | Versão | Para quê |
|---|---|---|
| Docker Desktop (Windows 10 ou superior, com WSL2 ou Hyper-V) ou Docker Engine com o plugin Compose (Ubuntu 24.04.03 ou superior) | Docker 29.9.3 e Compose v5.7.0 testados; Compose v2 ou superior | Subir os containers |
| Git | qualquer recente | Clonar o repositório |
| curl | já vem no Windows 10+ (`curl.exe`) e no Ubuntu (`sudo apt install curl`, se faltar) | Chamar a API |
| Node.js 24 e npm (**opcional**) | 24 ou superior | Só para `npm run preparar`, `npm run exemplos` e `npm test`; há alternativa manual |

Não é preciso instalar PostgreSQL nem RabbitMQ: eles rodam nos containers.

## Passo a passo

### 1. Clonar

```bash
git clone https://github.com/Clown0o0/AV4-tpiII.git
cd AV4-tpiII
```

**Resultado esperado:** pasta `AV4-tpiII` com `docker-compose.yml`, `servicos/` e `src/`.

### 2. Criar os arquivos `.env`

```bash
npm run preparar
```

**Resultado esperado:** cinco linhas `criado:` (`.env` na raiz e um em cada `servicos/<nome>`). Se o arquivo já existir, aparece `mantido:` e ele não é sobrescrito.

Sem Node, faça a cópia manualmente.

PowerShell:

```powershell
foreach ($p in ".", "servicos/api", "servicos/profissionais", "servicos/projetos", "servicos/notificacoes") { if (-not (Test-Path "$p/.env")) { Copy-Item "$p/.env.example" "$p/.env" } }
```

bash:

```bash
for p in . servicos/api servicos/profissionais servicos/projetos servicos/notificacoes; do [ -f "$p/.env" ] || cp "$p/.env.example" "$p/.env"; done
```

O `.env` da raiz só define as portas publicadas no host. **Se a porta 5432 já estiver ocupada** (por exemplo, por um PostgreSQL instalado na máquina), edite o `.env` da raiz e troque `PROFISSIONAIS_DB_PORT=5432` por `PROFISSIONAIS_DB_PORT=55432`. O mesmo vale para as outras portas (veja a [tabela de variáveis](#portas-publicadas-env-da-raiz)). A troca só muda a porta do host: entre os containers, os serviços continuam usando `profissionais-db:5432`.

### 3. Construir e subir os containers

```bash
docker compose up -d --build
```

**Resultado esperado:** na primeira vez, o Docker baixa `node:24-alpine`, `postgres:15-alpine` e `rabbitmq:3-management-alpine`, constrói as 4 imagens (`cinebridge/api:atv4` e as outras) e termina com `Container cinebridge-api Started`. A ordem é garantida pelo `depends_on` com `condition: service_healthy`: primeiro os bancos e o RabbitMQ, depois profissionais, projetos e notificações, e por fim a API. Cada serviço aplica as próprias migrations (`prisma migrate deploy`) antes de iniciar. Também funciona com o binário antigo, `docker-compose up -d --build`.

### 4. Conferir a saúde

```bash
docker compose ps
```

**Resultado esperado:** os 9 containers com `Up ... (healthy)`. A API leva de 30 a 60 segundos para ficar `healthy`, porque espera os outros serviços. Depois:

```bash
curl.exe http://localhost:3000/health
curl.exe http://localhost:3001/health
curl.exe http://localhost:3002/health
curl.exe http://localhost:3003/health
```

**Resultado esperado:** `{"status":"ok","banco":"ok","mensageria":"ok"}` nos quatro. Se o banco ou o RabbitMQ de um serviço cair, o `/health` dele responde 503 com `"status":"indisponivel"` e o recurso em `"falha"`.

### 5. Acompanhar os logs

```bash
docker compose logs -f cinebridge-api cinebridge-notificacoes
```

**Resultado esperado:** logs em JSON, como `"msg":"conectado ao RabbitMQ"`, `"msg":"serviço iniciado"` e `"msg":"Server listening at http://0.0.0.0:3000"`. Ctrl+C sai dos logs sem parar os containers.

### 6. Popular os profissionais

```bash
docker compose exec cinebridge-profissionais npm run db:seed
```

**Resultado esperado:** `Limpando dados e gerando 300 profissionais...`, `300/300` e `Seed concluído...`. Para a carga com 10.000 profissionais:

```bash
docker compose exec -e SEED_PROFISSIONAIS=10000 cinebridge-profissionais npm run db:seed
```

A API recarrega o catálogo sozinha em até 30 segundos (metade de `CATALOGO_TTL_MS`). Para usar os novos profissionais na hora, rode `docker compose restart cinebridge-api`.

### 7. Gerar os exemplos com a data atual (opcional, precisa de Node)

```bash
npm run exemplos
```

**Resultado esperado:** `Exemplos gravados em exemplos/gerados com dataEntrega = AAAA-MM-DD` e 9 arquivos em `exemplos/gerados/`, com entrega daqui a 60 dias. Sem Node, use os arquivos de `exemplos/` diretamente, trocando `exemplos/gerados/` por `exemplos/` nos comandos e ajustando `dataEntrega` para uma data futura, se necessário.

### 8. Pedir uma recomendação

```bash
curl.exe -X POST http://localhost:3000/projetos/recomendar -H "content-type: application/json" --data-binary "@exemplos/gerados/documentario.json"
```

**Resultado esperado:** 201 com `projeto`, `recomendacao` (equipe sugerida) e `"fonteProfissionais":"REPOSITORIO"`. O projeto foi salvo pelo serviço de projetos (fila `consulta-projetos`), os candidatos vieram do serviço de profissionais (fila `consulta-profissionais`) e os eventos seguiram para as notificações. Continue com os [exemplos](#exemplos-na-ordem).

### 9. Ver as filas no RabbitMQ

Abra http://localhost:15672 e entre com usuário `guest` e senha `guest`. Na aba **Queues and Streams** aparecem `consulta-profissionais`, `consulta-projetos`, `eventos-projetos` e `eventos-recomendacoes` (com `D` de durável) e, durante uma consulta, as filas de retorno temporárias `amq.gen-...`. Em **Overview** aparecem os gráficos de mensagens publicadas e entregues. Pelo terminal:

```bash
docker compose exec cinebridge-mq rabbitmqctl list_queues name durable messages consumers
```

**Resultado esperado:** as 4 filas com `true` em `durable`, 0 mensagens paradas e 1 consumidor cada (as duas de eventos são consumidas pelas notificações).

### 10. Conferir as notificações gravadas

```bash
docker compose exec notificacoes-db psql -U cinebridge -d notificacoes -c "SELECT evento, origem, titulo, texto FROM notificacoes;"
```

**Resultado esperado:** uma linha por evento, por exemplo `projeto.criado | PROJETOS` e `recomendacao.gerada | RECOMENDACOES`. Os e-mails e mensagens internas simulados aparecem no log: `docker compose logs cinebridge-notificacoes` mostra `"canal":"email"` e `"canal":"mensagem-interna"`.

### 11. Parar

```bash
docker compose down
```

**Resultado esperado:** containers e rede removidos; os dados continuam nos volumes. Para apagar também os dados (bancos e filas) e começar do zero:

```bash
docker compose down -v
```

## Variáveis de ambiente

Cada serviço lê o próprio `servicos/<nome>/.env` (via `env_file` no compose). Os hosts são os **nomes dos containers**, e a porta dos bancos dentro da rede é sempre 5432.

| Variável | Serviços | Padrão no `.env.example` | Descrição |
|---|---|---|---|
| `PORT` | todos | 3000, 3001, 3002, 3003 | Porta HTTP dentro do container |
| `HOST` | todos | `0.0.0.0` | Interface de escuta |
| `LOG_LEVEL` | todos | `info` | `fatal`, `error`, `warn`, `info`, `debug`, `trace` ou `silent` |
| `DATABASE_URL` | todos | `postgresql://cinebridge:cinebridge@<nome>-db:5432/<banco>?schema=public` | Banco do serviço (`recomendacoes-db`, `profissionais-db`, `projetos-db`, `notificacoes-db`) |
| `RABBITMQ_URL` | todos | `amqp://guest:guest@cinebridge-mq:5672` | Conexão com o RabbitMQ |
| `MENSAGENS_TIMEOUT_MS` | todos | `10000` | Prazo de resposta das consultas por fila (RPC) |
| `CATALOGO_TTL_MS` | api | `60000` | Validade do catálogo de profissionais em cache; recarrega na metade desse tempo |
| `PROFISSIONAIS_TIMEOUT_MS` | api | `1500` | Prazo para o serviço de profissionais antes de usar o fallback |
| `ARMAZENAMENTO` | api | `local` | `local`, `s3` ou `google` (simulados) |
| `PAGAMENTO` | api | `stripe` | `stripe`, `pagseguro` ou `paypal` (simulados) |
| `DECORADORES` | api | `cache,auditoria` | Pilha de decoradores da recomendação (`cache`, `auditoria`, `compressao`; vazio = nenhum) |
| `DECORADORES_POR_PRODUTOR` | api | vazio | JSON como `{"produtor-1":["cache","compressao"]}` |
| `PROFISSIONAIS` | profissionais | `interno` | Fonte dos profissionais: `interno`, `linkedin` ou `indeed` (simulados) |
| `SEED_PROFISSIONAIS` | profissionais | `300` | Quantidade gerada pelo `npm run db:seed` |

Credenciais: bancos com usuário `cinebridge` e senha `cinebridge`; RabbitMQ com `guest`/`guest` (padrão da imagem).

### Portas publicadas (`.env` da raiz)

O Docker Compose lê o `.env` da raiz automaticamente. Troque um valor quando a porta do host estiver ocupada.

| Variável | Padrão | Container |
|---|---|---|
| `API_PORT` | 3000 | `cinebridge-api` |
| `PROFISSIONAIS_PORT` | 3001 | `cinebridge-profissionais` |
| `PROJETOS_PORT` | 3002 | `cinebridge-projetos` |
| `NOTIFICACOES_PORT` | 3003 | `cinebridge-notificacoes` |
| `PROFISSIONAIS_DB_PORT` | 5432 | `profissionais-db` |
| `PROJETOS_DB_PORT` | 5433 | `projetos-db` |
| `RECOMENDACOES_DB_PORT` | 5434 | `recomendacoes-db` |
| `NOTIFICACOES_DB_PORT` | 5435 | `notificacoes-db` |
| `RABBITMQ_PORT` | 5672 | `cinebridge-mq` (AMQP) |
| `RABBITMQ_UI_PORT` | 15672 | `cinebridge-mq` (painel web) |

## Endpoints e exemplos

Todas as rotas de negócio ficam na API (`http://localhost:3000`). Os outros serviços expõem só `GET /health`.

| Método | Caminho | Sucesso | O que faz |
|---|---|---|---|
| POST | `/projetos/recomendar` | 201 | Recebe o projeto (com `papeis` ou `servicoPrincipal`, ou um `modelo` + ajustes) e devolve `projeto`, `recomendacao` e `fonteProfissionais` |
| GET | `/projetos/modelos` | 200 | Chaves aceitas em `modelo` |
| PATCH | `/projetos/:id` | 200 | Altera `orcamentoTotal`, `dataEntrega` ou `estrategia` e reavalia se a mudança for grande |
| GET | `/recomendacoes/:id` | 200 | Equipe, histórico e convites |
| GET | `/recomendacoes/:id/relatorio` | 200 | Relatório, validação e compatibilidade |
| POST | `/recomendacoes/:id/membros/:papel/aceitar` | 201 | Aceita a sugestão e convida o profissional |
| POST | `/recomendacoes/:id/membros/:papel/rejeitar` | 200 | Rejeita a sugestão |
| POST | `/recomendacoes/:id/membros/:papel/substituir` | 200 | Nova sugestão só para o papel |
| POST | `/convites/:id/responder` | 200 | `{"aceito": true}` ou `{"aceito": false}`; com todos aceitos, a equipe é finalizada e o projeto também |
| POST | `/projetos/:projetoId/arquivos` | 201 | Anexa roteiro, storyboard ou amostra de vídeo |
| GET | `/projetos/:projetoId/arquivos` | 200 | Lista os arquivos do projeto |
| GET | `/projetos/:projetoId/arquivos/:arquivoId` | 200 | Metadados e conteúdo em base64 |
| POST | `/recomendacoes/:recomendacaoId/pagamentos` | 201 | Paga o membro confirmado do `papel` |
| GET | `/pagamentos/:pagamentoId` | 200 | Status do pagamento |
| POST | `/pagamentos/:pagamentoId/cancelamento` | 200 | Cancela o pagamento |
| GET | `/profissionais/:profissionalId` | 200 | Perfil do profissional (consulta ao serviço de profissionais) |
| POST | `/profissionais/:profissionalId/avaliacoes` | 201 | Registra a avaliação do produtor |
| GET | `/health` | 200 ou 503 | `{"status":"ok","banco":"ok","mensageria":"ok"}` |

Papéis: `DIRETOR`, `DIRETOR_FOTOGRAFIA`, `SONOPLASTA`, `EDITOR`, `ROTEIRISTA`, `EFEITOS_VISUAIS`. Os erros têm sempre o formato `{"erro": "CODIGO", "mensagem": "..."}`:

| Status | `erro` | Quando |
|---|---|---|
| 400 | `REQUISICAO_INVALIDA` | JSON malformado, campo faltando, valor fora do schema |
| 404 | `NAO_ENCONTRADO` | Projeto, recomendação, convite, arquivo, pagamento ou profissional inexistente |
| 409 | `ESTADO_INVALIDO` | Ação que o estado não permite |
| 422 | `VALIDACAO` | Regra de negócio (data no passado, papel repetido, nota fora de 1 a 5 etc.) |
| 503 | `SERVICO_INDISPONIVEL` | O serviço de projetos (ou o RabbitMQ) não respondeu no prazo; profissionais têm fallback e não chegam a este erro na recomendação |
| 500 | `ERRO_INTERNO` | Falha inesperada; o detalhe fica no log |

### Exemplos (na ordem)

Rode da raiz do projeto, com os containers `healthy`, o seed feito e depois de `npm run exemplos`. Troque `ID_...` pelos valores das respostas anteriores.

**1. Documentário.** Anote `projeto.id`, `recomendacao.id` e o `profissionalId` do `DIRETOR`:

```bash
curl.exe -X POST http://localhost:3000/projetos/recomendar -H "content-type: application/json" --data-binary "@exemplos/gerados/documentario.json"
```

Resposta 201: `{"projeto":{"id":"...","tipoCaptacao":"DOCUMENTARIO",...},"recomendacao":{"id":"...","status":"EM_ANDAMENTO","equipe":[{"papel":"DIRETOR","profissionalId":"...","status":"SUGERIDO",...},...]},"fonteProfissionais":"REPOSITORIO"}`.

**2. Aceitar cada membro** (`DIRETOR`, `ROTEIRISTA` e `SONOPLASTA`). Anote o `convite.id` de cada um:

```bash
curl.exe -X POST http://localhost:3000/recomendacoes/ID_DA_RECOMENDACAO/membros/DIRETOR/aceitar
```

Resposta 201 com `"convite":{"id":"...","status":"PENDENTE",...}`.

**3. Responder cada convite:**

```bash
curl.exe -X POST http://localhost:3000/convites/ID_DO_CONVITE/responder -H "content-type: application/json" --data-binary "@exemplos/gerados/resposta-convite.json"
```

Resposta 200. No último, `"equipeFinalizada":true`: a recomendação passa a `FINALIZADA`, a API pede ao serviço de projetos para finalizar o projeto e chegam às notificações `equipe.finalizada` e `projeto.finalizado`.

**4. Consultar a equipe e o relatório:**

```bash
curl.exe http://localhost:3000/recomendacoes/ID_DA_RECOMENDACAO
curl.exe http://localhost:3000/recomendacoes/ID_DA_RECOMENDACAO/relatorio
```

**5. Ver e avaliar um profissional** (o `profissionalId` do diretor):

```bash
curl.exe http://localhost:3000/profissionais/ID_DO_PROFISSIONAL
curl.exe -X POST http://localhost:3000/profissionais/ID_DO_PROFISSIONAL/avaliacoes -H "content-type: application/json" --data-binary "@exemplos/gerados/avaliar-profissional.json"
```

Respostas: 200 com `id`, `nome`, `especialidades`, `competencias` e `mediaAvaliacoes`, depois 201 `{"profissionalId":"...","autorId":"produtor-4","nota":5,...}`. A avaliação é gravada no `profissionais-db`.

**6. Pagar o diretor confirmado, consultar e cancelar:**

```bash
curl.exe -X POST http://localhost:3000/recomendacoes/ID_DA_RECOMENDACAO/pagamentos -H "content-type: application/json" --data-binary "@exemplos/gerados/pagar-profissional.json"
curl.exe http://localhost:3000/pagamentos/ID_DO_PAGAMENTO
curl.exe -X POST http://localhost:3000/pagamentos/ID_DO_PAGAMENTO/cancelamento
```

**7. Outros tipos de projeto e alteração:**

```bash
curl.exe -X POST http://localhost:3000/projetos/recomendar -H "content-type: application/json" --data-binary "@exemplos/gerados/projeto-servicos.json"
curl.exe -X POST http://localhost:3000/projetos/recomendar -H "content-type: application/json" --data-binary "@exemplos/gerados/animacao.json"
curl.exe -X PATCH http://localhost:3000/projetos/ID_DO_PROJETO_DA_ANIMACAO -H "content-type: application/json" --data-binary "@exemplos/gerados/alterar-projeto.json"
curl.exe -X POST http://localhost:3000/projetos/recomendar -H "content-type: application/json" --data-binary "@exemplos/gerados/modelo-publicitario.json"
```

O PATCH responde 200 com `"reavaliada":true` e gera o evento `projeto.atualizado` no serviço de projetos.

**8. Fallback com o serviço de profissionais parado:**

```bash
docker compose stop cinebridge-profissionais
```

Espere pouco mais de 60 segundos (`CATALOGO_TTL_MS`), para o catálogo em memória da API vencer, e então:

```bash
curl.exe -X POST http://localhost:3000/projetos/recomendar -H "content-type: application/json" --data-binary "@exemplos/gerados/animacao.json"
docker compose start cinebridge-profissionais
```

**Resultado esperado:** 201 com `"fonteProfissionais":"CACHE"` (equipe montada com o último catálogo recebido), em cerca de 1,5 s (`PROFISSIONAIS_TIMEOUT_MS`) e sem erro 500. Antes dos 60 segundos, a resposta ainda vem `"REPOSITORIO"`, porque o catálogo continua válido. Se a API for reiniciada com o serviço parado, não há cache: vem `"fonteProfissionais":"INDISPONIVEL"` e `"parcial":true`. Rotas que dependem só do serviço parado, como `GET /profissionais/:id`, respondem 503 `SERVICO_INDISPONIVEL` depois de `MENSAGENS_TIMEOUT_MS`.

## Testes e CI

Os testes não precisam de Docker, banco nem RabbitMQ: usam repositórios em memória, o barramento em memória e o `amqplib` simulado.

```bash
npm ci
npm test
```

**Resultado esperado:** `Test Suites: 43 passed, 43 total`, `Tests: 547 passed, 547 total` e cobertura acima de 99% (mínimo exigido: 90%). O `npm ci` roda o `postinstall`, que gera os 4 clientes Prisma (`npm run prisma:gerar`, um por `servicos/<nome>/prisma/schema.prisma`, em `generated/<nome>`). Use `npm test`, e não `npx jest`.

Os testes de integração provam, sem Docker: o RPC de profissionais ponta a ponta; que a API usando projetos e profissionais por mensagens produz a mesma recomendação do modo em processo; o evento de projeto virando notificação persistida via Observer; o fallback quando o RPC dá timeout; e `/health` 200/503 dos 4 serviços.

O GitHub Actions (`.github/workflows/ci.yml`) tem dois jobs:

- `testes`, em `ubuntu-24.04` e `windows-latest` com Node 24: `npm ci`, `npm run prisma:gerar`, `tsc --noEmit`, `build` e `npm test`;
- `docker`, em `ubuntu-24.04`: `npm run preparar`, `docker compose up -d --build --wait`, `curl -f` no `/health` dos 4 serviços e `docker compose down -v`.

## Organização do código

O código de domínio é um só e é compartilhado pelos 4 serviços. Cada serviço tem uma entrada e uma raiz de composição próprias.

```
docker-compose.yml          4 serviços, 4 bancos, RabbitMQ, rede cinebridge-net e volumes
.env.example                Portas publicadas no host
scripts/preparar.js         Cria os .env a partir dos .env.example
servicos/
├── api/                    Dockerfile, .env.example e prisma/ (schema e migrations de recomendacoes-db)
├── profissionais/          Dockerfile, .env.example e prisma/ (profissionais-db)
├── projetos/               Dockerfile, .env.example e prisma/ (projetos-db)
└── notificacoes/           Dockerfile, .env.example e prisma/ (notificacoes-db)
src/
├── server.ts               Entrada da API
├── entradas/               Entradas de profissionais, projetos e notificações e o executor comum (sinais e encerramento)
├── composicao/             Raízes de composição (comporApi, comporProfissionais, comporProjetos, comporNotificacoes), ciclo de vida e ambiente
├── mensageria/             BarramentoAmqp (amqplib), BarramentoEmMemoria, ClienteRpc, ServidorRpc, filas e codecs JSON
├── profissionais/          Operações RPC do serviço de profissionais
├── projetos/               Operações RPC e eventos do serviço de projetos
├── notificacoes/           Observer: central, alerta persistido, e-mail e mensagem interna simulados, consumidor das filas
├── saude/                  Verificador e rota /health
├── app.ts                  Fastify da API: rotas, formato de erro, 404
├── adaptadores/            Adapter: armazenamento, pagamento e profissional (inclui AdaptadorPorMensagens)
├── domain/                 Entidades, portas (inclui BarramentoDeMensagens) e erros
├── services/               SistemaRecomendacao (fachada) e colaboradores
├── orchestration/          Template Method
├── strategies/             Strategy e Decorator
├── factories/              Abstract Factory e Factory Method
├── prototypes/             Prototype
├── visitors/               Visitor
├── servicos-projeto/       Composite
├── events/                 Observer interno da API (EventEmitter) e observadores
├── repositories/           Prisma por serviço e repositório de projetos por mensagens
└── routes/                 Rotas, schemas e serializadores
generated/                  Clientes Prisma gerados (fora do Git)
prisma/seed.ts              Seed dos profissionais
tests/                      unit/, integration/ e support/
exemplos/                   Modelos JSON e o gerador (gerados/ fica fora do Git)
docs/                       ATVII.md, ATVIII.md e ATVIV.md
```

## Solução de problemas

### Docker não iniciado

`error during connect` ou `Cannot connect to the Docker daemon`: no Windows, abra o Docker Desktop e espere o ícone ficar verde; no Ubuntu, `sudo systemctl start docker`. Confira com `docker info`.

### Porta em uso

`Bind for 0.0.0.0:5432 failed: port is already allocated` (ou outra porta): troque a porta do host no `.env` da raiz (por exemplo, `PROFISSIONAIS_DB_PORT=55432`) e rode `docker compose up -d` de novo. Não é preciso parar o serviço que usa a porta.

### WSL2 no Windows

O Docker Desktop pede o WSL2 (ou Hyper-V). Se ele avisar que o WSL está desatualizado, rode `wsl --update` no PowerShell como administrador e reinicie o Docker Desktop.

### curl no PowerShell

No PowerShell, `curl` é um apelido para `Invoke-WebRequest`. Use `curl.exe`, como nos exemplos. No Ubuntu, use `curl`.

### Container `unhealthy` ou demorando

Na primeira subida, o RabbitMQ leva uns 20 segundos e a API só fica `healthy` depois dos outros serviços. Espere e rode `docker compose ps` de novo. Se continuar, veja `docker compose logs cinebridge-api`. Os serviços tentam conectar ao banco e ao RabbitMQ com novas tentativas e espera crescente, e o Docker os reinicia (`restart: unless-stopped`).

### RabbitMQ ainda subindo

Logs com `falha ao conectar; nova tentativa` e `"recurso":"rabbitmq"` logo após o `up` são normais: o serviço tenta de novo sozinho. Se o RabbitMQ cair com tudo no ar, os serviços ficam `unhealthy` (o `/health` responde 503), reconectam quando ele volta e refazem as inscrições nas filas.

### `env file ... not found`

Faltam os `.env` dos serviços: rode o [passo 2](#2-criar-os-arquivos-env).

### Recomendação com poucos profissionais

O seed não foi feito ou a API ainda usa o catálogo antigo: rode o [passo 6](#6-popular-os-profissionais) e `docker compose restart cinebridge-api`.

### Erro 422 "A data de entrega do projeto já passou"

Rode `npm run exemplos` de novo ou ajuste `dataEntrega` no JSON.

### Resetar os dados

`docker compose down -v` apaga os volumes dos 4 bancos e do RabbitMQ. Depois, `docker compose up -d --build` e o seed de novo.

### npm ci falha no postinstall (Prisma)

O `postinstall` roda `npm run prisma:gerar`. Confira se as pastas `servicos/<nome>/prisma` existem e, no Windows, feche processos Node que estejam com `generated/` aberto (erro `EPERM`).

## Compatibilidade

Testado no **Windows 11** com Docker Desktop (WSL2) e, pelo CI, no **Ubuntu 24.04**; compatível com Windows 10 ou superior e Ubuntu 24.04.03 ou superior e derivadas. As imagens são Linux (`node:24-alpine`), então o comportamento dentro dos containers é o mesmo nos dois sistemas. Os scripts npm não usam sintaxe de shell específica, os caminhos são montados pelo Node e o fim de linha é fixado em LF (`.gitattributes`), o que evita quebrar o `sh -c` dos containers quando o clone é feito no Windows. Os comandos `docker compose`, `npm` e `curl.exe`/`curl` deste README funcionam em PowerShell e em bash.

## Documentação técnica

- [docs/ATVIV.md](docs/ATVIV.md): containers, filas, exigências da ATVIV e decisões.
- [docs/ATVIII.md](docs/ATVIII.md): Adapter, Composite e Decorator.
- [docs/ATVII.md](docs/ATVII.md): Strategy, Template Method, Observer, Visitor, Prototype e fábricas.
