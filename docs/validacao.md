# Relatório de validação

Data: **18/11/2026**, fuso America/Sao_Paulo.

## Ambiente utilizado

- Python 3.14.10; Flask 3.1.3; PyMongo 4.20.0; pytest 9.2.0.
- MongoDB Community 8.0.17 real, em loopback, sem Docker.
- Instância temporária de desenvolvimento em `/tmp/finscope-mongo-data`, porta 27017.
- Executável usado nesta sessão: `/tmp/finscope-mongo-bin/bin/mongod`.
- O banco de demonstração `finscope` foi populado com **108 documentos**.
- Os testes criaram e removeram somente bancos com prefixo `finscope_test_` e identificadores únicos.

## Resultados

```text
python -m pytest -q
35 passed in 2.04s
```

- CRUD com persistência e leitura após criação/edição/exclusão: aprovado.
- Formulários, filtros, paginação básica e escape HTML: aprovado.
- CSRF, tipos inválidos, operadores injetados e valores monetários inválidos: aprovado.
- Evolução mensal, precisão decimal e limite de mês no fuso de São Paulo: aprovado.
- Distribuição por categoria e soma de percentuais: aprovado.
- Atípicos com histórico isolado e limite estrito: aprovado.
- Recorrência mensal/semanal e rejeição de intervalos irregulares/mesmo dia: aprovado.
- Simulação, validação de parâmetros e comparação mensal: aprovado.
- Seed repetível, 108 inserções e preservação de dados pessoais: aprovado.
- Páginas vazias e preenchidas renderizadas pelo cliente Flask: aprovado.
- Compilação dos módulos Python e sintaxe dos dois scripts JavaScript: aprovado.
- Servidor Flask em `http://127.0.0.1:5000/`: resposta HTTP **200** confirmada.

## Limite de verificação

O host de acesso ao navegador estava indisponível. Portanto, não foi possível executar inspeção visual, interação manual com gráficos, captura de telas ou validação visual em viewport móvel. O layout contém regras responsivas e os gráficos estão conectados às agregações, mas a revisão visual deve ser feita no navegador local.

## Reproduzir no computador

A instância baixada em `/tmp` é temporária e não equivale a uma instalação permanente do MongoDB. Siga o README para instalar/iniciar sua instância local e executar novamente o seed e os testes. O código-fonte, a biblioteca de gráficos e os documentos estão na pasta do projeto; `.venv` e arquivos locais não são destinados ao GitHub.
