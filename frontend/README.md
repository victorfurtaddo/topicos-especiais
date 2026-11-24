# Interface FinScope

Interface em Next.js e React para o backend Flask e MongoDB deste projeto.
As páginas usam a API real; os cálculos financeiros continuam no MongoDB.

## Instalação

Requer Node.js 20.9 ou superior e npm. Nesta pasta:

```bash
npm ci
```

## Executar

No Linux, a partir da raiz do projeto (uma pasta acima), use:

```bash
./iniciar.sh
```

Esse comando inicia MongoDB, Flask e frontend. Configure antes o ambiente
Python e o MongoDB conforme o README da raiz.

Abra http://127.0.0.1:3000 e mantenha o terminal aberto. Ctrl+C encerra os
servidores iniciados pelo script; o MongoDB continua ativo.

Para executar a interface separadamente, com o Flask já ativo:

```bash
npm run dev -- --hostname 127.0.0.1
```

`next.config.ts` encaminha `/api/*` para `http://127.0.0.1:5000` por padrão.
Para um backend em outro endereço, configure `FLASK_URL` no processo Next.
Acessar a API pela mesma origem da interface preserva a sessão e o token CSRF.

## Verificação

```bash
npm run lint
npm run build
```

Não inclua `node_modules/`, `.next/` ou arquivos `.env` na entrega.
O arquivo `package-lock.json` deve acompanhar o código para instalação com `npm ci`.
