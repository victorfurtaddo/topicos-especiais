from datetime import datetime
from decimal import Decimal, ROUND_HALF_UP
from bson import Decimal128, ObjectId
from config import TIMEZONE


def decimal(value):
    return value.to_decimal() if isinstance(value, Decimal128) else Decimal(str(value))


def brl(value):
    value = decimal(value).quantize(Decimal('.01'), rounding=ROUND_HALF_UP)
    return 'R$ ' + f'{value:,.2f}'.replace(',', '_').replace('.', ',').replace('_', '.')


def serialize(value):
    if isinstance(value, dict):
        return {str(k): serialize(v) for k, v in value.items()}
    if isinstance(value, (tuple, list)):
        return [serialize(v) for v in value]
    if isinstance(value, (Decimal128, Decimal)):
        return str(decimal(value))
    if isinstance(value, ObjectId):
        return str(value)
    if isinstance(value, datetime):
        return value.astimezone(TIMEZONE).isoformat()
    return value
