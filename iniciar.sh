#!/usr/bin/env bash
# Inicia o banco local e depois o Flask usando o ambiente do projeto.
set -e
cd -- "$(dirname -- "${BASH_SOURCE[0]}")"
if [ ! -x .venv/bin/python ]; then
    echo 'Ambiente Python não encontrado. Siga a instalação no README.md.' >&2
    exit 1
fi
.venv/bin/python scripts/start_mongo.py
exec .venv/bin/python app.py
