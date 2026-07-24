"use client";

import { createCircuitCallTxInterface } from "@midnight-ntwrk/midnight-js-contracts";
import { Contract } from "../contracts/managed/doctor_license/contract/index.js";
import {
  createInitialPrivateState,
  createWitnesses,
  makeCompiledContract,
  PRIVATE_STATE_ID,
  type LicenseSealPrivateState,
} from "./deploy-doctor-license";
import { fromHex, toHex, type BrowserSession } from "./midnight-browser";

export type PrivateCredential = {
  payload: string;
  nonce: string;
  boardKey: string;
  doctorSecret: string;
};

type ContractInternals = {
  _boardKey_0(secret: Uint8Array): Uint8Array;
  _boardAuthorization_0(key: Uint8Array, secret: Uint8Array): Uint8Array;
  _licenseCommitment_0(payload: Uint8Array, nonce: Uint8Array, issuer: Uint8Array): Uint8Array;
};

type CallResult = { public?: { txId?: string } };
type CallInterface = Record<string, (...args: unknown[]) => Promise<CallResult>>;

function exactBytes(value: string, label: string): Uint8Array {
  const bytes = fromHex(value.trim());
  if (bytes.length !== 32) throw new Error(`${label} must contain 64 hexadecimal characters.`);
  return bytes;
}

function internals(): ContractInternals {
  return new Contract(createWitnesses()) as unknown as ContractInternals;
}

export function deriveBoardIdentity(boardSecretHex: string) {
  const secret = exactBytes(boardSecretHex, "Board secret");
  const key = internals()._boardKey_0(secret);
  const authorization = internals()._boardAuthorization_0(key, secret);
  return { key, authorization };
}

export async function createPrivateCredential(
  boardSecretHex: string,
  metadata: Record<string, string>,
): Promise<{ credentialId: string; privateCredential: PrivateCredential }> {
  const boardSecret = exactBytes(boardSecretHex, "Board secret");
  const boardKey = internals()._boardKey_0(boardSecret);
  const encoded = new TextEncoder().encode(JSON.stringify(metadata));
  const payload = new Uint8Array(await crypto.subtle.digest("SHA-256", encoded));
  const nonce = crypto.getRandomValues(new Uint8Array(32));
  const doctorSecret = crypto.getRandomValues(new Uint8Array(32));
  const credentialId = internals()._licenseCommitment_0(payload, nonce, boardKey);
  return {
    credentialId: toHex(credentialId),
    privateCredential: {
      payload: toHex(payload),
      nonce: toHex(nonce),
      boardKey: toHex(boardKey),
      doctorSecret: toHex(doctorSecret),
    },
  };
}

export function rotatePrivateCredential(privateCredential: PrivateCredential) {
  const nonce = crypto.getRandomValues(new Uint8Array(32));
  const credentialId = internals()._licenseCommitment_0(
    exactBytes(privateCredential.payload, "Credential payload"),
    nonce,
    exactBytes(privateCredential.boardKey, "Board key"),
  );
  return {
    credentialId: toHex(credentialId),
    privateCredential: { ...privateCredential, nonce: toHex(nonce) },
  };
}

async function callContract(
  session: BrowserSession,
  contractAddress: string,
  privateState: LicenseSealPrivateState,
  circuit: string,
  args: unknown[],
): Promise<string> {
  session.providers.privateStateProvider.setContractAddress(contractAddress);
  await session.providers.privateStateProvider.set(PRIVATE_STATE_ID, privateState);
  const createCalls = createCircuitCallTxInterface as unknown as (
    providers: unknown,
    compiledContract: unknown,
    address: string,
    privateStateId: string,
  ) => CallInterface;
  const result = await createCalls(
    session.providers,
    makeCompiledContract(),
    contractAddress,
    PRIVATE_STATE_ID,
  )[circuit](...args);
  return result.public?.txId ?? "submitted";
}

export async function registerBoardOnChain(
  session: BrowserSession,
  contractAddress: string,
  ownerSecretHex: string,
  boardSecretHex: string,
) {
  const ownerSecret = exactBytes(ownerSecretHex, "Owner secret");
  const boardSecret = exactBytes(boardSecretHex, "Board secret");
  const { key, authorization } = deriveBoardIdentity(boardSecretHex);
  const privateState = { ...createInitialPrivateState(ownerSecret), boardSecret };
  return callContract(session, contractAddress, privateState, "createBoard", [key, authorization]);
}

export async function issueLicenseOnChain(
  session: BrowserSession,
  contractAddress: string,
  boardSecretHex: string,
  credentialId: string,
  issuedAt: bigint,
  expiresAt: bigint,
) {
  const privateState = createInitialPrivateState(new Uint8Array(32));
  privateState.boardSecret = exactBytes(boardSecretHex, "Board secret");
  return callContract(session, contractAddress, privateState, "createLicense", [
    exactBytes(credentialId, "Credential ID"),
    issuedAt,
    expiresAt,
  ]);
}

export async function renewLicenseOnChain(
  session: BrowserSession,
  contractAddress: string,
  boardSecretHex: string,
  oldCredentialId: string,
  newCredentialId: string,
  issuedAt: bigint,
  expiresAt: bigint,
) {
  const privateState = createInitialPrivateState(new Uint8Array(32));
  privateState.boardSecret = exactBytes(boardSecretHex, "Board secret");
  return callContract(session, contractAddress, privateState, "updateLicense", [
    exactBytes(oldCredentialId, "Old credential ID"),
    exactBytes(newCredentialId, "New credential ID"),
    issuedAt,
    expiresAt,
  ]);
}

export async function revokeLicenseOnChain(
  session: BrowserSession,
  contractAddress: string,
  boardSecretHex: string,
  credentialId: string,
) {
  const privateState = createInitialPrivateState(new Uint8Array(32));
  privateState.boardSecret = exactBytes(boardSecretHex, "Board secret");
  return callContract(session, contractAddress, privateState, "deleteLicense", [
    exactBytes(credentialId, "Credential ID"),
  ]);
}

export async function proveLicenseOnChain(
  session: BrowserSession,
  contractAddress: string,
  privateCredential: PrivateCredential,
  credentialId: string,
  challenge: Uint8Array,
) {
  const privateState = createInitialPrivateState(new Uint8Array(32));
  privateState.credentialPayload = exactBytes(privateCredential.payload, "Credential payload");
  privateState.credentialNonce = exactBytes(privateCredential.nonce, "Credential nonce");
  privateState.credentialBoardKey = exactBytes(privateCredential.boardKey, "Board key");
  privateState.doctorSecret = exactBytes(privateCredential.doctorSecret, "Doctor secret");
  return callContract(session, contractAddress, privateState, "proveValidLicense", [
    exactBytes(credentialId, "Credential ID"),
    challenge,
    BigInt(Math.floor(Date.now() / 1000)),
  ]);
}
