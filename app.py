import hmac
import secrets
from datetime import datetime

import click
from flask import Flask, abort, jsonify, render_template, request, session
from pymongo.errors import PyMongoError
from werkzeug.exceptions import HTTPException

from config import CATEGORIES, PAYMENTS, TIMEZONE, Config
from db import create_indexes, init_db
from services.formatting import brl, decimal
from services.validation import ValidationError


def create_app(test_config=None):
    app = Flask(__name__)
    app.config.from_object(Config)
    if test_config:
        app.config.update(test_config)
    init_db(app)
    from routes.transactions import bp as transaction_routes
    from routes.analytics import bp as analytics_routes
    app.register_blueprint(transaction_routes)
    app.register_blueprint(analytics_routes)

    def csrf_token():
        if 'csrf_token' not in session:
            session['csrf_token'] = secrets.token_hex(32)
        return session['csrf_token']

    @app.before_request
    def protect_mutations():
        if request.method in ('POST', 'PUT', 'PATCH', 'DELETE'):
            supplied = request.headers.get('X-CSRF-Token') or request.form.get('csrf_token', '')
            expected = session.get('csrf_token', '')
            if not expected or not hmac.compare_digest(expected.encode(), supplied.encode()):
                abort(400, description='Sessão expirada ou token CSRF inválido. Recarregue a página.')

    @app.after_request
    def security_headers(response):
        response.headers['X-Content-Type-Options'] = 'nosniff'
        response.headers['X-Frame-Options'] = 'DENY'
        response.headers['Referrer-Policy'] = 'same-origin'
        response.headers['Content-Security-Policy'] = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'"
        response.headers['Cache-Control'] = 'no-store'
        return response

    @app.context_processor
    def template_context():
        return {'categories': CATEGORIES, 'payments': PAYMENTS, 'csrf_token': csrf_token,
                'today': datetime.now(TIMEZONE).strftime('%Y-%m-%d')}

    app.jinja_env.filters['brl'] = brl
    app.jinja_env.filters['decimal'] = decimal
    app.jinja_env.filters['date_br'] = lambda value: value.astimezone(TIMEZONE).strftime('%d/%m/%Y')
    app.jinja_env.filters['date_input'] = lambda value: value.astimezone(TIMEZONE).strftime('%Y-%m-%d')

    def error_response(message, status):
        if request.path.startswith('/api/'):
            return jsonify(error=message), status
        return render_template('error.html', message=message, status=status), status

    @app.errorhandler(ValidationError)
    def invalid(error):
        return error_response(str(error), 400)

    @app.errorhandler(PyMongoError)
    def database_error(error):
        app.logger.error('MongoDB indisponível: %s', type(error).__name__)
        return error_response('Não foi possível acessar o MongoDB. Verifique se o serviço está ativo e se o arquivo .env está configurado.', 503)

    @app.errorhandler(HTTPException)
    def http_error(error):
        message = 'Transação ou página não encontrada.' if error.code == 404 else error.description
        return error_response(message, error.code)

    @app.get('/api/csrf')
    def csrf():
        return jsonify(csrf_token=csrf_token())

    @app.cli.command('init-db')
    def init_database():
        create_indexes()
        click.echo('Conexão verificada e índices criados.')

    return app


if __name__ == '__main__':
    create_app().run(host='127.0.0.1', port=5000, debug=False)
