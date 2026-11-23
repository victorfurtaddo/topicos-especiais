"""As quatro consultas são executadas pelo MongoDB; Python apenas apresenta resultados."""
import re
from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP

from config import TIMEZONE, VARIABLE_CATEGORIES
from db import transactions
from services.formatting import decimal
from services.validation import ValidationError, positive_integer


def shift_month(date, offset):
    index = date.year * 12 + date.month - 1 + offset
    return datetime(index // 12, index % 12 + 1, 1, tzinfo=TIMEZONE)


def month_bounds(value=None):
    value = value or datetime.now(TIMEZONE).strftime('%Y-%m')
    if not isinstance(value, str) or not re.fullmatch(r'\d{4}-\d{2}', value):
        raise ValidationError('Mês inválido. Use AAAA-MM.')
    try:
        start = datetime.strptime(value, '%Y-%m').replace(tzinfo=TIMEZONE)
        if not 1900 <= start.year <= 2100:
            raise ValueError
    except ValueError:
        raise ValidationError('Mês inválido. Use um ano entre 1900 e 2100.') from None
    return start, shift_month(start, 1)


def period_match(start, end, kind=None):
    result = {'date': {'$gte': start.astimezone(timezone.utc), '$lt': end.astimezone(timezone.utc)}}
    if kind:
        result['type'] = kind
    return result


def evolution_pipeline(start, end):
    return [
        {'$match': period_match(start, end)},
        {'$group': {'_id': {'month': {'$dateToString': {'format': '%Y-%m', 'date': '$date', 'timezone': str(TIMEZONE)}}, 'type': '$type'}, 'total': {'$sum': '$amount'}}},
        {'$project': {'_id': 0, 'month': '$_id.month', 'type': '$_id.type', 'total': 1}},
        {'$sort': {'month': 1, 'type': 1}},
    ]


def category_pipeline(start, end):
    return [
        {'$match': period_match(start, end, 'expense')},
        {'$group': {'_id': '$category', 'total': {'$sum': '$amount'}, 'count': {'$sum': 1}}},
        {'$group': {'_id': None, 'overall': {'$sum': '$total'}, 'categories': {'$push': {'category': '$_id', 'total': '$total', 'count': '$count'}}}},
        {'$unwind': '$categories'},
        {'$project': {'_id': 0, 'category': '$categories.category', 'total': '$categories.total', 'count': '$categories.count',
                       'percentage': {'$multiply': [{'$divide': ['$categories.total', '$overall']}, 100]}}},
        {'$sort': {'total': -1, 'category': 1}},
    ]


def outlier_pipeline(start, end):
    return [
        {'$match': period_match(shift_month(start, -6), start, 'expense')},
        {'$group': {'_id': '$category', 'average': {'$avg': '$amount'}, 'sample_size': {'$sum': 1}}},
        {'$match': {'sample_size': {'$gte': 3}}},
        {'$set': {'threshold': {'$multiply': ['$average', 2]}}},
        {'$lookup': {'from': 'transactions', 'let': {'category': '$_id', 'threshold': '$threshold'}, 'pipeline': [
            {'$match': period_match(start, end, 'expense')},
            {'$match': {'$expr': {'$and': [{'$eq': ['$category', '$$category']}, {'$gt': ['$amount', '$$threshold']}]}}},
            {'$project': {'description': 1, 'amount': 1, 'date': 1}},
        ], 'as': 'unusual'}},
        {'$unwind': '$unusual'},
        {'$project': {'_id': '$unusual._id', 'category': '$_id', 'description': '$unusual.description',
                      'amount': '$unusual.amount', 'date': '$unusual.date', 'average': 1, 'threshold': 1, 'sample_size': 1}},
        {'$sort': {'amount': -1}},
    ]


def recurring_pipeline(start, end):
    # Daily grouping prevents multiple purchases on the same day from faking recurrence.
    return [
        {'$match': period_match(start, end, 'expense')},
        {'$set': {'identity': {'$toLower': {'$trim': {'input': {'$cond': [
            {'$ne': ['$merchant.name', '']}, '$merchant.name', '$description']}}}},
                  'day': {'$dateTrunc': {'date': '$date', 'unit': 'day', 'timezone': str(TIMEZONE)}}}},
        {'$group': {'_id': {'name': '$identity', 'category': '$category', 'day': '$day'}, 'amount': {'$sum': '$amount'}, 'payments': {'$sum': 1}, 'label': {'$first': '$merchant.name'}}},
        {'$set': {'key': {'name': '$_id.name', 'category': '$_id.category'}, 'date': '$_id.day'}},
        {'$setWindowFields': {'partitionBy': '$key', 'sortBy': {'date': 1}, 'output': {'previous': {'$shift': {'output': '$date', 'by': -1}}}}},
        {'$set': {'interval': {'$cond': [{'$ne': ['$previous', None]}, {'$dateDiff': {'startDate': '$previous', 'endDate': '$date', 'unit': 'day', 'timezone': str(TIMEZONE)}}, None]}}},
        {'$group': {'_id': '$key', 'days': {'$sum': 1}, 'payments': {'$sum': '$payments'}, 'average': {'$avg': '$amount'},
                    'dates': {'$addToSet': '$date'}, 'min_interval': {'$min': '$interval'}, 'max_interval': {'$max': '$interval'},
                    'average_interval': {'$avg': '$interval'}, 'last_date': {'$max': '$date'}}},
        {'$match': {'days': {'$gte': 3}, '$or': [
            {'min_interval': {'$gte': 25}, 'max_interval': {'$lte': 35}},
            {'min_interval': {'$gte': 5}, 'max_interval': {'$lte': 9}},
        ]}},
        {'$project': {'_id': 0, 'merchant': '$_id.name', 'category': '$_id.category', 'days': 1, 'payments': 1, 'average': 1,
                      'dates': 1, 'min_interval': 1, 'max_interval': 1, 'average_interval': 1, 'last_date': 1,
                      'cadence': {'$cond': [{'$gte': ['$min_interval', 25]}, 'Mensal', 'Semanal']}}},
        {'$sort': {'average': -1, 'merchant': 1}},
    ]


def aggregate(pipeline):
    return list(transactions().aggregate(pipeline, maxTimeMS=10000))


def dashboard(month=None):
    start, end = month_bounds(month)
    history_start = shift_month(start, -5)
    evolution = aggregate(evolution_pipeline(history_start, end))
    # Fill empty calendar months; all sums and grouping already happened in MongoDB.
    series = {shift_month(start, i).strftime('%Y-%m'): {'income': Decimal(0), 'expense': Decimal(0)} for i in range(-5, 1)}
    for row in evolution:
        series[row['month']][row['type']] = decimal(row['total'])
    current = series[start.strftime('%Y-%m')]
    previous = series[shift_month(start, -1).strftime('%Y-%m')]
    income, expense = current['income'], current['expense']
    return {'month': start.strftime('%Y-%m'), 'income': income, 'expense': expense,
            'balance': income - expense, 'saving_rate': (income - expense) / income * 100 if income else None,
            'previous': previous, 'expense_change': (expense - previous['expense']) / previous['expense'] * 100 if previous['expense'] else None,
            'categories': aggregate(category_pipeline(start, end)),
            'chart': {'labels': [key[5:] + '/' + key[:4] for key in series],
                      'income': [float(row['income']) for row in series.values()],
                      'expense': [float(row['expense']) for row in series.values()]}}


def insights(month=None):
    start, end = month_bounds(month)
    categories = aggregate(category_pipeline(start, end))
    previous = {r['category']: decimal(r['total']) for r in aggregate(category_pipeline(shift_month(start, -1), start))}
    current = {r['category']: decimal(r['total']) for r in categories}
    changes = []
    for category in sorted(current.keys() | previous.keys()):
        now, before = current.get(category, Decimal(0)), previous.get(category, Decimal(0))
        changes.append({'category': category, 'current': now, 'previous': before,
                        'change': (now - before) / before * 100 if before else None})
    return {'month': start.strftime('%Y-%m'), 'changes': changes,
            'concentrations': [row for row in categories if decimal(row['percentage']) >= 25],
            'outliers': aggregate(outlier_pipeline(start, end)),
            'recurring': aggregate(recurring_pipeline(shift_month(start, -5), end)),
            'opportunities': [{'category': r['category'], 'total': decimal(r['total']), 'saving': decimal(r['total']) * Decimal('.15')}
                              for r in categories if r['category'] in VARIABLE_CATEGORIES]}


def simulation(args):
    start, end = month_bounds(args.get('month'))
    category = args.get('category')
    from config import CATEGORIES
    if not isinstance(category, str) or category not in CATEGORIES:
        raise ValidationError('Escolha uma categoria válida.')
    months = positive_integer(args.get('months', '12'), 'Período', 120)
    raw = args.get('percent', '15')
    try:
        if isinstance(raw, (bool, dict, list)):
            raise ValueError
        percent = Decimal(str(raw).replace(',', '.'))
        if not percent.is_finite() or not 0 <= percent <= 100 or percent != percent.quantize(Decimal('.01')):
            raise ValueError
    except (InvalidOperation, ValueError):
        raise ValidationError('Redução: use um percentual de 0 a 100 com até duas casas decimais.') from None
    rows = aggregate([{'$match': {**period_match(start, end, 'expense'), 'category': category}},
                      {'$group': {'_id': None, 'total': {'$sum': '$amount'}}}])
    total = decimal(rows[0]['total']) if rows else Decimal(0)
    saving = (total * percent / 100).quantize(Decimal('.01'), rounding=ROUND_HALF_UP)
    return {'month': start.strftime('%Y-%m'), 'category': category, 'months': months, 'percent': percent,
            'current': total, 'reduced': total - saving, 'monthly_saving': saving,
            'accumulated': saving * months, 'current_total': total * months, 'reduced_total': (total - saving) * months}
