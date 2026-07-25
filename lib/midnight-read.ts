import "server-only";
import { indexerPublicDataProvider } from "@midnight-ntwrk/midnight-js-indexer-public-data-provider";
import { setNetworkId } from "@midnight-ntwrk/midnight-js-network-id";
import { ledger } from "@/contracts/managed/doctor_license/contract/index.js";

export type OnChainLicense = {
  exists: boolean;
  revoked: boolean;
  issuedAt: number | null;
  expiresAt: number | null;
  valid: boolean;
  issuer: string | null;
};

export type OnChainRegistryRecord = OnChainLicense & { credentialId: string };

export type OnChainRegistry = {
  records: OnChainRegistryRecord[];
  boardCount: number;
  issuanceCount: number;
  activeLicenseCount: number;
  verificationCount: number;
  revocationCount: number;
};

const toHex = (value: Uint8Array) =>
  Array.from(value, (byte) => byte.toString(16).padStart(2, "0")).join("");

function fromHex(value: string): Uint8Array {
  const normalized = value.trim().toLowerCase().replace(/^0x/, "");
  if (!/^[0-9a-f]{64}$/.test(normalized)) {
    throw new Error("Credential ID must contain 64 hexadecimal characters.");
  }
  return Uint8Array.from(normalized.match(/.{2}/g)!, (byte) => Number.parseInt(byte, 16));
}

export async function readLicenseOnChain(
  contractAddress: string,
  indexerUri: string,
  indexerWsUri: string,
  credentialId: string,
): Promise<OnChainLicense> {
  setNetworkId("preview");
  const id = fromHex(credentialId);
  const provider = indexerPublicDataProvider(indexerUri, indexerWsUri);
  const state = await provider.queryContractState(contractAddress.replace(/^0x/, ""));
  if (!state) throw new Error("Contract not found on connected network.");
  const snapshot = ledger(state.data);
  const exists = snapshot.issuedLicenses.member(id);
  if (!exists) return { exists: false, revoked: false, issuedAt: null, expiresAt: null, valid: false, issuer: null };
  const revoked = snapshot.revokedLicenses.member(id);
  const issuedAt = Number(snapshot.licenseIssuedAt.lookup(id));
  const expiresAt = Number(snapshot.licenseExpiries.lookup(id));
  const issuerBytes = snapshot.licenseIssuers.lookup(id);
  const issuerTrusted = snapshot.trustedBoards.member(issuerBytes);
  return {
    exists,
    revoked,
    issuedAt,
    expiresAt,
    valid: !revoked && issuerTrusted && Math.floor(Date.now() / 1000) < expiresAt,
    issuer: toHex(issuerBytes),
  };
}

export async function readRegistryOnChain(
  contractAddress: string,
  indexerUri: string,
  indexerWsUri: string,
): Promise<OnChainRegistry> {
  setNetworkId("preview");
  const provider = indexerPublicDataProvider(indexerUri, indexerWsUri);
  const state = await provider.queryContractState(contractAddress.replace(/^0x/, ""));
  if (!state) throw new Error("Contract not found on connected network.");
  const snapshot = ledger(state.data);
  const now = Math.floor(Date.now() / 1000);
  const records = Array.from(snapshot.issuedLicenses, (id): OnChainRegistryRecord => {
    const revoked = snapshot.revokedLicenses.member(id);
    const issuedAt = Number(snapshot.licenseIssuedAt.lookup(id));
    const expiresAt = Number(snapshot.licenseExpiries.lookup(id));
    const issuerBytes = snapshot.licenseIssuers.lookup(id);
    return {
      credentialId: toHex(id),
      exists: true,
      revoked,
      issuedAt,
      expiresAt,
      valid: !revoked && snapshot.trustedBoards.member(issuerBytes) && now < expiresAt,
      issuer: toHex(issuerBytes),
    };
  });
  return {
    records,
    boardCount: Number(snapshot.boardCount),
    issuanceCount: Number(snapshot.issuanceCount),
    activeLicenseCount: Number(snapshot.activeLicenseCount),
    verificationCount: Number(snapshot.verificationCount),
    revocationCount: Number(snapshot.revocationCount),
  };
}
