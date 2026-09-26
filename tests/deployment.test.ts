import { describe, expect, it } from "vitest";
import {
  LICENSE_SEAL_CONTRACT_ADDRESS,
  LICENSE_SEAL_CONTRACT_EXPLORER_URL,
} from "../lib/deployment";

describe("Preprod deployment config", () => {
  it("uses the deployed LicenseSeal contract", () => {
    expect(LICENSE_SEAL_CONTRACT_ADDRESS).toBe(
      "649571d22e3ded01e26f0400099e7629fbac6d9e871d4240d50241dffe47342a",
    );
    expect(LICENSE_SEAL_CONTRACT_ADDRESS).toMatch(/^[0-9a-f]{64}$/);
    expect(LICENSE_SEAL_CONTRACT_EXPLORER_URL).toBe(
      `https://preprod.midnightexplorer.com/contracts/0x${LICENSE_SEAL_CONTRACT_ADDRESS}`,
    );
  });
});
