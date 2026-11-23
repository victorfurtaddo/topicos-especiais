"""Inicia o MongoDB local; os dados permanecem em .local-mongo após reiniciar."""
import os
import shutil
import subprocess
from pathlib import Path

from pymongo import MongoClient
from pymongo.errors import PyMongoError

ROOT = Path(__file__).resolve().parents[1]


def main():
    with MongoClient('mongodb://127.0.0.1:27017', serverSelectionTimeoutMS=1500) as client:
        try:
            client.admin.command('ping')
            print('MongoDB já está disponível em 127.0.0.1:27017.')
            return
        except PyMongoError:
            pass
    executable = shutil.which('mongod')
    local = ROOT / '.local-mongodb' / 'bin' / 'mongod'
    if not executable and local.is_file():
        executable = str(local)
    if not executable:
        raise SystemExit('MongoDB não encontrado. Instale o MongoDB Community Server e tente novamente.')
    data = ROOT / '.local-mongo'
    data.mkdir(exist_ok=True)
    command = [executable, '--dbpath', str(data), '--bind_ip', '127.0.0.1', '--port', '27017']
    if os.name != 'nt':
        command += ['--logpath', str(data / 'mongod.log'), '--fork']
    print(f'Dados do banco: {data}', flush=True)
    subprocess.run(command, check=True)


if __name__ == '__main__':
    main()
