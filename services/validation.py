import re
from datetime import datetime, timedelta, timezone
from decimal import Decimal, InvalidOperation

from bson import Decimal128
from config import CATEGORIES, PAYMENTS, TIMEZONE


class ValidationError(ValueError):
    pass


def text(value, field, maximum=160, required=False):
    if not isinstance(value, str):
        raise ValidationError(f'{field}: informe um texto.')
    value = value.strip()
    if (required and not value) or len(value) > maximum:
        raise ValidationError(f'{field}: preencha com até {maximum} caracteres.')
    return value


def money(value):
    if isinstance(value, (bool, dict, list)) or value is None:
        raise ValidationError('Valor: informe um número positivo com até duas casas decimais.')
    try:
        result = Decimal(str(value).replace(',', '.'))
        if not result.is_finite() or not Decimal('0') < result <= Decimal('999999999.99'):
            raise InvalidOperation
        if result != result.quantize(Decimal('.01')):
            raise InvalidOperation
        return result.quantize(Decimal('.01'))
    except (InvalidOperation, ValueError):
        raise ValidationError('Valor: use de 0,01 a 999.999.999,99, com até duas casas decimais.') from None


def local_date(value):
    if not isinstance(value, str) or not re.fullmatch(r'\d{4}-\d{2}-\d{2}', value):
        raise ValidationError('Data: use o formato AAAA-MM-DD.')
    try:
        parsed = datetime.strptime(value, '%Y-%m-%d').replace(tzinfo=TIMEZONE)
        if not 1900 <= parsed.year <= 2100:
            raise ValueError
        return parsed.astimezone(timezone.utc)
    except ValueError:
        raise ValidationError('Data inválida. Use um ano entre 1900 e 2100.') from None


def validate_transaction(data):
    if not isinstance(data, dict):
        raise ValidationError('Envie um objeto com os campos da transação.')
    kind = data.get('type')
    category = data.get('category')
    payment = data.get('payment_method')
    if not isinstance(kind, str) or kind not in ('income', 'expense'):
        raise ValidationError('Tipo: escolha receita ou despesa.')
    if not isinstance(category, str) or category not in CATEGORIES:
        raise ValidationError('Categoria inválida.')
    if not isinstance(payment, str) or payment not in PAYMENTS:
        raise ValidationError('Forma de pagamento inválida.')
    recurring = data.get('is_recurring', False)
    if not isinstance(recurring, bool):
        raise ValidationError('Recorrência: informe verdadeiro ou falso.')
    installments = data.get('installments', 1)
    if type(installments) is not int or not 1 <= installments <= 60:
        raise ValidationError('Parcelas: informe um inteiro de 1 a 60.')
    tags = data.get('tags', [])
    if not isinstance(tags, list) or len(tags) > 10:
        raise ValidationError('Tags: informe uma lista de até 10 textos.')
    merchant = data.get('merchant', {})
    if not isinstance(merchant, dict):
        raise ValidationError('Estabelecimento: informe nome e cidade.')
    return {
        'description': text(data.get('description', ''), 'Descrição', required=True),
        'amount': Decimal128(money(data.get('amount'))), 'type': kind, 'category': category,
        'date': local_date(data.get('date')), 'payment_method': payment,
        'is_recurring': recurring, 'installments': installments,
        'tags': list(dict.fromkeys(text(t, 'Tag', 30, True) for t in tags)),
        'merchant': {'name': text(merchant.get('name', ''), 'Estabelecimento', 100),
                     'city': text(merchant.get('city', ''), 'Cidade', 80)},
        'notes': text(data.get('notes', ''), 'Observações', 1000),
    }


def transaction_filter(args):
    query = {}
    if args.get('type'):
        if args['type'] not in ('income', 'expense'):
            raise ValidationError('Tipo inválido.')
        query['type'] = args['type']
    if args.get('category'):
        if args['category'] not in CATEGORIES:
            raise ValidationError('Categoria inválida.')
        query['category'] = args['category']
    dates = {}
    if args.get('start'):
        dates['$gte'] = local_date(args['start'])
    if args.get('end'):
        # Calendar days in local time, including historical DST boundaries.
        end = local_date(args['end']).astimezone(TIMEZONE) + timedelta(days=1)
        dates['$lt'] = end.astimezone(timezone.utc)
    if len(dates) == 2 and dates['$gte'] >= dates['$lt']:
        raise ValidationError('A data final deve ser igual ou posterior à inicial.')
    if dates:
        query['date'] = dates
    if args.get('q'):
        query['description'] = {'$regex': re.escape(text(args['q'], 'Pesquisa', 100)), '$options': 'i'}
    return query


def positive_integer(value, field, maximum):
    if not isinstance(value, (str, int)) or isinstance(value, bool) or not str(value).isdigit():
        raise ValidationError(f'{field}: informe um número inteiro.')
    result = int(value)
    if not 1 <= result <= maximum:
        raise ValidationError(f'{field}: use um valor de 1 a {maximum}.')
    return result
