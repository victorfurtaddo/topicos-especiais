"""Exporta os mesmos pipelines do aplicativo em formato executável no mongosh."""
import sys
from pathlib import Path
from bson import json_util

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from services.financial_analysis import month_bounds, shift_month, evolution_pipeline, category_pipeline, outlier_pipeline, recurring_pipeline

start, end = month_bounds('2026-11')
queries = [
    ('1 — Evolução financeira mensal', evolution_pipeline(shift_month(start, -5), end)),
    ('2 — Distribuição por categoria', category_pipeline(start, end)),
    ('3 — Despesas atípicas', outlier_pipeline(start, end)),
    ('4 — Padrões recorrentes', recurring_pipeline(shift_month(start, -5), end)),
]
output = ['// Gerado por python scripts/export_queries.py. Exemplo: novembro de 2026.',
          '// Execute: mongosh "mongodb://127.0.0.1:27017/finscope" docs/consultas.mongodb.js',
          '// EJSON.parse restaura BSON Date e tipos numéricos; não são strings na consulta.\n']
for title, pipeline in queries:
    encoded = json_util.dumps(pipeline, ensure_ascii=False, indent=2)
    output.append(f'// Consulta {title}\nprint("{title}");\nprintjson(db.transactions.aggregate(EJSON.parse(`{encoded}`)).toArray());\n')
Path(__file__).resolve().parents[1].joinpath('docs/consultas.mongodb.js').write_text('\n'.join(output), encoding='utf-8')
