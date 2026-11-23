from datetime import datetime
from bson import Decimal128
import pytest


def test_crud_persistence_filters_and_analytics(client, csrf, payload, collection):
    result = client.post('/api/transactions', json=payload, headers=csrf)
    assert result.status_code == 201
    identifier = result.json['_id']
    stored = collection.find_one()
    assert isinstance(stored['amount'], Decimal128)
    assert isinstance(stored['date'], datetime)
    assert isinstance(stored['merchant'], dict) and isinstance(stored['tags'], list)
    assert len(stored) >= 13
    assert client.get('/api/transactions/' + identifier).json['amount'] == '100.10'
    assert client.get('/api/transactions?q=mer&start=2026-11-18&end=2026-11-18&type=expense&category=Alimentação').json['total'] == 1
    assert client.get('/api/transactions?q=.*').json['total'] == 0
    assert client.get('/api/analytics?month=2026-11').json['expense'] == '100.10'
    payload['amount'] = '120.55'
    payload['description'] = 'Mercado atualizado'
    assert client.put('/api/transactions/' + identifier, json=payload, headers=csrf).status_code == 200
    assert client.get('/api/analytics?month=2026-11').json['expense'] == '120.55'
    assert collection.find_one()['created_at'] == stored['created_at']
    assert client.delete('/api/transactions/' + identifier, headers=csrf).status_code == 400
    assert client.delete('/api/transactions/' + identifier + '?confirm=yes', headers=csrf).status_code == 204
    assert collection.count_documents({}) == 0
    assert client.get('/api/transactions/' + identifier).status_code == 404


@pytest.mark.parametrize('field,value', [('amount', '-1'), ('amount', 'NaN'), ('amount', '0'), ('amount', '1.001'),
    ('amount', {'$gt': 0}), ('type', {'$ne': ''}), ('category', ['Alimentação']), ('date', '2026-02-30'),
    ('date', '2026-11-18T10:00:00Z'), ('installments', True), ('installments', 1.5), ('is_recurring', 'false'),
    ('tags', 'mercado'), ('tags', [{'bad': 1}]), ('merchant', []), ('description', ''), ('payment_method', [])])
def test_invalid_inputs(client, csrf, payload, collection, field, value):
    payload[field] = value
    assert client.post('/api/transactions', json=payload, headers=csrf).status_code == 400
    assert collection.count_documents({}) == 0


def test_csrf_missing_and_bad_json(client, payload, csrf):
    assert client.post('/api/transactions', json=payload).status_code == 400
    assert client.post('/api/transactions', json=[], headers=csrf).status_code == 400
    assert client.get('/api/transactions/not-an-id').status_code == 404
    assert client.get('/api/transactions?start=2026-12-01&end=2026-11-01').status_code == 400
    assert client.get('/api/transactions?page=0').status_code == 400


def test_html_form_edit_delete_escape(client, csrf, payload):
    payload['description'] = '<script>alert(1)</script>'
    doc = client.post('/api/transactions', json=payload, headers=csrf).json
    response = client.get('/transactions')
    assert b'&lt;script&gt;' in response.data
    assert b'<script>alert(1)</script>' not in response.data
    assert client.get(f"/transactions/{doc['_id']}/edit").status_code == 200
    form = {**payload, 'csrf_token': csrf['X-CSRF-Token'], 'tags': 'mercado, essencial', 'installments': '2',
            'merchant_name': 'Mercado', 'merchant_city': 'Itapetininga', 'description': 'Salvo pelo formulário'}
    form.pop('is_recurring')
    form.pop('merchant')
    assert client.post(f"/transactions/{doc['_id']}/edit", data=form).status_code == 302
    assert client.get('/api/transactions/' + doc['_id']).json['description'] == 'Salvo pelo formulário'
    form['amount'] = '-1'
    assert client.post('/transactions/new', data=form).status_code == 400
    assert client.post(f"/transactions/{doc['_id']}/delete", data={'csrf_token': csrf['X-CSRF-Token'], 'confirm': 'yes'}).status_code == 302


def test_empty_pages(client):
    for path in ['/', '/transactions', '/transactions/new', '/insights', '/simulator', '/simulator?category=Lazer&percent=15&months=12']:
        assert client.get(path).status_code == 200, path
    response = client.get('/api/analytics?month=2026-11').json
    assert response['saving_rate'] is None
    assert response['expense_change'] is None


def test_non_ascii_csrf_is_rejected(client, payload, csrf):
    assert client.post('/api/transactions', json=payload, headers={'X-CSRF-Token': 'inválido'}).status_code == 400


def test_form_creation_preserves_values_on_error(client, csrf, collection):
    form = {'csrf_token': csrf['X-CSRF-Token'], 'description': 'Almoço', 'amount': '32.90',
            'type': 'expense', 'category': 'Alimentação', 'date': '2026-11-18', 'payment_method': 'pix',
            'installments': '1', 'tags': 'alimentação, pessoal', 'merchant_name': 'Restaurante', 'merchant_city': 'Itapetininga'}
    assert client.post('/transactions/new', data=form).status_code == 302
    assert collection.find_one()['merchant']['name'] == 'Restaurante'
    form['amount'] = 'ruim'
    response = client.post('/transactions/new', data=form)
    assert response.status_code == 400
    assert 'Almoço'.encode() in response.data
    assert collection.count_documents({}) == 1
