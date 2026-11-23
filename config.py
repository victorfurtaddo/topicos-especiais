import os
import secrets
from pathlib import Path
from zoneinfo import ZoneInfo

from dotenv import load_dotenv

load_dotenv(Path(__file__).with_name('.env'))
TIMEZONE = ZoneInfo('America/Sao_Paulo')
CATEGORIES = ('Alimentação', 'Moradia', 'Transporte', 'Saúde', 'Educação', 'Lazer',
              'Compras', 'Assinaturas', 'Salário', 'Freelance', 'Outros')
PAYMENTS = {'pix': 'Pix', 'credit_card': 'Cartão de crédito',
            'debit_card': 'Cartão de débito', 'cash': 'Dinheiro', 'transfer': 'Transferência'}
VARIABLE_CATEGORIES = ('Alimentação', 'Transporte', 'Lazer', 'Compras')


class Config:
    MONGO_URI = os.getenv('MONGO_URI', 'mongodb://127.0.0.1:27017')
    MONGO_DB = os.getenv('MONGO_DB', 'finscope')
    SECRET_KEY = os.getenv('SECRET_KEY') or secrets.token_hex(32)
    MAX_CONTENT_LENGTH = 32 * 1024
    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SAMESITE = 'Lax'
