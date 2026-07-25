export type LicenseStatus = "valid" | "expired" | "revoked";

export type LicenseRecord = {
  id: string;
  licenseNumber?: string;
  doctorLabel: string;
  board: string;
  specialty: string;
  issuedAt: string;
  expiresAt: string;
  status: LicenseStatus;
  privateCredential?: {
    payload: string;
    nonce: string;
    boardKey: string;
    doctorSecret: string;
  };
};

export type VerificationResult =
  | { found: false; status: "not-found" }
  | { found: true; status: LicenseStatus; record: LicenseRecord };

export function effectiveStatus(record: LicenseRecord, now = new Date()): LicenseStatus {
  if (record.status === "revoked") return "revoked";
  return new Date(`${record.expiresAt}T23:59:59Z`).getTime() < now.getTime()
    ? "expired"
    : "valid";
}

export function verifyCredential(
  records: LicenseRecord[],
  credentialId: string,
  now = new Date(),
): VerificationResult {
  const normalized = credentialId.trim().toLowerCase().replace(/^0x/, "");
  const record = records.find((entry) => entry.id.toLowerCase() === normalized);
  if (!record) return { found: false, status: "not-found" };
  return { found: true, status: effectiveStatus(record, now), record };
}

export function issueLicense(
  records: LicenseRecord[],
  input: Omit<LicenseRecord, "id" | "status">,
  id: string,
): LicenseRecord[] {
  if (records.some((record) => record.id === id)) throw new Error("Credential already exists.");
  if (new Date(input.expiresAt) <= new Date(input.issuedAt)) {
    throw new Error("Expiry must be after issue date.");
  }
  return [{ ...input, id, status: "valid" }, ...records];
}

export function renewLicense(
  records: LicenseRecord[],
  credentialId: string,
  expiresAt: string,
): LicenseRecord[] {
  const current = records.find((record) => record.id === credentialId);
  if (!current) throw new Error("Credential not found.");
  if (current.status === "revoked") throw new Error("Revoked credential cannot be renewed.");
  if (new Date(expiresAt) <= new Date(current.issuedAt)) {
    throw new Error("Expiry must be after issue date.");
  }
  return records.map((record) =>
    record.id === credentialId ? { ...record, expiresAt, status: "valid" } : record,
  );
}

export function revokeLicense(records: LicenseRecord[], credentialId: string): LicenseRecord[] {
  if (!records.some((record) => record.id === credentialId)) {
    throw new Error("Credential not found.");
  }
  return records.map((record) =>
    record.id === credentialId ? { ...record, status: "revoked" } : record,
  );
}

export function randomCredentialId(): string {
  const value = new Uint8Array(32);
  crypto.getRandomValues(value);
  return Array.from(value, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function shortId(id: string): string {
  return `${id.slice(0, 8)}…${id.slice(-6)}`;
}
