import { describe, expect, it } from "vitest";
import { createInitialPrivateState } from "../lib/deploy-doctor-license";

describe("browser deployment private state", () => {
  it("preserves browser-generated owner secret and zeroes unused witnesses", () => {
    const ownerSecret = new Uint8Array(32).fill(7);
    const state = createInitialPrivateState(ownerSecret);

    expect(state.ownerSecret).toEqual(ownerSecret);
    expect(state.boardSecret).toEqual(new Uint8Array(32));
    expect(state.doctorSecret).toEqual(new Uint8Array(32));
    expect(state.credentialPayload).toEqual(new Uint8Array(32));
  });

  it("rejects malformed owner secrets before deployment", () => {
    expect(() => createInitialPrivateState(new Uint8Array(31))).toThrow(
      "Owner secret must be 32 bytes",
    );
  });
});
