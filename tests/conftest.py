import os
import sys
from pathlib import Path
from uuid import uuid4

import pytest
from pymongo.errors import PyMongoError

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app import create_app
from db import create_indexes, transactions


@pytest.fixture
def app():
    # Never drop a configured application database. Each test owns a fresh name.
    application = create_app({'TESTING': True, 'SECRET_KEY': 'test-only',
                              'MONGO_URI': os.getenv('TEST_MONGO_URI', 'mongodb://127.0.0.1:27017'),
                              'MONGO_DB': 'finscope_test_' + uuid4().hex})
    client = application.extensions['mongo']
    try:
        client.admin.command('ping')
    except PyMongoError:
        pytest.fail('MongoDB real indisponível. Inicie o serviço ou configure TEST_MONGO_URI.')
    with application.app_context():
        create_indexes()
        yield application
    client.drop_database(application.config['MONGO_DB'])
    client.close()


@pytest.fixture
def collection(app):
    return transactions()


@pytest.fixture
def client(app):
    return app.test_client()


@pytest.fixture
def csrf(client):
    return {'X-CSRF-Token': client.get('/api/csrf').json['csrf_token']}


@pytest.fixture
def payload():
    return {'description': 'Mercado', 'amount': '100.10', 'type': 'expense', 'category': 'Alimentação',
            'date': '2026-11-18', 'payment_method': 'pix', 'installments': 1,
            'is_recurring': False, 'tags': ['essencial'], 'merchant': {'name': 'Central', 'city': 'Itapetininga'}, 'notes': ''}
