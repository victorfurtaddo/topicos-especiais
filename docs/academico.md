# FinScope — Plataforma de Inteligência Financeira Pessoal

**Disciplina:** Tópicos Especiais  
**Integrante 1:** [preencher]  
**Integrante 2:** [preencher]  
**Repositório GitHub:** https://github.com/victorfurtaddo/topicos-especiais

## 1. Ideia e finalidade

O FinScope organiza receitas e despesas pessoais e transforma esses registros em informações verificáveis. A aplicação permite acompanhar totais mensais, compreender a distribuição dos gastos, identificar variações e padrões de pagamento e simular reduções de consumo. É um sistema local de uso individual, sem autenticação ou integrações bancárias.

O backend Flask recebe requisições, valida as entradas e acessa o MongoDB por PyMongo. Templates Jinja2 geram as páginas; Chart.js apresenta agregações já calculadas pelo banco. Não há processamento integral da coleção no navegador ou em Python para substituir as consultas analíticas.

## 2. Coleção `transactions`

A única coleção contém os seguintes campos. O CRUD mantém 12 campos de negócio obrigatórios, além do `_id` gerado pelo MongoDB. `seed_key` aparece somente na demonstração.

| Campo | Tipo BSON | Finalidade / validação |
|---|---|---|
| `_id` | ObjectId | Identificador gerado pelo banco |
| `description` | String | Descrição não vazia, até 160 caracteres |
| `amount` | Decimal128 | Valor positivo, até 999999999.99, duas casas decimais |
| `type` | String | `income` ou `expense` |
| `category` | String | Categoria permitida pela aplicação |
| `date` | Date | Data financeira em UTC, interpretada no fuso de São Paulo |
| `payment_method` | String | `pix`, `credit_card`, `debit_card`, `cash`, `transfer` |
| `is_recurring` | Boolean | Marcação manual, não determina o detector de padrões |
| `installments` | Int32 | Número de parcelas de 1 a 60, informativo |
| `tags` | Array de strings | Até 10 tags únicas, de até 30 caracteres |
| `merchant` | Object | Nome e cidade do estabelecimento |
| `merchant.name` | String | Até 100 caracteres; pode ser vazio |
| `merchant.city` | String | Até 80 caracteres; pode ser vazio |
| `notes` | String | Observações de até 1000 caracteres |
| `created_at` | Date | Instante de criação, preservado ao editar |
| `seed_key` | String opcional | Chave única dos dados sintéticos para seed idempotente |

Categorias: Alimentação, Moradia, Transporte, Saúde, Educação, Lazer, Compras, Assinaturas, Salário, Freelance e Outros. Qualquer categoria pode ser usada no simulador; oportunidades sugeridas são restritas a Alimentação, Transporte, Lazer e Compras.

### Exemplo de documento (Extended JSON)

```json
{
  "_id": {"$oid": "65593c000000000000000001"},
  "description": "Supermercado",
  "amount": {"$numberDecimal": "185.90"},
  "type": "expense",
  "category": "Alimentação",
  "date": {"$date": "2026-11-18T03:00:00Z"},
  "payment_method": "credit_card",
  "is_recurring": false,
  "installments": 1,
  "tags": ["mercado", "essencial"],
  "merchant": {"name": "Supermercado Central", "city": "Itapetininga"},
  "notes": "Compra semanal",
  "created_at": {"$date": "2026-11-18T14:30:00Z"}
}
```

O ObjectId acima é meramente ilustrativo. A entrada HTTP não recebe `_id` nem `created_at`; valores são strings decimais e datas são `AAAA-MM-DD`. A aplicação converte para BSON. Meia-noite de 18/11/2026 em São Paulo corresponde a 03:00 UTC.

### Índices

- `{date: -1}`: período e ordenação temporal.
- `{type: 1, category: 1, date: 1}`: seleção de tipo/categoria/período.
- `{seed_key: 1}`, único e esparso: idempotência sem exigir chave nos documentos pessoais.

A busca por substring usa regex literal escapada e não é otimizada por esses índices. É uma escolha simples adequada ao volume acadêmico. Validação é realizada em todos os endpoints de escrita; importações manuais diretas no banco devem respeitar o esquema.

## 3. CRUD e segurança

Cadastro e edição constroem um documento a partir de campos permitidos. Identificadores são validados antes da consulta. Campos fornecidos como objetos no lugar de textos/números são rejeitados, impedindo a introdução de operadores MongoDB. Expressões regulares de pesquisa são escapadas. Jinja2 escapa textos apresentados em HTML; os gráficos recebem JSON serializado.

Mutações exigem token CSRF associado à sessão. Exclusões têm confirmação no navegador e parâmetro explícito no servidor. Configurações ficam em ambiente, não há credenciais no código e o servidor inicia em loopback. Erros de banco produzem resposta 503 e não dados fictícios disfarçados de resultados reais.

## 4. Consultas analíticas

Os pipelines completos, extraídos das funções usadas pela aplicação, estão em `docs/consultas.mongodb.js`, prontos para execução com `mongosh`. O exemplo fixa novembro de 2026 para ser reproduzível; o seed usa o mês de execução. Ajuste o mês do exemplo ou execute o seed em uma base de demonstração com datas correspondentes.

### Consulta 1 — Evolução financeira mensal

Filtra o período com `$match`; `$dateToString` identifica o mês em America/Sao_Paulo; `$group` por mês e tipo soma `amount` com `$sum`. `$project` remove o identificador composto e retorna somente mês, tipo e total; `$sort` ordena cronologicamente.

**Uso visível:** gráfico de seis meses e indicadores do dashboard. Python completa meses sem lançamentos com zero, sem recalcular agregações. Saldo = receitas − despesas; taxa de poupança = saldo ÷ receitas × 100. Sem receita, a taxa não é definida. Variação = (atual − anterior) ÷ anterior × 100; sem base anterior, não se inventa percentual.

### Consulta 2 — Distribuição por categoria

Seleciona despesas no período, agrupa por categoria com total e contagem e calcula o total geral em um segundo `$group`. `$push` mantém as categorias; `$unwind` volta a uma linha por categoria. `$divide` e `$multiply` calculam sua participação percentual no banco. `$project` limita a saída; `$sort` ordena pelo total.

**Uso visível:** gráfico de rosca, valores e percentuais, cartões de concentração ≥25% e comparação de categorias entre dois meses. Categorias que desapareceram do mês atual também aparecem na comparação com zero e queda de 100%.

### Consulta 3 — Despesas atípicas

Filtra os **seis meses completos anteriores** ao mês analisado. `$group` calcula `$avg` e tamanho da amostra por categoria. Categorias com menos de três transações são excluídas. O limite é **2 × média histórica**. `$lookup` consulta a própria coleção buscando despesas do mês analisado, da mesma categoria e estritamente maiores que esse limite. `$expr` compara campos com variáveis do agrupamento. `$unwind` e `$project` expõem descrição, data, valor, média, limite e tamanho da amostra.

**Uso visível:** cartões “Despesas fora do padrão”. Exemplo: histórico 100, 100 e 100; média 100, limite 200; uma despesa de 200 não é marcada, uma de 200,01 é. A observação em análise não participa da sua referência histórica.

**Limitações:** média é sensível a valores extremos; o limiar de duas vezes é uma heurística interpretável, não teste de significância ou diagnóstico de fraude. Não se apresenta uma probabilidade. Pouco histórico resulta em ausência de avaliação, não comprovação de normalidade.

### Consulta 4 — Padrões recorrentes

Considera seis meses incluindo o selecionado. `$trim` e `$toLower` normalizam o estabelecimento; se vazio, usa a descrição. Agrupa por identidade, categoria e dia local com `$dateTrunc`, evitando falsas repetições no mesmo dia. `$setWindowFields` ordena as datas por identidade/categoria e `$shift` encontra a data anterior. `$dateDiff` mede dias de calendário no fuso local.

Outro `$group` reúne número de dias, pagamentos, média do total diário, datas distintas (`$addToSet`), intervalos mínimo/máximo/médio e último pagamento. Exige pelo menos três dias distintos e **todos** os intervalos entre 5–9 dias (semanal) ou 25–35 dias (mensal). O primeiro intervalo nulo é desconsiderado pelos acumuladores.

**Uso visível:** tabela de recorrência com frequência, intervalos, valor médio, quantidade, datas e último pagamento. Não depende de `is_recurring`. Uma sequência com intervalos de 1 e 74 dias não é recorrente só porque possui três registros.

**Limitações:** tolerâncias não cobrem todos os calendários; pagamentos ausentes podem impedir detecção. Normalização remove espaços nas pontas e converte caixa; não faz correspondência aproximada, remoção de acentos ou correção de nomes. `$toLower` tem comportamento bem definido para ASCII; nomes internacionais podem exigir normalização adicional em uma versão futura. Padrão histórico não implica contrato ativo ou pagamento futuro garantido.

## 5. Simulador e oportunidades

Uma agregação `$match`/`$group` obtém o gasto real da categoria no mês. Para percentual p e duração n:

- Economia mensal = arredondar(base × p ÷ 100, 2 casas, HALF_UP).
- Cenário mensal reduzido = base − economia mensal.
- Economia acumulada = economia mensal × n.
- Despesa acumulada atual = base × n; reduzida = cenário reduzido × n.

Exemplo: R$ 600 em Lazer, 15% de redução e 12 meses resultam em R$ 90/mês, R$ 1.080 acumulados, cenário atual de R$ 7.200 e reduzido de R$ 6.120. É hipótese sem juros, inflação ou garantia. O período aceita 1–120 meses e a redução 0–100%. Sem gastos na categoria, todos os valores são zero e a interface informa a ausência de base.

## 6. Base inicial e testes

Seed: 108 documentos, 18 por mês durante seis meses. Inclui receitas, múltiplas categorias, estabelecimentos, recorrências, variações e compra excepcional. Uma chave única esparsa impede duplicação. Os comandos de limpeza/substituição pedem confirmação textual e excluem somente registros marcados como sintéticos; documentos pessoais são preservados.

Os testes usam MongoDB real em bancos temporários com nomes únicos. Cobrem o ciclo CRUD, tipos BSON, precisão decimal, validação, segurança, limites de data/fuso, filtros, páginas, quatro pipelines, seed e simulador. Consulte `docs/validacao.md` para o resultado da execução nesta entrega.

## 7. Roteiro para o PDF

1. Preencher integrantes e link do repositório; apresentar ideia e stack.
2. Incluir a tabela dos campos e o exemplo Extended JSON.
3. Capturar o dashboard com receitas, despesas e gráficos.
4. Capturar cadastro, listagem com filtros e edição; demonstrar uma exclusão.
5. Copiar cada pipeline de `consultas.mongodb.js`, acompanhado da explicação e resultado.
6. Capturar insights, incluindo despesa atípica e recorrência com intervalos.
7. Capturar o simulador e mostrar uma verificação aritmética.
8. Incluir contagem da base (`db.transactions.countDocuments({})`) e resultados dos testes.

## Referências técnicas

- Flask: https://flask.palletsprojects.com/en/stable/tutorial/factory/
- MongoDB `$group`: https://www.mongodb.com/docs/manual/reference/operator/aggregation/group/
- MongoDB `$lookup`: https://www.mongodb.com/docs/manual/reference/operator/aggregation/lookup/
- MongoDB `$setWindowFields`: https://www.mongodb.com/docs/manual/reference/operator/aggregation/setWindowFields/
- MongoDB `$dateDiff`: https://www.mongodb.com/docs/manual/reference/operator/aggregation/dateDiff/
