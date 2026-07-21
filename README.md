# LicenseSeal MD

Privacy-preserving doctor-license verification on Midnight preview. Doctors keep credential details private; hospitals receive license status and expiry without collecting personal files.

## Browser deployment

Deployment follows the 1AM reference flow from Midnight docs:

1. App explicitly selects Midnight `preview`.
2. Browser connects to injected 1AM extension.
3. Runtime service URLs come from 1AM `getConfiguration()`.
4. Compiled ZK assets load from `/public/zk/doctor_license`.
5. 1AM supplies proving provider through `getProvingProvider()`.
6. Browser builds deployment with `createUnprovenDeployTx`.
7. 1AM balances and submits transaction through `submitTxAsync`.
8. `/deploy` displays contract address and transaction ID, then waits for indexer confirmation.

No funded server wallet is used. No server deployment script exists. Main flow does require a local proof server for 1AM proving.

## Prerequisites

- Node.js 22+
- [1AM browser extension](https://1am.xyz), configured for preview and local proof server
- Compact CLI only when recompiling contract

Install Compact CLI:

```bash
curl --proto '=https' --tlsv1.2 -sSf \
  https://github.com/midnightntwrk/compact/releases/latest/download/compact-installer.sh | sh
```

## Run and deploy

```bash
npm ci
npm run contract:compile
npm run contract:sync-assets
npm run dev
```

Open [http://localhost:3000/deploy](http://localhost:3000/deploy):

1. Connect 1AM.
2. Confirm page reports preview.
3. Select **Deploy LicenseSeal contract**.
4. Approve 1AM prompts.
5. Copy displayed contract address and owner secret.

Owner secret is generated only in browser and shown after deployment. Save it securely; contract needs it for board administration.

To enable live hospital lookup after deployment, create `.env.local`:

```bash
NEXT_PUBLIC_CONTRACT_ADDRESS=<displayed-contract-address>
```

Restart development server after changing public environment variable.

## Commands

- `npm run contract:compile` — compile Compact contract with 0.31.1.
- `npm run contract:sync-assets` — copy generated proving assets into browser-served path.
- `npm test` — run compiled-contract simulator and frontend domain tests.
- `npm run typecheck` — strict TypeScript check.
- `npm run lint` — ESLint.
- `npm run build` — compile, sync assets, test, typecheck, and production build using webpack.

## Structure

- `contracts/doctor_license.compact` — board CRUD, license CRUD, and private challenge proof. Public reads use indexed ledger state to keep deployment below block limits.
- `contracts/managed/doctor_license` — generated bundle; requires `@midnight-ntwrk/compact-runtime` 0.16.0.
- `lib/midnight-browser.ts` — 1AM detection, preview session, providers, wallet balancing/submission, indexer patch.
- `lib/deploy-doctor-license.ts` — browser-only deployment transaction.
- `app/deploy` — deployment UI with persistent public contract address.
- `public/zk/doctor_license` — browser proving assets.
- `.github/workflows/CI.yml` — frontend and contract verification.
