# Installazione (checkout su nuova macchina)

Requisiti: Node.js >= 22 e [pnpm](https://pnpm.io).

```sh
node -v   # deve essere >= 22 e <26
npm i -g pnpm   # se pnpm non è già installato
```

## 1. Clone + installazione dipendenze

```sh
git clone <repo-url> envpulse
cd envpulse
pnpm install --frozen-lockfile
```

`pnpm-workspace.yaml` ha già `onlyBuiltDependencies` per `better-sqlite3`/`esbuild`,
quindi i build nativi partono da soli senza dover approvare nulla manualmente.

## 2. Build di tutti i pacchetti

```sh
pnpm build
```

Costruisce `core` → `server` → `cli` nell'ordine giusto (pnpm risolve le dipendenze
`workspace:*` da solo).

## 3. Configura il server

```sh
cd packages/server
cp .env.example .env
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Copia l'output nella riga `ENVPULSE_MASTER_KEY=` dentro `.env`.

**Questa chiave cifra tutti i segreti a riposo. Se si perde, i segreti salvati sono
irrecuperabili per sempre.** Va salvata separatamente dal file del DB (password manager
aziendale, vault, ecc.), non solo su disco locale.

## 4. Avvia il server

Dalla root del repo:

```sh
pnpm dev
```

oppure in modalità "produzione" (usa il build già fatto invece di `tsx watch`):

```sh
cd packages/server && pnpm start
```

Al primo avvio stampa **una sola volta** il root token: va salvato subito, non verrà
mostrato di nuovo.

```
envp_root_...
```

## 5. Metti la CLI nel PATH

```sh
cd packages/cli
npm link
```

Crea il symlink globale `envpulse` → `packages/cli/bin/envpulse.js`. Da qualsiasi
cartella:

```sh
envpulse --help
```

## 6. Login

```sh
envpulse login --host http://localhost:8787 --token envp_root_...
envpulse whoami   # verifica
```
