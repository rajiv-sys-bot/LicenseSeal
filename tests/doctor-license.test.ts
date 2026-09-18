import { beforeEach, describe, expect, it } from "vitest";
import {
  createCircuitContext,
  createConstructorContext,
  sampleContractAddress,
  type CircuitResults,
} from "@midnight-ntwrk/compact-runtime";
import {
  Contract,
  ledger,
  type Witnesses,
} from "../contracts/managed/doctor_license/contract/index.js";

type PrivateState = {
  ownerSecret: Uint8Array;
  boardSecret: Uint8Array;
  doctorSecret: Uint8Array;
  credentialPayload: Uint8Array;
  credentialNonce: Uint8Array;
  credentialBoardKey: Uint8Array;
};

const bytes = (seed: number): Uint8Array => new Uint8Array(32).fill(seed);

function witnesses(): Witnesses<PrivateState> {
  return {
    ownerSecret: (ctx) => [ctx.privateState, ctx.privateState.ownerSecret],
    boardSecret: (ctx) => [ctx.privateState, ctx.privateState.boardSecret],
    doctorSecret: (ctx) => [ctx.privateState, ctx.privateState.doctorSecret],
    credentialPayload: (ctx) => [ctx.privateState, ctx.privateState.credentialPayload],
    credentialNonce: (ctx) => [ctx.privateState, ctx.privateState.credentialNonce],
    credentialBoardKey: (ctx) => [ctx.privateState, ctx.privateState.credentialBoardKey],
  };
}

function createHarness() {
  const state: PrivateState = {
    ownerSecret: bytes(1),
    boardSecret: bytes(2),
    doctorSecret: bytes(3),
    credentialPayload: bytes(4),
    credentialNonce: bytes(5),
    credentialBoardKey: bytes(0),
  };
  const contract = new Contract(witnesses());
  const initial = contract.initialState(createConstructorContext(state, "00".repeat(32)));
  let context = createCircuitContext(
    sampleContractAddress(),
    "00".repeat(32),
    initial.currentContractState,
    state,
  );

  const internal = contract as unknown as {
    _boardKey_0(secret: Uint8Array): Uint8Array;
    _boardAuthorization_0(key: Uint8Array, secret: Uint8Array): Uint8Array;
    _licenseCommitment_0(payload: Uint8Array, nonce: Uint8Array, issuer: Uint8Array): Uint8Array;
    _proofNullifier_0(id: Uint8Array, challenge: Uint8Array, doctor: Uint8Array): Uint8Array;
  };

  function run<T>(call: (ctx: typeof context) => CircuitResults<PrivateState, T>): T {
    const output = call(context);
    context = output.context;
    return output.result;
  }

  const view = () => ledger(context.currentQueryContext.state);
  const boardKey = () => internal._boardKey_0(state.boardSecret);
  const boardAuth = () => internal._boardAuthorization_0(boardKey(), state.boardSecret);
  const credentialId = () =>
    internal._licenseCommitment_0(state.credentialPayload, state.credentialNonce, boardKey());

  return { contract, state, internal, run, view, boardKey, boardAuth, credentialId };
}

type Harness = ReturnType<typeof createHarness>;

function registerBoard(h: Harness) {
  const key = h.boardKey();
  const auth = h.boardAuth();
  h.run((ctx) => h.contract.circuits.createBoard(ctx, key, auth));
  h.state.credentialBoardKey = key;
  return { key, auth };
}

function isLicenseValid(h: Harness, credentialId: Uint8Array, currentTime: bigint) {
  const snapshot = h.view();
  if (!snapshot.issuedLicenses.member(credentialId)) return false;
  if (snapshot.revokedLicenses.member(credentialId)) return false;
  if (!snapshot.trustedBoards.member(snapshot.licenseIssuers.lookup(credentialId))) return false;
  return currentTime < snapshot.licenseExpiries.lookup(credentialId);
}

describe("doctor license Compact contract", () => {
  let h: Harness;

  beforeEach(() => {
    h = createHarness();
  });

  it("starts with empty registries and zero counters", () => {
    expect(h.view().trustedBoards.size()).toBe(0n);
    expect(h.view().boardCount).toBe(0n);
    expect(h.view().activeLicenseCount).toBe(0n);
  });

  it("supports board create, authorization update, and delete", () => {
    const { key, auth } = registerBoard(h);
    expect(h.view().trustedBoards.member(key)).toBe(true);

    const replacement = bytes(9);
    h.run((ctx) => h.contract.circuits.updateBoard(ctx, key, auth, replacement));
    expect(h.view().boardAuthorizations.member(auth)).toBe(false);
    expect(h.view().boardAuthorizations.member(replacement)).toBe(true);

    h.run((ctx) => h.contract.circuits.deleteBoard(ctx, key, replacement));
    expect(h.view().trustedBoards.member(key)).toBe(false);
    expect(h.view().boardCount).toBe(0n);
  });

  it("rejects unauthorized owner and duplicate board writes", () => {
    const { key, auth } = registerBoard(h);
    expect(() => h.run((ctx) => h.contract.circuits.createBoard(ctx, key, auth))).toThrow(
      "board already exists",
    );
    h.state.ownerSecret = bytes(99);
    expect(() =>
      h.run((ctx) => h.contract.circuits.deleteBoard(ctx, key, auth)),
    ).toThrow("only registry owner");
  });

  it("creates license and exposes instant status and dates", () => {
    registerBoard(h);
    const id = h.credentialId();
    h.run((ctx) => h.contract.circuits.createLicense(ctx, id, 1_700_000_000n, 1_800_000_000n));

    expect(h.view().issuedLicenses.member(id)).toBe(true);
    expect(h.view().licenseIssuedAt.lookup(id)).toBe(1_700_000_000n);
    expect(h.view().licenseExpiries.lookup(id)).toBe(1_800_000_000n);
    expect(h.view().licenseIssuers.lookup(id)).toEqual(h.boardKey());
    expect(isLicenseValid(h, id, 1_750_000_000n)).toBe(true);
    expect(isLicenseValid(h, id, 1_800_000_000n)).toBe(false);
    expect(h.view().issuanceCount).toBe(1n);
  });

  it("invalidates hospital status when issuing board loses trust", () => {
    const { key, auth } = registerBoard(h);
    const id = h.credentialId();
    h.run((ctx) => h.contract.circuits.createLicense(ctx, id, 100n, 300n));
    h.run((ctx) => h.contract.circuits.deleteBoard(ctx, key, auth));
    expect(isLicenseValid(h, id, 200n)).toBe(false);
  });

  it("rejects invalid dates, duplicate credentials, and untrusted issuers", () => {
    registerBoard(h);
    const id = h.credentialId();
    expect(() =>
      h.run((ctx) => h.contract.circuits.createLicense(ctx, id, 20n, 20n)),
    ).toThrow("expiry must be after issue time");

    h.run((ctx) => h.contract.circuits.createLicense(ctx, id, 10n, 20n));
    expect(() =>
      h.run((ctx) => h.contract.circuits.createLicense(ctx, id, 10n, 20n)),
    ).toThrow("license already exists");

    h.state.boardSecret = bytes(44);
    expect(() =>
      h.run((ctx) => h.contract.circuits.createLicense(ctx, bytes(45), 10n, 20n)),
    ).toThrow("board is not trusted");
  });

  it("atomically updates a license while preserving revoked history", () => {
    registerBoard(h);
    const oldId = h.credentialId();
    h.run((ctx) => h.contract.circuits.createLicense(ctx, oldId, 100n, 200n));
    const newId = bytes(12);
    h.run((ctx) => h.contract.circuits.updateLicense(ctx, oldId, newId, 150n, 300n));

    expect(h.view().revokedLicenses.member(oldId)).toBe(true);
    expect(isLicenseValid(h, oldId, 160n)).toBe(false);
    expect(isLicenseValid(h, newId, 160n)).toBe(true);
    expect(h.view().activeLicenseCount).toBe(1n);
    expect(h.view().revocationCount).toBe(1n);
  });

  it("revokes only licenses owned by authenticated issuing board", () => {
    registerBoard(h);
    const id = h.credentialId();
    h.run((ctx) => h.contract.circuits.createLicense(ctx, id, 100n, 200n));

    h.state.boardSecret = bytes(8);
    const otherKey = h.boardKey();
    const otherAuth = h.boardAuth();
    h.state.ownerSecret = bytes(1);
    h.run((ctx) => h.contract.circuits.createBoard(ctx, otherKey, otherAuth));
    expect(() => h.run((ctx) => h.contract.circuits.deleteLicense(ctx, id))).toThrow(
      "board did not issue license",
    );

    h.state.boardSecret = bytes(2);
    h.run((ctx) => h.contract.circuits.deleteLicense(ctx, id));
    expect(h.view().revokedLicenses.member(id)).toBe(true);
    expect(h.view().activeLicenseCount).toBe(0n);
  });

  it("proves private credential, prevents replay, and counts verification", () => {
    const { key } = registerBoard(h);
    const id = h.credentialId();
    h.run((ctx) => h.contract.circuits.createLicense(ctx, id, 100n, 300n));
    h.state.credentialBoardKey = key;
    const challenge = bytes(21);
    const nullifier = h.internal._proofNullifier_0(id, challenge, h.state.doctorSecret);

    h.run((ctx) => h.contract.circuits.proveValidLicense(ctx, id, challenge, 200n));
    expect(h.view().usedProofs.member(nullifier)).toBe(true);
    expect(h.view().verificationCount).toBe(1n);
    expect(() =>
      h.run((ctx) => h.contract.circuits.proveValidLicense(ctx, id, challenge, 200n)),
    ).toThrow("proof challenge already used");
  });

  it("rejects expired, revoked, or mismatched private credentials", () => {
    registerBoard(h);
    const id = h.credentialId();
    h.run((ctx) => h.contract.circuits.createLicense(ctx, id, 100n, 200n));

    expect(() =>
      h.run((ctx) => h.contract.circuits.proveValidLicense(ctx, id, bytes(31), 200n)),
    ).toThrow("license expired");

    h.state.credentialPayload = bytes(77);
    expect(() =>
      h.run((ctx) => h.contract.circuits.proveValidLicense(ctx, id, bytes(32), 150n)),
    ).toThrow("private credential does not match ID");

    h.state.credentialPayload = bytes(4);
    h.run((ctx) => h.contract.circuits.deleteLicense(ctx, id));
    expect(() =>
      h.run((ctx) => h.contract.circuits.proveValidLicense(ctx, id, bytes(33), 150n)),
    ).toThrow("license revoked");
  });
});
