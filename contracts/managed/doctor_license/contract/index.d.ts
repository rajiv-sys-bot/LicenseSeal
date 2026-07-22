import type * as __compactRuntime from '@midnight-ntwrk/compact-runtime';

export type Witnesses<PS> = {
  ownerSecret(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, Uint8Array];
  boardSecret(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, Uint8Array];
  doctorSecret(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, Uint8Array];
  credentialPayload(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, Uint8Array];
  credentialNonce(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, Uint8Array];
  credentialBoardKey(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, Uint8Array];
}

export type ImpureCircuits<PS> = {
  createBoard(context: __compactRuntime.CircuitContext<PS>,
              key_0: Uint8Array,
              authorization_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  updateBoard(context: __compactRuntime.CircuitContext<PS>,
              key_0: Uint8Array,
              oldAuthorization_0: Uint8Array,
              newAuthorization_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  deleteBoard(context: __compactRuntime.CircuitContext<PS>,
              key_0: Uint8Array,
              authorization_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  createLicense(context: __compactRuntime.CircuitContext<PS>,
                credentialId_0: Uint8Array,
                issuedAt_0: bigint,
                expiresAt_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  updateLicense(context: __compactRuntime.CircuitContext<PS>,
                oldCredentialId_0: Uint8Array,
                newCredentialId_0: Uint8Array,
                issuedAt_0: bigint,
                expiresAt_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  deleteLicense(context: __compactRuntime.CircuitContext<PS>,
                credentialId_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  proveValidLicense(context: __compactRuntime.CircuitContext<PS>,
                    credentialId_0: Uint8Array,
                    hospitalChallenge_0: Uint8Array,
                    currentTime_0: bigint): __compactRuntime.CircuitResults<PS, []>;
}

export type ProvableCircuits<PS> = {
  createBoard(context: __compactRuntime.CircuitContext<PS>,
              key_0: Uint8Array,
              authorization_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  updateBoard(context: __compactRuntime.CircuitContext<PS>,
              key_0: Uint8Array,
              oldAuthorization_0: Uint8Array,
              newAuthorization_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  deleteBoard(context: __compactRuntime.CircuitContext<PS>,
              key_0: Uint8Array,
              authorization_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  createLicense(context: __compactRuntime.CircuitContext<PS>,
                credentialId_0: Uint8Array,
                issuedAt_0: bigint,
                expiresAt_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  updateLicense(context: __compactRuntime.CircuitContext<PS>,
                oldCredentialId_0: Uint8Array,
                newCredentialId_0: Uint8Array,
                issuedAt_0: bigint,
                expiresAt_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  deleteLicense(context: __compactRuntime.CircuitContext<PS>,
                credentialId_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  proveValidLicense(context: __compactRuntime.CircuitContext<PS>,
                    credentialId_0: Uint8Array,
                    hospitalChallenge_0: Uint8Array,
                    currentTime_0: bigint): __compactRuntime.CircuitResults<PS, []>;
}

export type PureCircuits = {
}

export type Circuits<PS> = {
  createBoard(context: __compactRuntime.CircuitContext<PS>,
              key_0: Uint8Array,
              authorization_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  updateBoard(context: __compactRuntime.CircuitContext<PS>,
              key_0: Uint8Array,
              oldAuthorization_0: Uint8Array,
              newAuthorization_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  deleteBoard(context: __compactRuntime.CircuitContext<PS>,
              key_0: Uint8Array,
              authorization_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  createLicense(context: __compactRuntime.CircuitContext<PS>,
                credentialId_0: Uint8Array,
                issuedAt_0: bigint,
                expiresAt_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  updateLicense(context: __compactRuntime.CircuitContext<PS>,
                oldCredentialId_0: Uint8Array,
                newCredentialId_0: Uint8Array,
                issuedAt_0: bigint,
                expiresAt_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  deleteLicense(context: __compactRuntime.CircuitContext<PS>,
                credentialId_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  proveValidLicense(context: __compactRuntime.CircuitContext<PS>,
                    credentialId_0: Uint8Array,
                    hospitalChallenge_0: Uint8Array,
                    currentTime_0: bigint): __compactRuntime.CircuitResults<PS, []>;
}

export type Ledger = {
  readonly registryOwner: Uint8Array;
  trustedBoards: {
    isEmpty(): boolean;
    size(): bigint;
    member(elem_0: Uint8Array): boolean;
    [Symbol.iterator](): Iterator<Uint8Array>
  };
  boardAuthorizations: {
    isEmpty(): boolean;
    size(): bigint;
    member(elem_0: Uint8Array): boolean;
    [Symbol.iterator](): Iterator<Uint8Array>
  };
  issuedLicenses: {
    isEmpty(): boolean;
    size(): bigint;
    member(elem_0: Uint8Array): boolean;
    [Symbol.iterator](): Iterator<Uint8Array>
  };
  revokedLicenses: {
    isEmpty(): boolean;
    size(): bigint;
    member(elem_0: Uint8Array): boolean;
    [Symbol.iterator](): Iterator<Uint8Array>
  };
  licenseOwnerships: {
    isEmpty(): boolean;
    size(): bigint;
    member(elem_0: Uint8Array): boolean;
    [Symbol.iterator](): Iterator<Uint8Array>
  };
  usedProofs: {
    isEmpty(): boolean;
    size(): bigint;
    member(elem_0: Uint8Array): boolean;
    [Symbol.iterator](): Iterator<Uint8Array>
  };
  licenseExpiries: {
    isEmpty(): boolean;
    size(): bigint;
    member(key_0: Uint8Array): boolean;
    lookup(key_0: Uint8Array): bigint;
    [Symbol.iterator](): Iterator<[Uint8Array, bigint]>
  };
  licenseIssuedAt: {
    isEmpty(): boolean;
    size(): bigint;
    member(key_0: Uint8Array): boolean;
    lookup(key_0: Uint8Array): bigint;
    [Symbol.iterator](): Iterator<[Uint8Array, bigint]>
  };
  licenseIssuers: {
    isEmpty(): boolean;
    size(): bigint;
    member(key_0: Uint8Array): boolean;
    lookup(key_0: Uint8Array): Uint8Array;
    [Symbol.iterator](): Iterator<[Uint8Array, Uint8Array]>
  };
  readonly boardCount: bigint;
  readonly issuanceCount: bigint;
  readonly activeLicenseCount: bigint;
  readonly verificationCount: bigint;
  readonly revocationCount: bigint;
}

export type ContractReferenceLocations = any;

export declare const contractReferenceLocations : ContractReferenceLocations;

export declare class Contract<PS = any, W extends Witnesses<PS> = Witnesses<PS>> {
  witnesses: W;
  circuits: Circuits<PS>;
  impureCircuits: ImpureCircuits<PS>;
  provableCircuits: ProvableCircuits<PS>;
  constructor(witnesses: W);
  initialState(context: __compactRuntime.ConstructorContext<PS>): __compactRuntime.ConstructorResult<PS>;
}

export declare function ledger(state: __compactRuntime.StateValue | __compactRuntime.ChargedState): Ledger;
export declare const pureCircuits: PureCircuits;
