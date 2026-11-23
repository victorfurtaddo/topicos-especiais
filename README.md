# topicos-especiais — FinScope

Aplicação local de inteligência financeira pessoal para a disciplina **Tópicos Especiais**. Transforma receitas e despesas em indicadores, comparações e cenários explicáveis, calculados com agregações reais do MongoDB.

## Funcionalidades

- Dashboard: receitas, despesas, saldo, taxa de poupança e comparação mensal; gráficos de seis meses e participação por categoria.
- CRUD completo, pesquisa literal por descrição, filtros de período/categoria/tipo e paginação.
- Insights: variação por categoria, concentração ≥25%, gastos atípicos e padrões semanais/mensais.
- Simulador: redução percentual sobre os gastos de uma categoria, projeção de 1 a 120 meses, sem juros.
- Seed de 108 documentos sintéticos em seis meses, idempotente e com exclusão isolada dos dados de demonstração.

## Tecnologias e decisões

Python 3.11+, Flask, PyMongo, MongoDB 5.0+, Jinja2, python-dotenv, HTML, CSS e JavaScript. Chart.js 4.5.1 incluído localmente, sob licença MIT.

Monólito pequeno: rotas recebem requisições, funções validam e analisam, PyMongo persiste/agrega e Jinja2 apresenta. Sem autenticação, múltiplos usuários, Docker, ORM ou serviços externos. CSS próprio foi escolhido no lugar de Tailwind para eliminar uma etapa de build e manter execução offline. Chart.js é a única biblioteca JavaScript.

## Execução local

### Atalho no computador deste projeto

No Linux, dentro de `finscope`, execute `./iniciar.sh`. Esse comando usa o
ambiente virtual do projeto, inicia o MongoDB se necessário e abre o Flask.
Mantenha o terminal aberto enquanto usa a aplicação. Para parar o Flask, use
Ctrl+C. Depois de reiniciar o computador, execute o mesmo comando novamente.

O MongoDB local está em `.local-mongodb/`, com dados persistentes em `.local-mongo/`.
Depois de reiniciar o computador, dentro de `finscope`, execute:

```bash
source .venv/bin/activate
python scripts/start_mongo.py
python app.py
```

O script verifica se o banco já está ativo antes de iniciá-lo. Essas duas pastas
são locais e não devem ser enviadas ao GitHub. Em outro computador, instale o
MongoDB conforme abaixo; o script também aceita `mongod` instalado no PATH.

### 1. MongoDB

Instale e inicie o **MongoDB Community Server** conforme seu sistema operacional: [instruções oficiais](https://www.mongodb.com/docs/manual/administration/install-community/). Use uma instância local escutando em `127.0.0.1:27017`. MongoDB ≥5.0 é necessário para `$setWindowFields`, `$dateTrunc` e `$dateDiff`; os testes foram executados com MongoDB 8.0.17.

Com o binário `mongod` disponível, uma alternativa sem serviço de sistema é:

```bash
mkdir -p .local-mongo
mongod --dbpath .local-mongo --bind_ip 127.0.0.1 --port 27017
```

Mantenha esse terminal aberto. O banco é persistido no diretório escolhido, não no processo Flask. Não adicione os arquivos do banco ao Git.

### 2. Ambiente Python

Em outro terminal, dentro da pasta `finscope`:

```bash
python3 -m venv .venv
source .venv/bin/activate
# Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
python -c "import secrets; print(secrets.token_hex(32))"
```

Copie a chave gerada para `SECRET_KEY` em `.env`:

```dotenv
MONGO_URI=mongodb://127.0.0.1:27017
MONGO_DB=finscope
SECRET_KEY=sua-chave-gerada-localmente
```

Sem chave configurada, o processo gera uma chave temporária; reiniciar a aplicação invalida as sessões/formulários abertos. `.env` é ignorado pelo Git. Não publique credenciais.

### 3. Índices e dados

```bash
flask --app app:create_app init-db
python scripts/seed.py
```

O seed cria os índices também e insere **108 documentos** nos seis meses encerrados no mês local da execução. Executá-lo novamente não duplica nem move registros anteriores. Em outro mês, use `--replace` se quiser reconstruir a demonstração com datas atualizadas.

```bash
python scripts/seed.py --clear-demo   # remove somente dados sintéticos
python scripts/seed.py --replace      # remove e recria somente dados sintéticos
```

Ambos exigem digitar **EXCLUIR DEMONSTRACAO**. Registros pessoais são preservados. O identificador opcional `seed_key` marca a origem sintética; editar um registro sintético não altera sua origem. Para usar seus próprios dados, limpe a demonstração e cadastre novas transações. Os identificadores `_id` são gerados pelo MongoDB.

### 4. Aplicação

```bash
python app.py
```

Abra **http://127.0.0.1:5000**. O servidor fica restrito à interface local e inicia sem debug. Todas as operações usam o MongoDB; indisponibilidade do banco retorna uma página de erro 503, sem dados simulados como fallback.

## Uso

1. Escolha um mês no dashboard; seus indicadores e gráficos vêm dos registros armazenados.
2. Em **Transações**, cadastre receitas/despesas; use Editar ou Excluir (com confirmação).
3. Em **Insights**, consulte os valores da comparação e os critérios de cada análise.
4. No **Simulador**, selecione mês, categoria, percentual e período. É uma hipótese de redução, não uma promessa.

Datas de formulário usam `AAAA-MM-DD`; visualmente são exibidas em formato brasileiro. A aplicação interpreta o dia à meia-noite de **America/Sao_Paulo**, armazena BSON Date em UTC e agrega no fuso local. O navegador pode apresentar controles de data conforme o idioma do sistema. `created_at` registra o instante de criação.

Valores positivos, de R$ 0,01 a R$ 999.999.999,99, com até duas casas decimais, são gravados como **Decimal128**. Receitas/despesas são distinguidas por `type`. O JSON da API usa strings para valores decimais; apenas os dados enviados ao Chart.js são convertidos para números de exibição.

`installments` é informativo: o valor informado entra integralmente na data registrada. `is_recurring` não cria transações automaticamente. Indicadores usam o mês completo, inclusive registros futuros nele; um mês em andamento pode ter menos lançamentos que o anterior. Saldo é mensal, não um saldo bancário acumulado. A taxa de poupança pode ser negativa; sem receita, fica indefinida.

## As quatro consultas

| Consulta | Cálculo no MongoDB | Funcionalidade |
|---|---|---|
| Evolução mensal | `$match`, `$group`, `$dateToString`, `$sum`, `$project`, `$sort` | Dashboard e indicadores |
| Distribuição por categoria | `$group`, `$push`, `$unwind`, `$divide`, `$multiply`, `$project` | Gráfico e concentração; variações entre períodos |
| Despesas atípicas | Média histórica por categoria, mínimo de 3 registros, `$lookup` na mesma coleção e `$expr` para valores >2× média | Insights: fora do padrão |
| Padrões recorrentes | Normalização, agrupamento diário, `$setWindowFields`/`$shift`, `$dateDiff`, `$addToSet`, limites dos intervalos | Insights: pagamentos recorrentes |

Fontes executáveis: `services/financial_analysis.py`. Os pipelines completos para `mongosh` estão em [docs/consultas.mongodb.js](docs/consultas.mongodb.js). A explicação detalhada está em [docs/academico.md](docs/academico.md).

## Estrutura

```text
finscope/
├── app.py                     # aplicação, CSRF e tratamento de erros
├── config.py                  # ambiente, categorias e fuso
├── db.py                      # conexão e índices
├── requirements*.txt
├── routes/                    # transações, páginas analíticas e API
├── services/                  # validação, formatação e pipelines
├── templates/                 # páginas Jinja2
├── static/{css,js,vendor}/     # interface e Chart.js local
├── scripts/seed.py
├── tests/                     # integração com MongoDB real
└── docs/                      # material para o PDF acadêmico
```

## Testes

Com MongoDB ativo:

```bash
pip install -r requirements-dev.txt
python -m pytest -q
```

Para outra instância, configure `TEST_MONGO_URI`. Cada teste cria um banco `finscope_test_<uuid>` e remove **apenas esse banco** ao terminar; `MONGO_DB` não é usado para testes. Os testes falham claramente se o MongoDB não estiver disponível; não usam mocks que poderiam ocultar incompatibilidades dos pipelines.

São cobertos CRUD/API/formulários, persistência, CSRF, entradas inválidas/injeção, escape HTML, pesquisa literal, filtros, precisão Decimal128, limites de mês, as quatro agregações, simulador, seed idempotente e páginas vazias/preenchidas.

## API

- `GET /api/csrf`: inicia a sessão e retorna `csrf_token`.
- `GET /api/transactions`: filtros `q`, `start`, `end`, `category`, `type`, `page`; 20 itens/página.
- `POST /api/transactions`: cria; `GET/PUT /api/transactions/<id>`: consulta/substitui campos editáveis.
- `DELETE /api/transactions/<id>?confirm=yes`: exclui com confirmação explícita.
- `GET /api/analytics?month=2026-11` e `/api/insights?month=2026-11`.
- `GET /api/simulation?month=2026-11&category=Lazer&percent=15&months=12`.

Mutações exigem cookie da sessão e cabeçalho `X-CSRF-Token` (ou campo `csrf_token` em formulário). Exemplo de corpo está em [docs/transaction-input.json](docs/transaction-input.json). Respostas: 201 criação, 200 leitura/edição, 204 exclusão, 400 validação/CSRF, 404 registro inexistente, 503 banco indisponível. Dados não são concatenados em consultas: valores são validados e chaves MongoDB são construídas pelo servidor; a pesquisa escapa metacaracteres de regex.

## Publicação no GitHub e entrega acadêmica

O projeto está preparado para criar um repositório a partir desta pasta. Revise os arquivos e confirme que `.env`, `.venv` e arquivos de banco estão ignorados antes de seu primeiro commit. Repositório: https://github.com/victorfurtaddo/topicos-especiais

Preencha integrantes e URL do repositório no [material acadêmico](docs/academico.md), inclua capturas das páginas conforme o roteiro e exporte o documento final para PDF.
