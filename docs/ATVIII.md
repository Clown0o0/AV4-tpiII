# ATVIII — Adapter, Composite e Decorator

A ATVIII acrescenta três padrões estruturais ao microsserviço da ATVII sem mudar o comportamento dos padrões anteriores (Strategy, Template Method, Observer, Visitor, Prototype, Factory Method e Abstract Factory). Os testes desses padrões continuam passando sem alteração de expectativa, inclusive com a pilha padrão de decoradores (`cache,auditoria`) ligada.

## Diagrama -> código

### Adapter (`src/adaptadores/`)

| Diagrama | Código |
|---|---|
| `AdaptadorArmazenamento` (`salvarArquivo`, `recuperarArquivo`, `listarArquivos`) | `armazenamento/AdaptadorArmazenamento.ts`, mesmos nomes e ordem de parâmetros |
| `AdaptadorPagamento` (`efetuarPagamento`, `cancelarPagamento`, `verificarPagamento`) | `pagamento/AdaptadorPagamento.ts` |
| `AdaptadorProfissional` (`listarProfissionais`, `detalharProfissional`, `registrarAvaliacao`) | `profissional/AdaptadorProfissional.ts` |
| `AdaptadorS3`, `AdaptadorGoogleCloud`, `AdaptadorLocal` | `armazenamento/`; adaptam `S3Simulado` (`putObject`/`getObject`/`listObjectsV2`, bytes), `GoogleCloudStorageSimulado` (`gravar`/`ler`/`listar`, base64) e `ArmazenamentoExterno` (`File`) |
| `AdaptadorStripe`, `AdaptadorPagSeguro`, `AdaptadorPayPal` | `pagamento/`; adaptam `StripeSimulado` (`paymentIntents`, centavos), `PagSeguroSimulado` (`cobranca`, reais) e `PayPalSimulado` (`orders`, valor em texto) |
| `AdaptadorLinkedIn`, `AdaptadorIndeed`, `AdaptadorInterno` | `profissional/`; adaptam `LinkedInSimulado` (URN, proficiência 0–100), `IndeedSimulado` (habilidades 0–10, notas 2–10) e o `ProfissionalRepository` do Prisma |
| `ArmazenamentoExterno` (`upload(File)`, `download`, `listar`) | `armazenamento/ArmazenamentoExterno.ts`, usado pelo `AdaptadorLocal` |
| `GatewayPagamento` (`processarPagamento`, `estornarPagamento`, `consultarStatus`) e `Transacao` | `pagamento/GatewayPagamento.ts` e `Transacao.ts`: o livro-caixa em memória que os três simuladores de pagamento usam por composição |
| `ApiProfissionalExterna` (`buscarProfissionais`, `obterPerfil`, `avaliarProfissional`) | `profissional/ApiProfissionalExterna.ts`: o motor que o LinkedIn e o Indeed simulados usam por composição |
| `SistemaRecomendacao` (`adaptadorArmazenamento`, `adaptadorPagamento`, `adaptadorProfissional`, `estrategiaAtual`; `executarRecomendacao`, `definirEstrategia`, `configurarAdaptadores`) | `src/services/SistemaRecomendacao.ts`, com os mesmos atributos privados e métodos. Recebe os três adaptadores no construtor e só conhece as interfaces |
| `Equipe` | `export type Equipe = Recomendacao` (`src/domain/entities/Recomendacao.ts`) |

**Diferenças deliberadas:** `any` virou tipo explícito (`MetadadosArquivo`, `CriteriosBusca`, `AvaliacaoProfissional`, `DadosTransacao`), e as operações de I/O devolvem `Promise<T>` em vez de `T`. Os nomes e a ordem dos parâmetros seguem o diagrama.

### Composite (`src/servicos-projeto/`)

| Diagrama / enunciado | Código |
|---|---|
| `ServicoProjeto` (`calcularCusto`, `listarSubservicos`, `obterPrazo`, `validar`) | `ServicoProjeto.ts`, exatamente esses 4 métodos. Também é `Elemento<VisitanteDeServicos>` (`aceitar`) |
| `ServicoAtomico` (custo, prazo, papel técnico) | `ServicoAtomico.ts`, com `peso` e `competenciasDesejadas` opcionais |
| `PacoteServico` (lista de `ServicoProjeto`) | `PacoteServico.ts`, em qualquer profundidade |
| `Projeto.servicoPrincipal` e `calcularCustoTotal()` | `src/domain/entities/Projeto.ts`: guarda só a árvore. `calcularCustoTotal()` delega ao `servicoPrincipal`, e `papeis` é derivado das folhas |
| Percorrer a árvore com a mesma interface | `ColetorDeServicosAtomicos` (folhas, validação estrutural) e `TransformadorDeServicos` (cópia profunda em `clonarServico`, JSON em `servicoParaJson`), ambos visitantes, sem `instanceof` nem `switch` |

### Decorator (`src/strategies/decoradores/`)

| Enunciado | Código |
|---|---|
| `RecomendacaoStrategy` inalterada | `src/strategies/RecomendacaoStrategy.ts` (sem mudança) |
| `RecomendadorBase` | `RecomendadorBase.ts`: componente concreto que delega à estratégia escolhida e mantém `tipo` e `descricao` dela |
| `CacheDecorator`, `AuditoriaDecorator`, `CompressaoDecorator` | Todos estendem `DecoradorDeRecomendacao` (implementa `RecomendacaoStrategy`) e recebem a estratégia interna no construtor |
| Combinação em qualquer ordem | `MontadorDePilhaDeDecoradores.montar(estrategia, nomes)`: o primeiro nome fica mais perto da base. `cache,auditoria,compressao` = `Compressao(Auditoria(Cache(RecomendadorBase)))` |
| Configuração dinâmica | `PoliticaDeDecoradores` (pilha padrão e por produtor, `definirPilhaPadrao`/`definirPilha`), consultada a cada recomendação pelo `RecomendadorConfiguravel`. Por ambiente: `DECORADORES` e `DECORADORES_POR_PRODUTOR` |

## Decisões

- **D1 — Sistemas simulados.** Cada provedor tem formato próprio e mantém o estado em memória, sem disco, para funcionar igual no Windows e no Linux. Arquivos e pagamentos simulados somem quando o servidor reinicia.
- **D2 — Cadastro dos simuladores de profissionais.** O LinkedIn e o Indeed simulados leem o cadastro interno e o devolvem no próprio formato JSON. Os ids precisam ser os do cadastro, porque `MembroRecomendado` guarda o `profissionalId` (até a ATVIII era chave estrangeira; na ATVIV, com um banco por serviço, ficou só o id). Na ATVIV, a escolha do provedor passou para o serviço de profissionais. A avaliação enviada a eles só leva a nota (contrato `avaliarProfissional(id, nota)` do diagrama).
- **D3 — Fonte da recomendação.** `FonteProfissionaisResiliente` lê do `AdaptadorProfissional`, mantendo cache/TTL, timeout, fallback e recomposição. `configurarAdaptadores` troca as três referências de uma vez. A troca de origem invalida o catálogo e descarta uma carga da origem antiga que ainda esteja em andamento.
- **D4 — Arquivos.** O id é a chave `projetos/<projetoId>/<arquivoId>/<categoria>/<nome>`, e o prefixo de `listarArquivos` sai do id do projeto. Como a interface só devolve `Buffer`, os metadados são lidos da chave. Limites: 512 KiB e nome sem barras (422).
- **D5 — Pagamento.** O valor é o preço mínimo atual do profissional, a origem é o `produtorId` e o destino é o id do profissional. Só se paga membro `CONFIRMADO` (senão 409). Status padronizado: `APROVADO`/`CANCELADO`. Cancelar duas vezes dá 409.
- **D6 — `definirEstrategia`.** Troca a estratégia usada quando o produtor não informa nenhuma; a estratégia precisa existir no catálogo. O projeto continua guardando o tipo, que reavaliações e substituições resolvem pelo catálogo. Projetos-modelo mantêm a estratégia do modelo.
- **D7 — Regras do Composite.** Custo e prazo de um pacote são a soma dos filhos (execução sequencial, dias inteiros). Atômico: custo ≥ 0, prazo inteiro ≥ 1, papel válido, peso > 0 (padrão 1). Cada papel aparece uma vez na árvore. Pacote precisa de nome e ao menos um serviço. A mesma instância não pode se repetir (ciclo/duplicata), e a profundidade máxima é 10. Tudo gera `ErroValidacao` (422).
- **D8 — Entrada HTTP.** `papeis` continua aceito e vira um pacote com um atômico por papel (custo 0, prazo 1). Enviar `papeis` e `servicoPrincipal` juntos dá 422. O schema do Fastify confere o topo da árvore; o resto é validado no domínio, que para de ler além da profundidade máxima.
- **D9 — Avisos.** Custo acima do orçamento e prazo que não cabe até a entrega não bloqueiam: aparecem em `relatorio.servicos.avisos`. A disponibilidade por serviço considera a janela da criação da recomendação até a entrega.
- **D10 — Persistência.** Migration aditiva `20261101000000_servicos_do_projeto` (`servicoPrincipal JSONB NULL`). `ProjetoPapel` continua gravada, derivada da árvore. Projetos sem a coluna preenchida carregam por `ProjetoPapel`.
- **D11 — Onde a pilha de decoradores entra.** A pilha envolve o recomendador que a fábrica produz (`CatalogoDeFabricasDecoradas` → `FabricaComRecomendadorDecorado`), em vez do catálogo de estratégias. Assim o `RecomendadorPorTipo` e as classes de cada família de fábrica continuam iguais. A pilha é reaproveitada por fábrica, estratégia e lista de nomes, então o estado do cache sobrevive entre requisições.
- **D12 — Cache.** A chave é o hash SHA-256 de estratégia, papel, perfil desejado, orçamento do papel, produtor, tipo, gênero, localização, entrega, `detalhes` e da identidade dos candidatos e do universo. Profissionais são imutáveis, e uma recarga do catálogo gera objetos novos. Devolve cópias, tem TTL (60 s) e tamanho máximo (256, LRU) configuráveis e usa relógio injetável.
- **D13 — Auditoria e compressão.** A auditoria grava objetos com campos nomeados (`evento`, `estrategia`, `papel`, `projetoId`, `candidatos`, `devolvidos`, `duracaoMs`), só com ids: em memória por padrão, no logger do Fastify no servidor. A compressão zera `detalhes`, campos explicativos que não entram no ranking, na API nem no banco. Ordem e scores ficam iguais, e o JSON fica menor.
- **D14 — `DECORADORES` vazio.** Vazio significa nenhum decorador. É a única exceção à regra "variável vazia = ausente".
- **D15 — Comentários.** Removidos de código e configuração, menos `// submarino`. Na ATVIII, as migrations SQL já aplicadas mantinham os `--` gerados pelo Prisma; na ATVIV, cada serviço ganhou migrations novas, já sem comentários. O `@ts-expect-error` de um teste virou uma checagem de tipo equivalente.

## Anti-padrões

- **Blob/God Object:** o `SistemaRecomendacao` ficou em 261 linhas, e os métodos novos delegam a `GestorDeArquivos`, `GestorDePagamentos` e `GestorDeAvaliacoes`. Os tipos de contrato foram para `contratosDoSistema.ts`.
- **Herança profunda:** as classes novas têm no máximo um nível (decoradores sobre `DecoradorDeRecomendacao`). A cadeia `VisitanteBase` → `ValidacaoConsistenciaVisitor` → `ValidadorPapelObrigatorio` → `ValidadorDocumentario`/`ValidadorAnimacao` já existia na ATVII e foi mantida, porque é o Template Method da validação por tipo e os testes existentes afirmam essa hierarquia.
- **Singleton/estado global:** cache, auditoria, política e adaptadores são criados na raiz de composição e injetados.
- **Spaghetti/condicional por tipo:** nenhum `instanceof` ou `switch` por tipo de nó, provedor ou decorador. A escolha por nome usa mapas na raiz de composição (`src/composicao/provedores.ts` e `decoradores.ts`).
- **Fábricas:** nenhuma hierarquia nova de fábricas. A fábrica decorada implementa a mesma interface `FabricaProjeto`.

## Requisitos -> testes

| Requisito | Testes |
|---|---|
| Trocar provedores sem mudar a lógica (construtor e `configurarAdaptadores`, 3 provedores por interface) | `tests/integration/adaptadores.integration.test.ts` (`describe.each`), `tests/unit/adaptadores/*` |
| Rotas de arquivos, pagamentos e profissionais (200/201/400/404/409/422) | `tests/integration/adaptadores.routes.test.ts` |
| Custo e prazo em estruturas diferentes, validação recursiva, clone profundo, persistência, derivação de `papeis` | `tests/integration/composite.integration.test.ts`, `tests/unit/servicos-projeto/servicos.test.ts` |
| Cache reduz o tempo, auditoria registra tudo, compressão reduz o tamanho, ordens diferentes, pilha em execução, política por produtor | `tests/integration/decoradores.integration.test.ts`, `tests/unit/strategies/decoradores.test.ts` |
| Configuração por ambiente | `tests/unit/composicao/configuracao.test.ts` |

**Desempenho:** 100 requisições simultâneas, 10.000 profissionais, 5 execuções + 3 ondas.

| Versão | p95 |
|---|---|
| Base (ATVII) | ≈ 1,0 s (só filtragem colaborativa: ≈ 1,55 s) |
| ATVIII sem decoradores, com o padrão e com os três | entre 0,45 e 0,73 s |

Todas as respostas foram 201, sem fallback.
