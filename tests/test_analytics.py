from datetime import datetime, timezone
from decimal import Decimal
from bson import Decimal128
import pytest

from services import financial_analysis as analysis
from services.formatting import decimal
from services.validation import validate_transaction
from scripts.seed import seed_collection


def insert(collection, amount, date, category='Lazer', kind='expense', merchant='Cinema'):
    doc = validate_transaction({'description': 'Pagamento', 'amount': amount, 'date': date,
                                'category': category, 'type': kind, 'payment_method': 'pix',
                                'merchant': {'name': merchant}, 'tags': []})
    doc['created_at'] = datetime.now(timezone.utc)
    collection.insert_one(doc)


def test_evolution_decimal_and_local_month(collection):
    insert(collection, '0.10', '2026-11-01')
    insert(collection, '0.20', '2026-11-02')
    insert(collection, '1000', '2026-11-05', kind='income')
    insert(collection, '80', '2026-10-31')
    # 01:00 UTC Nov 1 is still October in São Paulo.
    collection.update_one({'amount': Decimal128('80.00')}, {'$set': {'date': datetime(2026, 11, 1, 1, tzinfo=timezone.utc)}})
    start, end = analysis.month_bounds('2026-11')
    result = analysis.aggregate(analysis.evolution_pipeline(start, end))
    assert {row['type']: decimal(row['total']) for row in result} == {'expense': Decimal('.30'), 'income': Decimal('1000')}
    data = analysis.dashboard('2026-11')
    assert data['previous']['expense'] == 80
    assert data['balance'] == Decimal('999.70')
    assert len(data['chart']['labels']) == 6


def test_category_percentages(collection):
    insert(collection, '75', '2026-11-10')
    insert(collection, '25', '2026-11-10', 'Transporte')
    insert(collection, '900', '2026-11-10', kind='income')
    rows = analysis.aggregate(analysis.category_pipeline(*analysis.month_bounds('2026-11')))
    assert [r['category'] for r in rows] == ['Lazer', 'Transporte']
    assert [decimal(r['percentage']) for r in rows] == [75, 25]
    assert sum(decimal(r['percentage']) for r in rows) == 100


def test_outliers_exclude_current_month_require_history_and_strict_threshold(collection):
    for day in [1, 10, 20]:
        insert(collection, '100', f'2026-10-{day:02d}')
    insert(collection, '200', '2026-11-02')
    insert(collection, '200.01', '2026-11-03')
    insert(collection, '999', '2026-11-04', 'Compras')
    insert(collection, '50000', '2025-10-01')  # outside historical window
    rows = analysis.aggregate(analysis.outlier_pipeline(*analysis.month_bounds('2026-11')))
    assert len(rows) == 1
    assert decimal(rows[0]['amount']) == Decimal('200.01')
    assert decimal(rows[0]['average']) == 100 and rows[0]['sample_size'] == 3


def test_recurring_intervals_normalization_and_false_positives(collection):
    for date in ['2026-09-10', '2026-10-10', '2026-11-10']:
        insert(collection, '100', date, merchant='  INTERNET  ' if '09' in date else 'Internet')
    for date in ['2026-10-01', '2026-10-08', '2026-10-15']:
        insert(collection, '20', date, merchant='Semanal')
    for date in ['2026-09-01', '2026-09-02', '2026-11-15']:
        insert(collection, '80', date, merchant='Irregular')
    for _ in range(3):
        insert(collection, '10', '2026-11-01', merchant='Mesmo dia')
    start, end = analysis.month_bounds('2026-11')
    rows = analysis.aggregate(analysis.recurring_pipeline(analysis.shift_month(start, -5), end))
    assert {r['merchant']: r['cadence'] for r in rows} == {'internet': 'Mensal', 'semanal': 'Semanal'}
    assert rows[0]['min_interval'] == 30 and rows[0]['max_interval'] == 31


def test_simulator_and_changes(collection):
    insert(collection, '600', '2026-11-12')
    insert(collection, '500', '2026-10-12')
    result = analysis.simulation({'month': '2026-11', 'category': 'Lazer', 'percent': '15', 'months': '12'})
    assert result['monthly_saving'] == 90 and result['accumulated'] == 1080
    assert result['reduced'] == 510 and result['reduced_total'] == 6120
    assert analysis.insights('2026-11')['changes'][0]['change'] == 20


@pytest.mark.parametrize('query', ['percent=101', 'percent=NaN', 'percent=0.001', 'months=0', 'months=1.5', 'month=bad'])
def test_simulator_validation(client, query):
    assert client.get('/api/simulation?category=Lazer&' + query).status_code == 400


def test_seed_idempotence_personal_preservation_and_pages(collection, client):
    insert(collection, '3', '2026-11-12')
    assert seed_collection(collection, datetime(2026, 11, 18)) == 108
    assert seed_collection(collection, datetime(2026, 12, 18)) == 0
    assert collection.count_documents({}) == 109
    for path in ['/?month=2026-11', '/insights?month=2026-11', '/transactions', '/simulator?category=Compras&month=2026-11&percent=15&months=12']:
        assert client.get(path).status_code == 200, path
    assert analysis.insights('2026-11')['outliers']
    collection.delete_many({'seed_key': {'$regex': '^finscope-demo-v1:'}})
    assert collection.count_documents({}) == 1
