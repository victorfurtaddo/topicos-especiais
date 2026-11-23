from flask import Blueprint, jsonify, render_template, request
from db import transactions
from services import financial_analysis as analysis
from services.formatting import serialize

bp = Blueprint('analytics', __name__)


@bp.get('/')
def dashboard():
    data = analysis.dashboard(request.args.get('month'))
    start, end = analysis.month_bounds(data['month'])
    recent = list(transactions().find(analysis.period_match(start, end)).sort([('date', -1), ('_id', -1)]).limit(5))
    return render_template('dashboard.html', data=data, recent=recent)


@bp.get('/insights')
def insights():
    return render_template('insights.html', data=analysis.insights(request.args.get('month')))


@bp.get('/simulator')
def simulator():
    result = analysis.simulation(request.args) if 'category' in request.args else None
    start, _ = analysis.month_bounds(request.args.get('month'))
    return render_template('simulator.html', result=result, month=start.strftime('%Y-%m'))


@bp.get('/api/analytics')
def api_analytics():
    return jsonify(serialize(analysis.dashboard(request.args.get('month'))))


@bp.get('/api/insights')
def api_insights():
    return jsonify(serialize(analysis.insights(request.args.get('month'))))


@bp.get('/api/simulation')
def api_simulation():
    return jsonify(serialize(analysis.simulation(request.args)))
