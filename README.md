# cinebridge-recomendacao

[![CI](https://github.com/Clown0o0/AV3-tpiII/actions/workflows/ci.yml/badge.svg)](https://github.com/Clown0o0/AV3-tpiII/actions/workflows/ci.yml)
![Node.js](https://img.shields.io/badge/Node.js-v24.15.0-339933?style=flat&logo=nodedotjs&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-v18.6-4169E1?style=flat&logo=postgresql&logoColor=white)

Microsserviço da plataforma cinebridge que recebe um projeto audiovisual e recomenda uma equipe técnica dentro do orçamento e do prazo.

## Índice

1. [Visão geral](#visão-geral)
2. [Início rápido](#início-rápido)
3. [Pré-requisitos](#pré-requisitos)
4. [Passo a passo](#passo-a-passo)
5. [Variáveis de ambiente](#variáveis-de-ambiente)
6. [Endpoints e exemplos](#endpoints-e-exemplos)
7. [Trocar provedores e decoradores](#trocar-provedores-e-decoradores)
8. [Organização do código](#organização-do-código)
9. [Compatibilidade e CI](#compatibilidade-e-ci)
10. [Solução de problemas](#solução-de-problemas)
11. [Documentação técnica](#documentação-técnica)

## Visão geral

O produtor envia o projeto (gênero, orçamento, prazo, localização e serviços ou papéis técnicos) e recebe um profissional sugerido por papel. Depois aceita, rejeita ou substitui cada sugestão. Os profissionais respondem aos convites, e com todos aceitos a equipe é finalizada. A estratégia de recomendação pode ser `COSSENO`, `FILTRAGEM_COLABORATIVA` ou `ORCAMENTO_REDUZIDO`, e o `tipoCaptacao` (`FICCAO`, `DOCUMENTARIO`, `ANIMACAO`, `PUBLICITARIO`) escolhe a fábrica do projeto.

O que a ATVIII acrescentou:

| Padrão | O que faz | Onde está |
|---|---|---|
| Adapter | Armazenamento de mídia (S3, Google Cloud, local), pagamento de profissionais (Stripe, PagSeguro, PayPal) e fonte de profissionais (cadastro interno, LinkedIn, Indeed), todos simulados e trocáveis por configuração | `src/adaptadores/` |
| Composite | O projeto tem um `servicoPrincipal`: uma árvore de pacotes e serviços atômicos com custo, prazo e papel. Custo, prazo e validação são calculados recursivamente | `src/servicos-projeto/` |
| Decorator | Cache, auditoria e compressão empilháveis em qualquer ordem sobre a estratégia de recomendação, configuráveis por ambiente e por produtor | `src/strategies/decoradores/` |

Os padrões anteriores continuam iguais: Strategy, Template Method, Observer, Visitor, Prototype, Factory Method e Abstract Factory.

## Início rápido

Para quem já tem Node.js 24, Git e PostgreSQL rodando. Cada passo está detalhado no [Passo a passo](#passo-a-passo).

**Windows (PowerShell):**

```powershell
git clone https://github.com/Clown0o0/AV3-tpiII.git
cd AV3-tpiII
npm ci
Copy-Item .env.example .env
notepad .env
npx prisma migrate deploy
npm run db:seed
npm run exemplos
npm run build
npm start
```

**Ubuntu (bash):**

```bash
git clone https://github.com/Clown0o0/AV3-tpiII.git
cd AV3-tpiII
npm ci
cp .env.example .env
nano .env
npx prisma migrate deploy
npm run db:seed
npm run exemplos
npm run build
npm start
```

No editor, troque `USUARIO` e `SENHA` da `DATABASE_URL` pelos do seu PostgreSQL. Depois, em outro terminal na mesma pasta:

```powershell
curl.exe http://localhost:3000/health
curl.exe -X POST http://localhost:3000/projetos/recomendar -H "content-type: application/json" --data-binary "@exemplos/gerados/documentario.json"
```

No Ubuntu, use `curl` no lugar de `curl.exe` (ou rode `alias curl.exe=curl`).

## Pré-requisitos

| Ferramenta | Versão testada | Conferir |
|---|---|---|
| Node.js | 24.15.0 (o `package.json` exige `>=24`) | `node -v` |
| npm | 11.12.1 (vem com o Node) | `npm -v` |
| PostgreSQL | 18.6 | `psql --version` |
| Git | 2.51 | `git --version` |
| curl | 8.16 (já vem no Windows 10+ como `curl.exe`) | `curl.exe --version` / `curl --version` |

| | Windows 10+ | Ubuntu 24.04.03+ e derivadas |
|---|---|---|
| Node.js 24 | instalador de https://nodejs.org | `nvm install 24` (https://github.com/nvm-sh/nvm) |
| PostgreSQL | instalador de https://www.postgresql.org/download/windows/ (serviço `postgresql-x64-18`) | `sudo apt install postgresql` e `sudo systemctl start postgresql` |
| Git | https://git-scm.com/download/win | `sudo apt install git` |
| curl | já instalado | `sudo apt install curl` |

TypeScript, Fastify, Prisma e Jest são instalados pelo `npm ci`; não é preciso instalá-los à parte.

## Passo a passo

Todos os comandos rodam na **raiz do projeto** (a pasta `AV3-tpiII`, onde está o `package.json`). Onde o comando muda entre sistemas, os dois aparecem.

### 1. Clonar

```bash
git clone https://github.com/Clown0o0/AV3-tpiII.git
cd AV3-tpiII
```

**Resultado esperado:** o terminal dentro da pasta `AV3-tpiII`.

### 2. Instalar as dependências

```bash
npm ci
```

**Resultado esperado:** `Generated Prisma Client (v6.19.3)` e `added ... packages`. Avisos de `npm audit` não impedem o uso.

### 3. Criar o `.env`

```powershell
Copy-Item .env.example .env
notepad .env
```

```bash
cp .env.example .env
nano .env
```

Troque `USUARIO` e `SENHA` na `DATABASE_URL`. Caracteres especiais da senha vão codificados (`@` vira `%40`). As outras variáveis já estão com os valores padrão (veja [Variáveis de ambiente](#variáveis-de-ambiente)). O `.env` não vai para o Git.

**Resultado esperado:** um arquivo `.env` ao lado do `package.json`.

### 4. Criar o banco e as tabelas

```bash
npx prisma migrate deploy
```

**Resultado esperado:** em banco novo, `PostgreSQL database cinebridge_recomendacao created`, `3 migrations found in prisma/migrations` e `All migrations have been successfully applied.` Quem já tem o banco da ATVII recebe só a migration nova, `20261101000000_servicos_do_projeto`, que acrescenta uma coluna sem mexer nos dados.

### 5. Popular com profissionais de exemplo

> **Atenção:** o seed **apaga todos os dados** do banco da `DATABASE_URL` antes de inserir.

```bash
npm run db:seed
```

**Resultado esperado:** `300/300` e `Seed concluído. Produtores com histórico de avaliações: produtor-1 ... produtor-25`. Para 10.000 profissionais:

```powershell
$env:SEED_PROFISSIONAIS=10000; npm run db:seed
```

```bash
SEED_PROFISSIONAIS=10000 npm run db:seed
```

### 6. Gerar os exemplos com a data atual

```bash
npm run exemplos
```

**Resultado esperado:** `Exemplos gravados em exemplos/gerados com dataEntrega = AAAA-MM-DD`, seguido de 9 arquivos (`alterar-projeto`, `anexar-arquivo`, `animacao`, `avaliar-profissional`, `documentario`, `modelo-publicitario`, `pagar-profissional`, `projeto-servicos` e `resposta-convite`). Os modelos de `exemplos/` não mudam. As cópias em `exemplos/gerados/` ficam fora do Git e levam `dataEntrega` = hoje + 60 dias.

### 7. Compilar e rodar o servidor

```bash
npm run build
npm start
```

**Resultado esperado:** logs em JSON com `"msg":"Server listening at http://127.0.0.1:3000"` e `"msg":"configuração ativa"`, mostrando os provedores e os decoradores em uso. O terminal fica ocupado; Ctrl+C para parar. Para desenvolvimento, `npm run dev` recarrega ao salvar.

### 8. Conferir se está no ar

Em outro terminal:

```bash
curl.exe http://localhost:3000/health
```

**Resultado esperado:** `{"status":"ok"}`.

### 9. Enviar os primeiros projetos

Siga a seção [Endpoints e exemplos](#endpoints-e-exemplos), na ordem.

### 10. Rodar os testes

```bash
npm test
```

**Resultado esperado:** `Test Suites: 36 passed, 36 total`, `Tests: 490 passed, 490 total` e a cobertura (mínimo exigido de 80%; hoje acima de 99%). Os testes não precisam do PostgreSQL. Use `npm test`, e não `npx jest` (veja [solução de problemas](#npx-jest-falha-com-must-use-import-to-load-es-module)).

## Variáveis de ambiente

Lidas e validadas em `src/composicao/configuracao.ts`. Um valor inválido encerra o processo com código 1 e uma mensagem dizendo o que é aceito. Variável vazia vale como ausente, exceto `DECORADORES`. Uma variável definida no terminal vale mais que o `.env`.

| Variável | Padrão | Efeito |
|---|---|---|
| `DATABASE_URL` | — (obrigatória) | `postgresql://USUARIO:SENHA@HOST:PORTA/BANCO?schema=public` |
| `PORT` | `3000` | Porta HTTP (1 a 65535) |
| `HOST` | `0.0.0.0` | Endereço em que o servidor escuta |
| `LOG_LEVEL` | `info` | `fatal`, `error`, `warn`, `info`, `debug`, `trace` ou `silent` |
| `CATALOGO_TTL_MS` | `60000` | Validade do cadastro de profissionais em memória. `0` lê a fonte a cada pedido |
| `PROFISSIONAIS_TIMEOUT_MS` | `1500` | Espera máxima pela fonte de profissionais antes de usar o último cadastro carregado |
| `SEED_PROFISSIONAIS` | `300` | Quantidade criada pelo `npm run db:seed` (0 a 1000000) |
| `ARMAZENAMENTO` | `local` | Provedor de arquivos: `local`, `s3` ou `google` |
| `PAGAMENTO` | `stripe` | Provedor de pagamento: `stripe`, `pagseguro` ou `paypal` |
| `PROFISSIONAIS` | `interno` | Fonte de profissionais: `interno` (banco), `linkedin` ou `indeed` |
| `DECORADORES` | `cache,auditoria` | Pilha de decoradores, em ordem, com `cache`, `auditoria` e `compressao`; o primeiro fica mais perto da estratégia. Vazio = nenhum |
| `DECORADORES_POR_PRODUTOR` | vazio | JSON com a pilha de cada produtor, ex.: `{"produtor-1":["cache","compressao"]}` |

Os provedores externos são **simulados** em memória: arquivos e pagamentos somem quando o servidor reinicia. O LinkedIn e o Indeed simulados mostram, no formato de cada plataforma, os mesmos profissionais do banco.

## Endpoints e exemplos

| Método | Caminho | Sucesso | O que faz |
|---|---|---|---|
| POST | `/projetos/recomendar` | 201 | Recebe o projeto (com `papeis` ou `servicoPrincipal`, ou um `modelo` + ajustes) e devolve `projeto`, `recomendacao` e `fonteProfissionais` |
| GET | `/projetos/modelos` | 200 | Chaves aceitas em `modelo` |
| PATCH | `/projetos/:id` | 200 | Altera `orcamentoTotal`, `dataEntrega` ou `estrategia` e reavalia se a mudança for grande |
| GET | `/recomendacoes/:id` | 200 | Equipe, histórico e convites |
| GET | `/recomendacoes/:id/relatorio` | 200 | Relatório (com `servicos`), validação e compatibilidade |
| POST | `/recomendacoes/:id/membros/:papel/aceitar` | 201 | Aceita a sugestão e convida o profissional |
| POST | `/recomendacoes/:id/membros/:papel/rejeitar` | 200 | Rejeita a sugestão |
| POST | `/recomendacoes/:id/membros/:papel/substituir` | 200 | Nova sugestão só para o papel |
| POST | `/convites/:id/responder` | 200 | `{"aceito": true}` ou `{"aceito": false}` |
| POST | `/projetos/:projetoId/arquivos` | 201 | Anexa roteiro, storyboard ou amostra de vídeo (`nome`, `categoria`, `conteudoBase64`) |
| GET | `/projetos/:projetoId/arquivos` | 200 | Lista os arquivos do projeto |
| GET | `/projetos/:projetoId/arquivos/:arquivoId` | 200 | Metadados e conteúdo em base64 |
| POST | `/recomendacoes/:recomendacaoId/pagamentos` | 201 | Paga o membro **confirmado** do `papel` pelo preço mínimo dele |
| GET | `/pagamentos/:pagamentoId` | 200 | Status do pagamento (`APROVADO` ou `CANCELADO`) |
| POST | `/pagamentos/:pagamentoId/cancelamento` | 200 | Cancela o pagamento |
| GET | `/profissionais/:profissionalId` | 200 | Perfil do profissional pela fonte configurada |
| POST | `/profissionais/:profissionalId/avaliacoes` | 201 | Registra a avaliação do produtor (`produtorId`, `nota` de 1 a 5, `comentario` opcional) |
| GET | `/health` | 200 | `{"status":"ok"}` |

Papéis: `DIRETOR`, `DIRETOR_FOTOGRAFIA`, `SONOPLASTA`, `EDITOR`, `ROTEIRISTA`, `EFEITOS_VISUAIS`. Os erros têm sempre o formato `{"erro": "CODIGO", "mensagem": "..."}`:

| Status | `erro` | Quando |
|---|---|---|
| 400 | `REQUISICAO_INVALIDA` | JSON malformado, campo faltando, valor fora do schema |
| 404 | `NAO_ENCONTRADO` | Projeto, recomendação, convite, arquivo, pagamento ou profissional inexistente |
| 409 | `ESTADO_INVALIDO` | Ação que o estado não permite (pagar membro não confirmado, cancelar duas vezes etc.) |
| 422 | `VALIDACAO` | Regra de negócio (data no passado, papel repetido, árvore de serviços inválida, `papeis` e `servicoPrincipal` juntos, nota fora de 1 a 5) |
| 500 | `ERRO_INTERNO` | Falha inesperada; o detalhe fica no log |

### Exemplos (na ordem)

Rode da raiz do projeto, com o servidor no ar e depois de `npm run exemplos`. Troque `ID_...` pelos valores das respostas anteriores. No Ubuntu, use `curl`.

**1. Documentário** (estratégia `ORCAMENTO_REDUZIDO`). Anote `projeto.id`, `recomendacao.id` e o `profissionalId` do `DIRETOR` na `equipe`:

```bash
curl.exe -X POST http://localhost:3000/projetos/recomendar -H "content-type: application/json" --data-binary "@exemplos/gerados/documentario.json"
```

Resposta 201: `{"projeto":{"id":"...","papeis":[...],"servicoPrincipal":{"tipo":"PACOTE","nome":"Serviços do projeto",...},"custoTotal":0,"prazoTotalDias":3,...},"recomendacao":{"id":"...","status":"EM_ANDAMENTO","equipe":[{"papel":"DIRETOR","profissionalId":"...","status":"SUGERIDO",...},...]},"fonteProfissionais":"REPOSITORIO"}`.

**2. Aceitar cada membro** (`DIRETOR`, `ROTEIRISTA` e `SONOPLASTA`). Anote o `convite.id` de cada um:

```bash
curl.exe -X POST http://localhost:3000/recomendacoes/ID_DA_RECOMENDACAO/membros/DIRETOR/aceitar
```

Resposta 201 com `"convite":{"id":"...","status":"PENDENTE",...}`.

**3. Responder cada convite:**

```bash
curl.exe -X POST http://localhost:3000/convites/ID_DO_CONVITE/responder -H "content-type: application/json" --data-binary "@exemplos/gerados/resposta-convite.json"
```

Resposta 200. No último, `"equipeFinalizada":true` e a recomendação passa a `FINALIZADA`.

**4. Consultar a equipe e o relatório:**

```bash
curl.exe http://localhost:3000/recomendacoes/ID_DA_RECOMENDACAO
curl.exe http://localhost:3000/recomendacoes/ID_DA_RECOMENDACAO/relatorio
```

O relatório traz `relatorio.servicos` com `arvore`, `custoTotal`, `prazoTotalDias`, `porServico` (profissional e `disponivel` de cada serviço atômico) e `avisos`.

**5. Pagar o diretor confirmado, consultar e cancelar:**

```bash
curl.exe -X POST http://localhost:3000/recomendacoes/ID_DA_RECOMENDACAO/pagamentos -H "content-type: application/json" --data-binary "@exemplos/gerados/pagar-profissional.json"
curl.exe http://localhost:3000/pagamentos/ID_DO_PAGAMENTO
curl.exe -X POST http://localhost:3000/pagamentos/ID_DO_PAGAMENTO/cancelamento
```

Respostas: 201 com `{"pagamentoId":"pi_...","status":"APROVADO","recomendacaoId":"...","papel":"DIRETOR","valor":...,"origem":"produtor-1","destino":"..."}`, depois 200 `{"pagamentoId":"...","status":"APROVADO"}` e 200 `{"pagamentoId":"...","status":"CANCELADO"}`. Cancelar de novo dá 409.

**6. Anexar, listar e baixar um arquivo do projeto:**

```bash
curl.exe -X POST http://localhost:3000/projetos/ID_DO_PROJETO/arquivos -H "content-type: application/json" --data-binary "@exemplos/gerados/anexar-arquivo.json"
curl.exe http://localhost:3000/projetos/ID_DO_PROJETO/arquivos
curl.exe http://localhost:3000/projetos/ID_DO_PROJETO/arquivos/ID_DO_ARQUIVO
```

Respostas: 201 `{"arquivoId":"...","projetoId":"...","nome":"roteiro.txt","categoria":"ROTEIRO"}`, depois 200 `{"arquivos":[...]}` e 200 com `"tamanhoBytes":22,"conteudoBase64":"RVhULiBQUkFJQSAtIEFNQU5IRUNFUg=="`.

**7. Ver e avaliar um profissional** (o `profissionalId` do diretor):

```bash
curl.exe http://localhost:3000/profissionais/ID_DO_PROFISSIONAL
curl.exe -X POST http://localhost:3000/profissionais/ID_DO_PROFISSIONAL/avaliacoes -H "content-type: application/json" --data-binary "@exemplos/gerados/avaliar-profissional.json"
```

Respostas: 200 com `id`, `nome`, `especialidades`, `precoMin`, `competencias`, `mediaAvaliacoes` e `totalAvaliacoes`, depois 201 `{"profissionalId":"...","autorId":"produtor-4","nota":5,"comentario":"Entregou antes do prazo"}`.

**8. Projeto com árvore de serviços em 3 níveis** (`servicoPrincipal`):

```bash
curl.exe -X POST http://localhost:3000/projetos/recomendar -H "content-type: application/json" --data-binary "@exemplos/gerados/projeto-servicos.json"
```

Resposta 201 com `"custoTotal":27500,"prazoTotalDias":28`, os papéis `DIRETOR`, `EDITOR` e `SONOPLASTA` derivados das folhas e um membro por serviço atômico na `equipe`.

**9. Animação e alteração do projeto** (orçamento de 90000 para 135000):

```bash
curl.exe -X POST http://localhost:3000/projetos/recomendar -H "content-type: application/json" --data-binary "@exemplos/gerados/animacao.json"
curl.exe -X PATCH http://localhost:3000/projetos/ID_DO_PROJETO_DA_ANIMACAO -H "content-type: application/json" --data-binary "@exemplos/gerados/alterar-projeto.json"
```

O relatório da animação traz `relatorio.metricasRenderizacao`. O PATCH responde 200 com `"reavaliada":true` e uma recomendação nova. Em projeto com equipe finalizada, como o documentário, responde 409.

**10. Projeto-modelo:**

```bash
curl.exe http://localhost:3000/projetos/modelos
curl.exe -X POST http://localhost:3000/projetos/recomendar -H "content-type: application/json" --data-binary "@exemplos/gerados/modelo-publicitario.json"
```

Respostas: `{"modelos":["ficcao","documentario","animacao","publicitario"]}` e depois 201 com um projeto `PUBLICITARIO`.

**11. Substituir ou rejeitar uma sugestão** (numa recomendação em andamento, como a `recomendacao.id` devolvida pelo PATCH do item 9):

```bash
curl.exe -X POST http://localhost:3000/recomendacoes/ID_DA_RECOMENDACAO/membros/DIRETOR/substituir
curl.exe -X POST http://localhost:3000/recomendacoes/ID_DA_RECOMENDACAO/membros/DIRETOR/rejeitar
```

## Trocar provedores e decoradores

Basta mudar as variáveis e reiniciar o servidor; o código de negócio não muda. No `.env` ou no terminal:

```powershell
$env:ARMAZENAMENTO='s3'; $env:PAGAMENTO='paypal'; $env:PROFISSIONAIS='linkedin'; npm start
```

```bash
ARMAZENAMENTO=s3 PAGAMENTO=paypal PROFISSIONAIS=linkedin npm start
```

Com PayPal, o `pagamentoId` começa com `PAYID-`; com PagSeguro, com `CHAR_`; com Stripe, com `pi_`. No PowerShell, `Remove-Item Env:ARMAZENAMENTO, Env:PAGAMENTO, Env:PROFISSIONAIS` volta aos valores do `.env`.

Os decoradores seguem a mesma ideia: `DECORADORES=cache,auditoria,compressao` (a auditoria aparece no log como `"msg":"recomendação auditada"`), `DECORADORES=` para nenhum e `DECORADORES_POR_PRODUTOR={"produtor-1":["auditoria"]}` para uma pilha própria por produtor. As respostas da API são as mesmas com qualquer pilha. Em código, `PoliticaDeDecoradores.definirPilhaPadrao(...)` e `definirPilha(produtorId, ...)` trocam a pilha com o servidor rodando.

## Organização do código

```
src/
├── server.ts               Entrada: configuração, app e encerramento
├── app.ts                  Fastify: rotas, formato de erro, 404
├── composicao/             Raiz de composição, provedores, decoradores e leitura do ambiente
├── adaptadores/            Adapter: armazenamento/, pagamento/ e profissional/ (interfaces, adaptadores e simulados)
├── servicos-projeto/       Composite: ServicoProjeto, ServicoAtomico, PacoteServico e visitantes da árvore
├── domain/                 Entidades, portas e erros de domínio
├── services/               SistemaRecomendacao (fachada) e colaboradores
├── orchestration/          Template Method
├── strategies/             Strategy e decoradores/ (Decorator)
├── factories/              Abstract Factory e Factory Method, uma pasta por tipo
├── prototypes/             Prototype
├── visitors/               Visitor
├── events/                 Observer
├── repositories/           Prisma
└── routes/                 Rotas, schemas e serializadores
tests/                      unit/, integration/ e support/
prisma/                     schema, migrations e seed
exemplos/                   Modelos JSON e o gerador (gerados/ fica fora do Git)
docs/                       ATVII.md e ATVIII.md
```

## Compatibilidade e CI

Compatível com **Windows 10 ou superior** e **Ubuntu 24.04.03 ou superior** e derivadas. Os scripts npm não usam sintaxe de shell, os caminhos são montados pelo Node, o fim de linha é fixado em LF e os provedores simulados não gravam em disco. O GitHub Actions (`.github/workflows/ci.yml`) roda `npm ci`, `prisma generate`, `tsc --noEmit`, `build` e `npm test` em `ubuntu-24.04` e `windows-latest` com Node 24.

## Solução de problemas

### Não conecta ao banco
`P1001`/`ECONNREFUSED`: inicie o PostgreSQL (`Start-Service postgresql-x64-18` no PowerShell como administrador; `sudo systemctl start postgresql` no Ubuntu) e confira host e porta da `DATABASE_URL`.

### DATABASE_URL não definida mesmo com o .env
O `.env` foi salvo como "UTF-8 com BOM". Salve de novo como UTF-8 sem BOM (no Bloco de Notas, **Salvar como** → Codificação **UTF-8**).

### Usuário ou senha inválidos
`P1000`: corrija a `DATABASE_URL` no `.env` e codifique os caracteres especiais (`@` → `%40`). No Ubuntu, `Peer authentication failed`: `sudo -u postgres psql -c "ALTER USER postgres PASSWORD 'sua-senha';"`.

### DATABASE_URL não definida
`Configuração inválida: DATABASE_URL não está definida`: crie o `.env` (passo 3).

### Variável de ambiente inválida
O processo encerra listando cada problema, ex.: `PAGAMENTO="pix" é inválida: use um destes valores: stripe, pagseguro, paypal` ou `DECORADORES="cache,cache" é inválida`. Corrija conforme a [tabela](#variáveis-de-ambiente). No PowerShell, `Remove-Item Env:NOME` apaga uma variável definida por engano; no bash, `unset NOME`.

### psql não é reconhecido (Windows)
O instalador não põe o `psql` no `PATH`. Use `& "C:\Program Files\PostgreSQL\18\bin\psql.exe" --version`. O projeto não precisa do `psql`: o `prisma migrate deploy` cria o banco.

### Porta em uso
`EADDRINUSE`: troque `PORT` no `.env` (ex.: `3001`) ou encerre o outro processo.

### Erro 422 "A data de entrega do projeto já passou"
Rode `npm run exemplos` de novo e use os arquivos de `exemplos/gerados/`.

### Prisma: EPERM ou falha no postinstall
`EPERM ... query_engine-windows.dll.node`: pare o servidor (Ctrl+C) e rode `npx prisma generate`. Sem internet, o engine do Prisma não é baixado: confira a conexão ou o `HTTPS_PROXY`.

### Node abaixo da versão 24
`EBADENGINE`: instale o Node 24, apague `node_modules` e rode `npm ci`.

### npm start sem build
`Cannot find module ... dist/server.js`: rode `npm run build` antes.

### npx jest falha com "Must use import to load ES Module"
Use `npm test`, que passa `--experimental-vm-modules`. Para argumentos extras, use `npm test -- --randomize`.

### curl não funciona no PowerShell
Use `curl.exe` e envie o corpo como arquivo (`--data-binary "@exemplos/gerados/arquivo.json"`).

### Pagamento responde 409
Só membro com convite aceito (`CONFIRMADO`) pode ser pago. Faça os passos 2 e 3 antes.

### Arquivo ou pagamento sumiu
Os provedores são simulados em memória e são esvaziados quando o servidor reinicia.

## Documentação técnica

[docs/ATVIII.md](docs/ATVIII.md) traz o mapa diagrama → código, as decisões e a análise de anti-padrões da ATVIII. [docs/ATVII.md](docs/ATVII.md) cobre os padrões anteriores.
