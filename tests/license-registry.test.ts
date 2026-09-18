import { describe, expect, it } from "vitest";
import {
  issueLicense,
  renewLicense,
  revokeLicense,
  verifyCredential,
  type LicenseRecord,
} from "../lib/license-registry";

const base: LicenseRecord = {
  id: "a".repeat(64),
  doctorLabel: "Doctor A",
  board: "Board A",
  specialty: "Neurology",
  issuedAt: "2025-01-01",
  expiresAt: "2027-01-01",
  status: "valid",
};

describe("frontend license registry gateway", () => {
  it("returns valid, expired, revoked, and missing results", () => {
    expect(verifyCredential([base], base.id, new Date("2026-01-01")).status).toBe("valid");
    expect(verifyCredential([base], base.id, new Date("2028-01-01")).status).toBe("expired");
    expect(verifyCredential([{ ...base, status: "revoked" }], base.id).status).toBe("revoked");
    expect(verifyCredential([base], "b".repeat(64)).status).toBe("not-found");
  });

  it("validates issuance dates and duplicate IDs", () => {
    expect(() =>
      issueLicense([], { ...base, issuedAt: "2027-01-01", expiresAt: "2025-01-01" }, "b".repeat(64)),
    ).toThrow("Expiry must be after issue date");
    expect(() => issueLicense([base], base, base.id)).toThrow("Credential already exists");
  });

  it("renews active licenses and blocks revoked renewal", () => {
    expect(renewLicense([base], base.id, "2029-01-01")[0].expiresAt).toBe("2029-01-01");
    expect(() => renewLicense([{ ...base, status: "revoked" }], base.id, "2029-01-01")).toThrow(
      "Revoked credential cannot be renewed",
    );
  });

  it("revokes while preserving record", () => {
    const records = revokeLicense([base], base.id);
    expect(records).toHaveLength(1);
    expect(records[0].status).toBe("revoked");
  });
});
