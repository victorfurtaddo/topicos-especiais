"""Seed determinístico: 108 documentos em seis meses; nunca substitui sem confirmação."""
import argparse
import random
import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app import create_app
from config import TIMEZONE
from db import create_indexes, transactions
from services.validation import validate_transaction

SEED_PREFIX = 'finscope-demo-v1:'


def sample_documents(anchor=None):
    anchor = anchor or datetime.now(TIMEZONE)
    rng = random.Random(42)
    documents = []
    for offset in range(-5, 1):
        index = anchor.year * 12 + anchor.month - 1 + offset
        year, month = index // 12, index % 12 + 1
        entries = [
            ('Salário mensal', '5200.00', 'income', 'Salário', 'Empresa Exemplo', 5, True),
            ('Projeto freelance', str(650 + 50 * (offset + 5)), 'income', 'Freelance', 'Cliente Exemplo', 12, False),
            ('Aluguel', '1450.00', 'expense', 'Moradia', 'Imobiliária Central', 8, True),
            ('Internet fibra', '109.90', 'expense', 'Moradia', 'Conecta Internet', 10, True),
            ('Streaming', '39.90', 'expense', 'Assinaturas', 'Cinema em Casa', 15, True),
            ('Academia', '99.90', 'expense', 'Saúde', 'Academia Movimento', 10, True),
        ]
        for n in range(4):
            amount = rng.randint(15000, 23000) / 100
            if offset == 0:
                amount *= 1.25
            entries.append(('Supermercado', f'{amount:.2f}', 'expense', 'Alimentação', 'Mercado Central', 2 + n * 4, False))
        for n in range(3):
            entries.append(('Transporte por aplicativo', str(rng.randint(22, 48)), 'expense', 'Transporte', 'Mobilidade Urbana', 3 + n * 5, False))
        entries.extend([
            ('Jantar com amigos', str(140 + (offset + 5) * 15), 'expense', 'Lazer', 'Restaurante da Praça', 16, False),
            ('Cinema', '52.00', 'expense', 'Lazer', 'Cine Cidade', 11, False),
            ('Farmácia', str(rng.randint(45, 110)), 'expense', 'Saúde', 'Farmácia Vida', 6, False),
            ('Curso online', '89.90', 'expense', 'Educação', 'Escola Digital', 9, True),
            ('Compras pessoais' if offset else 'Compra excepcional', '1200.00' if offset == 0 else str(rng.randint(100, 160)), 'expense', 'Compras', 'Loja Centro', 17, False),
        ])
        for n, (description, amount, kind, category, merchant, day, recurring) in enumerate(entries):
            document = validate_transaction({
                'description': description, 'amount': amount, 'type': kind, 'category': category,
                'date': f'{year}-{month:02d}-{day:02d}', 'payment_method': 'pix',
                'is_recurring': recurring, 'installments': 1,
                'tags': ['demonstração', 'fixa' if recurring else 'variável'],
                'merchant': {'name': merchant, 'city': 'Itapetininga'}, 'notes': 'Registro sintético para demonstração.',
            })
            document.update(created_at=datetime.now(timezone.utc), seed_key=f'{SEED_PREFIX}{offset}:{n}')
            documents.append(document)
    return documents


def seed_collection(collection, anchor=None):
    inserted = 0
    for doc in sample_documents(anchor):
        inserted += int(collection.update_one({'seed_key': doc['seed_key']}, {'$setOnInsert': doc}, upsert=True).upserted_id is not None)
    return inserted


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--replace', action='store_true', help='Substituir somente os dados de demonstração.')
    parser.add_argument('--clear-demo', action='store_true', help='Excluir somente os dados de demonstração.')
    args = parser.parse_args()
    with create_app().app_context():
        create_indexes()
        collection = transactions()
        if args.replace or args.clear_demo:
            if input('Digite EXCLUIR DEMONSTRACAO para remover os registros sintéticos: ') != 'EXCLUIR DEMONSTRACAO':
                print('Cancelado. Nenhum registro foi alterado.')
                return
            result = collection.delete_many({'seed_key': {'$regex': '^' + SEED_PREFIX}})
            print(f'{result.deleted_count} registros sintéticos removidos.')
        if not args.clear_demo:
            print(f'{seed_collection(collection)} documentos inseridos; total: {collection.count_documents({})}.')


if __name__ == '__main__':
    main()
