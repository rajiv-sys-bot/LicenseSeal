# LicenseSeal MD

[![CI](https://github.com/rajiv-sys-bot/LicenseSeal/actions/workflows/CI.yml/badge.svg?branch=main)](https://github.com/rajiv-sys-bot/LicenseSeal/actions/workflows/CI.yml)

Privacy-preserving doctor-license verification on Midnight `preview`. Doctors keep credential details private; hospitals see only license status, expiry, and verification result.

## Links

- Live app: https://license-seal-sigma.vercel.app/
- Video demo: https://drive.google.com/file/d/1NMiQzPdVNAz97yzxmqPD12EIg0DGU6SG/view?usp=sharing
- Contract explorer: https://preview.midnightexplorer.com/contracts/0xd5e2dc450d37260f6f43d4b15ab74f48e91dfd81497735506e27c0c3257d9b74
- Screenshot gallery: [Screenshots](#screenshots)

## Overview

LicenseSeal is a browser-based registry for medical licenses on Midnight.

- Doctors receive a private credential in browser.
- Boards issue, renew, and revoke licenses on chain.
- Hospitals verify status without collecting a personal file.
- All live data comes from the connected wallet and the indexer.

## Screenshots

<table>
  <tr>
    <td align="center"><strong>App home</strong><br /><code><img width="1876" height="1005" alt="image" src="https://github.com/user-attachments/assets/b15d3ef3-4949-4b57-9729-5325f03e2c52" /></code></td>
    <td align="center"><strong>Deploy flow</strong><br /><code><img width="1876" height="1005" alt="image" src="https://github.com/user-attachments/assets/b69efc33-8355-44a0-b3c5-2900fe20b995" /></code></td>
  </tr>
  <tr>
    <td align="center"><strong>Registry view</strong><br /><code><img width="1876" height="1005" alt="image" src="https://github.com/user-attachments/assets/677f1d19-a328-4014-bf0d-3c32d3703fe3" /></code></td>
    <td align="center"><strong>CI</strong><br /><code><img width="1876" height="1005" alt="image" src="https://github.com/user-attachments/assets/76a27a0d-6e6d-4a37-9c7f-858564c53528" /></code></td>
  </tr>
</table>

## How To Use

### 1. Set up

1. Install `Node.js 22+`.
2. Install the [1AM browser extension](https://1am.xyz).
3. Set wallet network to `preview`.
4. Ensure local proof server is available through wallet config.
5. Set `NEXT_PUBLIC_CONTRACT_ADDRESS` to deployed preview contract address.

### 2. Start app

```bash
npm ci
npm run contract:compile
npm run contract:sync-assets
npm run dev
```

Open `http://localhost:3000`.

### 3. Connect wallet

1. Click `Connect 1AM`.
2. Confirm wallet shows `preview`.
3. Wait for indexer data to load.

### 4. Issue license

1. Go to `Board registry`.
2. Click `Issue credential`.
3. Enter board secret.
4. If first board, enter registry owner secret too.
5. Submit transaction.

### 5. Verify license

1. Paste credential ID in `Verify`.
2. App reads live registry state from indexer.
3. Receipt shows status, board, expiry, and checked time.

### 6. Generate proof

1. Go to `Your credential`.
2. Click `Generate proof`.
3. App creates a short-lived proof URI for verifier.

## Transaction Flow

### Issue

1. User opens issue form.
2. App creates private credential material in browser.
3. 1AM signs, balances, and submits tx to `preview`.
4. App refreshes registry from indexer.

### Renew

1. Board enters board secret.
2. App rotates private credential and submits update tx.
3. Indexer refresh updates registry view.

### Revoke

1. Board enters board secret.
2. App submits revocation tx.
3. Indexer refresh marks credential revoked.

### Verify

1. App queries contract state through indexer.
2. Receipt is derived from on-chain state.
3. No dummy or sandbox data used.

## Privacy Model

- No server-side wallet.
- No server-side private credential storage.
- Owner secret stays local to browser and is shown only once after deploy.
- Board secret is required only for board-admin actions.
- Credential proof is short-lived and challenge-bound.
- Verification reads only public chain state.

## Contract Details

- Contract file: [contracts/doctor_license.compact](./contracts/doctor_license.compact)
- Managed bundle: [contracts/managed/doctor_license](./contracts/managed/doctor_license)
- Network: `preview`
- Wallet: `1AM`

Contract capabilities:

- `createBoard`
- `updateBoard`
- `deleteBoard`
- `createLicense`
- `updateLicense`
- `deleteLicense`
- `proveValidLicense`

## Architecture

1. `app/page.tsx` renders live registry UI.
2. `hooks/use-midnight-wallet.ts` handles wallet connection state.
3. `lib/midnight-browser.ts` connects wallet, builds providers, and submits tx.
4. `lib/midnight-read.ts` reads chain state from indexer.
5. `lib/doctor-license-client.ts` builds contract calls.
6. `app/api/license/route.ts` normalizes chain reads behind trusted endpoints.
7. `contracts/doctor_license.compact` defines chain rules.

## Repository Layout

- `app/` - Next.js app UI and API routes
- `contracts/` - Compact contract source and generated bundle
- `hooks/` - wallet hook
- `lib/` - wallet, chain read, and contract client helpers
- `public/zk/doctor_license/` - proving assets
- `tests/` - contract tests

## Commands

- `npm run contract:compile` - compile Compact contract.
- `npm run contract:sync-assets` - copy proof assets into `public/zk/doctor_license`.
- `npm run dev` - run local app.
- `npm run test` - run contract and app tests.
- `npm run typecheck` - TypeScript check.
- `npm run lint` - ESLint.
- `npm run build` - compile, sync assets, test, typecheck, and production build.

## Environment

- `NEXT_PUBLIC_CONTRACT_ADDRESS` - deployed preview contract address.

## Notes

- No seeded demo data remains in app.
- Live pages require contract address and connected 1AM wallet.
- Explorer/indexer is source of truth for registry views.
