"use client";

import { CompiledContract } from "@midnight-ntwrk/compact-js";
import { sampleSigningKey } from "@midnight-ntwrk/compact-runtime";
import { createUnprovenDeployTx, submitTxAsync } from "@midnight-ntwrk/midnight-js-contracts";
import { setNetworkId } from "@midnight-ntwrk/midnight-js-network-id";
import { Contract, type Witnesses } from "../contracts/managed/doctor_license/contract/index.js";
import { MIDNIGHT_NETWORK, type BrowserSession } from "./midnight-browser";

const CONTRACT_NAME = "doctor_license";
export const PRIVATE_STATE_ID = "licenseSealPrivateState";
const ZK_ASSET_PATH = "/zk/doctor_license/";

export type LicenseSealPrivateState = {
  ownerSecret: Uint8Array;
  boardSecret: Uint8Array;
  doctorSecret: Uint8Array;
  credentialPayload: Uint8Array;
  credentialNonce: Uint8Array;
  credentialBoardKey: Uint8Array;
};

type DeployTxData = {
  public: { contractAddress: string };
  private: {
    unprovenTx: unknown;
    initialPrivateState: LicenseSealPrivateState;
    signingKey?: unknown;
  };
};

export function createInitialPrivateState(ownerSecret: Uint8Array): LicenseSealPrivateState {
  if (ownerSecret.length !== 32) throw new Error("Owner secret must be 32 bytes.");
  return {
    ownerSecret,
    boardSecret: new Uint8Array(32),
    doctorSecret: new Uint8Array(32),
    credentialPayload: new Uint8Array(32),
    credentialNonce: new Uint8Array(32),
    credentialBoardKey: new Uint8Array(32),
  };
}

export function createWitnesses(): Witnesses<LicenseSealPrivateState> {
  return {
    ownerSecret: (context) => [context.privateState, context.privateState.ownerSecret],
    boardSecret: (context) => [context.privateState, context.privateState.boardSecret],
    doctorSecret: (context) => [context.privateState, context.privateState.doctorSecret],
    credentialPayload: (context) => [context.privateState, context.privateState.credentialPayload],
    credentialNonce: (context) => [context.privateState, context.privateState.credentialNonce],
    credentialBoardKey: (context) => [context.privateState, context.privateState.credentialBoardKey],
  };
}

export function makeCompiledContract() {
  return CompiledContract.make(CONTRACT_NAME, Contract).pipe(
    CompiledContract.withWitnesses(createWitnesses()),
    CompiledContract.withCompiledFileAssets(ZK_ASSET_PATH),
  );
}

export async function deployDoctorLicense(
  session: BrowserSession,
  ownerSecret: Uint8Array,
): Promise<{ contractAddress: string; transactionId: string }> {
  setNetworkId(MIDNIGHT_NETWORK);
  const initialPrivateState = createInitialPrivateState(ownerSecret);
  const signingKey = sampleSigningKey();
  const createDeploy = createUnprovenDeployTx as unknown as (
    providers: unknown,
    options: unknown,
  ) => Promise<DeployTxData>;
  const deployTxData = await createDeploy(
    {
      zkConfigProvider: session.providers.zkConfigProvider,
      walletProvider: session.providers.walletProvider,
    },
    {
      compiledContract: makeCompiledContract(),
      args: [],
      privateStateId: PRIVATE_STATE_ID,
      initialPrivateState,
      signingKey,
    },
  );
  const contractAddress = String(deployTxData.public.contractAddress);
  const submit = submitTxAsync as unknown as (
    providers: unknown,
    options: { unprovenTx: unknown },
  ) => Promise<string>;
  const transactionId = String(await submit(session.providers, {
    unprovenTx: deployTxData.private.unprovenTx,
  }));

  session.providers.privateStateProvider.setContractAddress(contractAddress);
  await session.providers.privateStateProvider.set(PRIVATE_STATE_ID, deployTxData.private.initialPrivateState);
  await session.providers.privateStateProvider.setSigningKey(
    contractAddress,
    deployTxData.private.signingKey ?? signingKey,
  );

  return { contractAddress, transactionId };
}
