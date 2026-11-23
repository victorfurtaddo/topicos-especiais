from flask import current_app
from pymongo import MongoClient


def init_db(app):
    client = MongoClient(app.config['MONGO_URI'], tz_aware=True,
                         serverSelectionTimeoutMS=3000, connectTimeoutMS=3000)
    app.extensions['mongo'] = client


def get_db():
    return current_app.extensions['mongo'][current_app.config['MONGO_DB']]


def transactions():
    return get_db().transactions


def create_indexes():
    transactions().create_index([('date', -1)])
    transactions().create_index([('type', 1), ('category', 1), ('date', 1)])
    transactions().create_index('seed_key', unique=True, sparse=True)
