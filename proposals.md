# Level 3 Proposal: Confidential Credentials

## Selected idea

Confidential Credentials - prove a credential is valid without disclosing it.

## Product

LicenseSeal MD is a privacy-preserving doctor-license registry on Midnight.

## Problem

Hospitals need to verify a clinician's license status, but they do not need full personal records, raw board secrets, or private credential material.

## Solution

LicenseSeal MD keeps credential secrets in the user's browser and on-chain private state. Hospitals verify only the status result. Boards can issue, renew, and revoke licenses without exposing private witness data.

## What is private

- Doctor secret material
- Board authorization witness
- Credential payload and nonce
- Proof challenge data used for short-lived verification

## What is public

- Credential status
- Issue and expiry dates
- Revocation history
- Contract address and verification result

## MVP Scope

- Board can create, update, and delete licenses.
- Doctor can generate a short-lived proof for verification.
- Hospital can check a credential without seeing private inputs.
- Frontend shows live registry state from preview network.

## Success Criteria

- Contract deployed on preview.
- Live app can issue, verify, renew, and revoke credentials.
- README includes setup, usage, privacy model, and demo links.
- CI runs compile, typecheck, lint, and tests.
