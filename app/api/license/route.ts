import { LICENSE_SEAL_CONTRACT_ADDRESS } from "@/lib/deployment";
import { readLicenseOnChain, readRegistryOnChain } from "@/lib/midnight-read";

type RequestBody = {
  mode?: unknown;
  credentialId?: unknown;
  indexerUri?: unknown;
  indexerWsUri?: unknown;
};

function trustedMidnightUrl(value: unknown, protocols: string[]): string {
  if (typeof value !== "string") throw new Error("Wallet indexer endpoint missing.");
  const url = new URL(value);
  const trustedHost = url.hostname === "localhost" || url.hostname.endsWith(".midnight.network");
  if (!trustedHost || !protocols.includes(url.protocol)) {
    throw new Error("Wallet returned untrusted indexer endpoint.");
  }
  return url.toString();
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as RequestBody;
    const contractAddress = LICENSE_SEAL_CONTRACT_ADDRESS;
    const indexerUri = trustedMidnightUrl(body.indexerUri, ["https:", "http:"]);
    const indexerWsUri = trustedMidnightUrl(body.indexerWsUri, ["wss:", "ws:"]);
    if (body.mode === "registry") {
      return Response.json(await readRegistryOnChain(contractAddress, indexerUri, indexerWsUri));
    }
    if (typeof body.credentialId !== "string") {
      return Response.json({ error: "Credential ID missing." }, { status: 400 });
    }
    const result = await readLicenseOnChain(
      contractAddress,
      indexerUri,
      indexerWsUri,
      body.credentialId,
    );
    return Response.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "License lookup failed.";
    return Response.json({ error: message }, { status: 400 });
  }
}
