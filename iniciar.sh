#!/usr/bin/env bash
# Inicia MongoDB, Flask e a interface Next.js no mesmo terminal.
set -euo pipefail
cd -- "$(dirname -- "${BASH_SOURCE[0]}")"

fail() { echo "Erro: $*" >&2; exit 1; }
[[ -x .venv/bin/python ]] || fail 'Crie o ambiente com python3 -m venv .venv e instale requirements.txt.'
command -v node >/dev/null || fail 'Instale o Node.js 20.9 ou superior.'
node -e 'const [a,b]=process.versions.node.split(".").map(Number); process.exit(a>20 || (a===20 && b>=9) ? 0 : 1)' || fail 'Use Node.js 20.9 ou superior.'
[[ -f frontend/node_modules/next/dist/bin/next ]] || fail 'Instale o frontend: cd frontend && npm ci'

# Não encerrar serviços que já estavam em execução antes deste script.
pids=()
cleanup() {
    trap - EXIT INT TERM
    for pid in "${pids[@]}"; do kill -TERM "$pid" 2>/dev/null || true; done
    for pid in "${pids[@]}"; do wait "$pid" 2>/dev/null || true; done
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

port_open() {
    .venv/bin/python - "$1" <<'PY'
import socket, sys
with socket.socket() as connection:
    connection.settimeout(0.5)
    sys.exit(0 if connection.connect_ex(('127.0.0.1', int(sys.argv[1]))) == 0 else 1)
PY
}
backend_ready() {
    .venv/bin/python - <<'PY'
import json, sys
from urllib.request import urlopen
try:
    with urlopen('http://127.0.0.1:5000/api/csrf', timeout=1) as response:
        sys.exit(0 if isinstance(json.load(response).get('csrf_token'), str) else 1)
except Exception:
    sys.exit(1)
PY
}

if port_open 3000; then
    fail 'A porta 3000 está ocupada. Encerre a interface já aberta antes de iniciar novamente.'
fi
if port_open 5000 && ! backend_ready; then
    fail 'A porta 5000 está ocupada por outro serviço.'
fi

.venv/bin/python scripts/start_mongo.py
if backend_ready; then
    echo 'Flask já está disponível na porta 5000; reutilizando.'
else
    .venv/bin/python app.py &
    backend_pid=$!
    pids+=("$backend_pid")
    ready=false
    for ((attempt=0; attempt<30; attempt++)); do
        kill -0 "$backend_pid" 2>/dev/null || fail 'O Flask encerrou durante a inicialização. Veja o erro acima.'
        if backend_ready; then ready=true; break; fi
        sleep 0.5
    done
    [[ "$ready" == true ]] || fail 'O Flask não respondeu na porta 5000.'
fi

# Executa o Next diretamente para controlar e encerrar o processo correto.
export FLASK_URL=http://127.0.0.1:5000
node frontend/node_modules/next/dist/bin/next dev frontend --hostname 127.0.0.1 --port 3000 &
pids+=("$!")
echo ''
echo 'FinScope: http://127.0.0.1:3000'
echo 'Mantenha este terminal aberto. Ctrl+C encerra os servidores iniciados aqui.'
echo 'O MongoDB permanece ativo; os dados são preservados.'
if wait -n "${pids[@]}"; then
    fail 'Um dos servidores foi encerrado.'
else
    fail 'Um dos servidores falhou. Veja a mensagem acima.'
fi
