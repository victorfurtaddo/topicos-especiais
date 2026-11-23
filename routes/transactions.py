from datetime import datetime, timezone
from bson import ObjectId
from flask import Blueprint, abort, flash, jsonify, redirect, render_template, request, url_for

from db import transactions
from services.formatting import serialize
from services.validation import ValidationError, positive_integer, transaction_filter, validate_transaction

bp = Blueprint('transactions', __name__)


def find_transaction(identifier):
    if not ObjectId.is_valid(identifier):
        abort(404)
    document = transactions().find_one({'_id': ObjectId(identifier)})
    if document is None:
        abort(404)
    return document


def form_data():
    data = request.form.to_dict()
    data['is_recurring'] = data.get('is_recurring') == 'on'
    data['installments'] = positive_integer(data.get('installments', '1'), 'Parcelas', 60)
    data['tags'] = [tag.strip() for tag in data.get('tags', '').split(',') if tag.strip()]
    data['merchant'] = {'name': data.get('merchant_name', ''), 'city': data.get('merchant_city', '')}
    return data


def save(data, identifier=None):
    document = validate_transaction(data)
    if identifier:
        existing = find_transaction(identifier)
        transactions().update_one({'_id': existing['_id']}, {'$set': document})
        return identifier
    document['created_at'] = datetime.now(timezone.utc)
    return str(transactions().insert_one(document).inserted_id)


@bp.get('/transactions')
def index():
    query = transaction_filter(request.args)
    page = positive_integer(request.args.get('page', '1'), 'Página', 100000)
    total = transactions().count_documents(query)
    rows = list(transactions().find(query).sort([('date', -1), ('_id', -1)]).skip((page - 1) * 20).limit(20))
    filters = request.args.to_dict()
    filters.pop('page', None)
    return render_template('transactions.html', rows=rows, total=total, page=page,
                           pages=max(1, (total + 19) // 20), filters=filters)


@bp.route('/transactions/new', methods=['GET', 'POST'])
@bp.route('/transactions/<identifier>/edit', methods=['GET', 'POST'])
def edit(identifier=None):
    document = find_transaction(identifier) if identifier else None
    if request.method == 'POST':
        try:
            save(form_data(), identifier)
        except ValidationError as error:
            return render_template('transaction_form.html', document=document, values=request.form, error=str(error)), 400
        flash('Transação atualizada.' if identifier else 'Transação cadastrada. As análises já foram atualizadas.', 'success')
        return redirect(url_for('transactions.index'))
    return render_template('transaction_form.html', document=document, values=None)


@bp.post('/transactions/<identifier>/delete')
def delete(identifier):
    document = find_transaction(identifier)
    if request.form.get('confirm') != 'yes':
        raise ValidationError('Confirme a exclusão da transação.')
    transactions().delete_one({'_id': document['_id']})
    flash('Transação excluída.', 'success')
    return redirect(url_for('transactions.index'))


@bp.get('/api/transactions')
def api_list():
    query = transaction_filter(request.args)
    page = positive_integer(request.args.get('page', '1'), 'Página', 100000)
    rows = list(transactions().find(query).sort([('date', -1), ('_id', -1)]).skip((page - 1) * 20).limit(20))
    return jsonify(serialize({'items': rows, 'total': transactions().count_documents(query), 'page': page}))


@bp.get('/api/transactions/<identifier>')
def api_get(identifier):
    return jsonify(serialize(find_transaction(identifier)))


@bp.post('/api/transactions')
def api_create():
    identifier = save(request.get_json())
    return jsonify(serialize(find_transaction(identifier))), 201


@bp.put('/api/transactions/<identifier>')
def api_update(identifier):
    find_transaction(identifier)
    save(request.get_json(), identifier)
    return jsonify(serialize(find_transaction(identifier)))


@bp.delete('/api/transactions/<identifier>')
def api_delete(identifier):
    document = find_transaction(identifier)
    if request.args.get('confirm') != 'yes':
        raise ValidationError('Informe confirm=yes para confirmar a exclusão.')
    transactions().delete_one({'_id': document['_id']})
    return '', 204
