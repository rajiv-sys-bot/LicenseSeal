"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import {
  Check,
  CircleAlert,
  Clipboard,
  Plus,
  RefreshCw,
  Search,
  Unplug,
  WalletCards,
  X,
} from "lucide-react";
import { useMidnightWallet } from "@/hooks/use-midnight-wallet";
import {
  effectiveStatus,
  shortId,
  type LicenseRecord,
  type LicenseStatus,
  type VerificationResult,
} from "@/lib/license-registry";
import {
  createPrivateCredential,
  issueLicenseOnChain,
  proveLicenseOnChain,
  registerBoardOnChain,
  renewLicenseOnChain,
  revokeLicenseOnChain,
  rotatePrivateCredential,
} from "@/lib/doctor-license-client";
import { toHex } from "@/lib/midnight-browser";
import type { OnChainLicense, OnChainRegistry } from "@/lib/midnight-read";

type Workspace = "verify" | "doctor" | "board";
type SealPhase = "idle" | "verifying" | "landed";
type CheckEntry = {
  credentialId: string;
  licenseNumber: string;
  status: LicenseStatus | "not-found";
  board: string;
  expiresAt: string;
  checkedAt: string;
};

const STORAGE_KEY = "licenseseal:licenses:v1";
const HISTORY_KEY = "licenseseal:check-history:v1";
const PROOF_LIFETIME = 120;
const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS?.trim() ?? "";

const formatDate = (value: string) =>
  new Intl.DateTimeFormat("en", { month: "short", day: "2-digit", year: "numeric" }).format(
    new Date(`${value}T00:00:00Z`),
  );

const formatTimestamp = (value: string) =>
  new Intl.DateTimeFormat("en", {
    month: "short",
    day: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(value));

const unixDate = (value: number | null) =>
  value ? new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(value * 1000)) : "—";

function extractCredentialId(value: string) {
  return value.match(/[0-9a-fA-F]{64}/)?.[0] ?? value.trim();
}

function serialFor(record: LicenseRecord | null, credentialId: string) {
  return record?.licenseNumber ?? `MD-${credentialId.slice(0, 4).toUpperCase()}-${credentialId.slice(-4).toUpperCase()}`;
}

export default function Home() {
  const wallet = useMidnightWallet();
  const liveMode = Boolean(CONTRACT_ADDRESS);
  const [workspace, setWorkspace] = useState<Workspace>("verify");
  const [records, setRecords] = useState<LicenseRecord[]>([]);
  const [credentialId, setCredentialId] = useState("");
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [chainResult, setChainResult] = useState<OnChainLicense | null>(null);
  const [checkedAt, setCheckedAt] = useState("");
  const [history, setHistory] = useState<CheckEntry[]>([]);
  const [sealPhase, setSealPhase] = useState<SealPhase>("idle");
  const [notice, setNotice] = useState<string | null>(null);
  const [proof, setProof] = useState<string | null>(null);
  const [proofRecordId, setProofRecordId] = useState("");
  const [proofExpiresAt, setProofExpiresAt] = useState<number | null>(null);
  const [proofRemaining, setProofRemaining] = useState(PROOF_LIFETIME);
  const [busy, setBusy] = useState(false);
  const [showIssue, setShowIssue] = useState(false);
  const [issueError, setIssueError] = useState<string | null>(null);
  const [registry, setRegistry] = useState<OnChainRegistry | null>(null);
  const [registryLoading, setRegistryLoading] = useState(false);
  const [renderTime] = useState(() => new Date());

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    const savedHistory = window.localStorage.getItem(HISTORY_KEY);
    if (saved) {
      try {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setRecords(JSON.parse(saved) as LicenseRecord[]);
      } catch {
        window.localStorage.removeItem(STORAGE_KEY);
      }
    }
    if (savedHistory) {
      try {
        setHistory(JSON.parse(savedHistory) as CheckEntry[]);
      } catch {
        window.localStorage.removeItem(HISTORY_KEY);
      }
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  }, [records]);

  useEffect(() => {
    if (history.length) window.localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  }, [history]);

  useEffect(() => {
    if (!proofExpiresAt) return;
    const timer = window.setInterval(() => {
      const remaining = Math.max(0, Math.ceil((proofExpiresAt - Date.now()) / 1000));
      setProofRemaining(remaining);
      if (remaining === 0) {
        setProof(null);
        setProofExpiresAt(null);
        setNotice("Proof expired. Generate a new proof when requested.");
      }
    }, 1000);
    return () => window.clearInterval(timer);
  }, [proofExpiresAt]);

  const chainRecords = useMemo(() => {
    if (!liveMode) return [];
    return (registry?.records ?? []).map((chain): LicenseRecord => {
      const local = records.find((record) => record.id === chain.credentialId);
      return {
        id: chain.credentialId,
        doctorLabel: local?.doctorLabel ?? "Private license holder",
        licenseNumber: local?.licenseNumber,
        board: local?.board ?? (chain.issuer ? `Board ${shortId(chain.issuer)}` : "Committed authority"),
        specialty: local?.specialty ?? "Private",
        issuedAt: new Date((chain.issuedAt ?? 0) * 1000).toISOString().slice(0, 10),
        expiresAt: new Date((chain.expiresAt ?? 0) * 1000).toISOString().slice(0, 10),
        status: chain.revoked ? "revoked" : chain.valid ? "valid" : "expired",
        privateCredential: local?.privateCredential,
      };
    });
  }, [liveMode, records, registry]);

  const stats = useMemo(() => {
    return {
      active: registry?.activeLicenseCount ?? 0,
      expiring: chainRecords.filter((record) => {
        const days = (new Date(record.expiresAt).getTime() - renderTime.getTime()) / 86_400_000;
        return days >= 0 && days <= 120 && record.status !== "revoked";
      }).length,
      checks: registry?.verificationCount ?? 0,
    };
  }, [chainRecords, registry, renderTime]);

  const doctorRecords = chainRecords.filter((record) => record.privateCredential);
  const proofRecord = doctorRecords.find((record) => record.id === proofRecordId) ?? doctorRecords[0];

  const refreshRegistry = useCallback(async () => {
    if (!wallet.indexerUri || !wallet.indexerWsUri) return;
    setRegistryLoading(true);
    try {
      const response = await fetch("/api/license", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          mode: "registry",
          indexerUri: wallet.indexerUri,
          indexerWsUri: wallet.indexerWsUri,
        }),
      });
      const payload = (await response.json()) as OnChainRegistry & { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Registry load failed.");
      setRegistry(payload);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Registry load failed.");
    } finally {
      setRegistryLoading(false);
    }
  }, [wallet.indexerUri, wallet.indexerWsUri]);

  useEffect(() => {
    if (!liveMode || !wallet.connected || !wallet.indexerUri || !wallet.indexerWsUri) return;
    const timer = window.setTimeout(() => {
      void refreshRegistry();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [liveMode, refreshRegistry, wallet.connected, wallet.indexerUri, wallet.indexerWsUri]);

  useEffect(() => {
    if (!liveMode || !wallet.connected || !wallet.indexerUri || !wallet.indexerWsUri) return;
    const timer = window.setInterval(() => {
      void refreshRegistry();
    }, 30000);
    return () => window.clearInterval(timer);
  }, [liveMode, refreshRegistry, wallet.connected, wallet.indexerUri, wallet.indexerWsUri]);

  async function verify(event: FormEvent) {
    event.preventDefault();
    const normalizedId = extractCredentialId(credentialId);
    setBusy(true);
    setNotice(null);
    setResult(null);
    setChainResult(null);
    setCheckedAt("");
    setSealPhase("verifying");

    try {
      if (!liveMode) throw new Error("Set NEXT_PUBLIC_CONTRACT_ADDRESS to use live registry data.");
      if (!wallet.connected || !wallet.indexerUri || !wallet.indexerWsUri) {
            throw new Error("Connect 1AM to query live preview registry data.");
      }
      const response = await fetch("/api/license", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          credentialId: normalizedId,
          indexerUri: wallet.indexerUri,
          indexerWsUri: wallet.indexerWsUri,
        }),
      });
      const payload = (await response.json()) as OnChainLicense & { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Live verification failed.");
      await new Promise((resolve) => window.setTimeout(resolve, 720));
      const timestamp = new Date().toISOString();
      setResult(null);
      setChainResult(payload);
      setCheckedAt(timestamp);
      setSealPhase("landed");

      const status = payload
        ? payload.valid
          ? "valid"
          : payload.revoked
            ? "revoked"
            : payload.exists
              ? "expired"
              : "not-found"
        : "not-found";
      const entry: CheckEntry = {
        credentialId: normalizedId,
        licenseNumber: serialFor(null, normalizedId),
        status,
        board: payload.exists ? "Committed issuing authority" : "—",
        expiresAt: payload.expiresAt ? new Date(payload.expiresAt * 1000).toISOString().slice(0, 10) : "",
        checkedAt: timestamp,
      };
      setHistory((current) => [entry, ...current].slice(0, 8));
    } catch (error) {
      setSealPhase("idle");
      setNotice(error instanceof Error ? error.message : "Verification failed.");
    } finally {
      setBusy(false);
    }
  }

  function copy(value: string, label: string) {
    void navigator.clipboard.writeText(value);
    setNotice(`${label} copied.`);
    window.setTimeout(() => setNotice(null), 2200);
  }

  async function generateProof(record: LicenseRecord) {
    if (effectiveStatus(record, renderTime) !== "valid") return;
    if (!liveMode) {
      setNotice("Set NEXT_PUBLIC_CONTRACT_ADDRESS to generate live proofs.");
      return;
    }
    setBusy(true);
    try {
        if (!wallet.session || !record.privateCredential) throw new Error("Connect 1AM and use a credential issued on this device.");
      const challenge = crypto.getRandomValues(new Uint8Array(32));
      const txId = await proveLicenseOnChain(wallet.session, CONTRACT_ADDRESS, record.privateCredential, record.id, challenge);
      setProof(`licenseseal://verify/${record.id}?tx=${txId}&challenge=${toHex(challenge)}`);
      await refreshRegistry();
      setProofRecordId(record.id);
      setProofRemaining(PROOF_LIFETIME);
      setProofExpiresAt(Date.now() + PROOF_LIFETIME * 1000);
      setNotice("Proof generated. It expires in two minutes.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Proof generation failed.");
    } finally {
      setBusy(false);
    }
  }

  async function submitLicense(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!liveMode) {
      setIssueError("Set NEXT_PUBLIC_CONTRACT_ADDRESS to issue licenses on chain.");
      return;
    }
    const data = new FormData(event.currentTarget);
    setBusy(true);
    try {
      const input = {
        doctorLabel: String(data.get("doctor")),
        licenseNumber: String(data.get("licenseNumber")),
        board: String(data.get("board")),
        specialty: String(data.get("specialty")),
        issuedAt: String(data.get("issuedAt")),
        expiresAt: String(data.get("expiresAt")),
      };
      if (!wallet.session) throw new Error("Connect 1AM before issuing a license.");
      const boardSecret = String(data.get("boardSecret"));
      if ((registry?.boardCount ?? 0) === 0) {
        await registerBoardOnChain(
          wallet.session,
          CONTRACT_ADDRESS,
          String(data.get("ownerSecret")),
          boardSecret,
        );
      }
      const generated = await createPrivateCredential(boardSecret, input);
      const issueTxId = await issueLicenseOnChain(
        wallet.session,
        CONTRACT_ADDRESS,
        boardSecret,
        generated.credentialId,
        BigInt(Math.floor(new Date(`${input.issuedAt}T00:00:00Z`).getTime() / 1000)),
        BigInt(Math.floor(new Date(`${input.expiresAt}T00:00:00Z`).getTime() / 1000)),
      );
      setRecords((current) => [{ ...input, id: generated.credentialId, status: "valid", privateCredential: generated.privateCredential }, ...current]);
      setCredentialId(generated.credentialId);
      setProofRecordId(generated.credentialId);
      await refreshRegistry();
      setNotice(`License issued on preview · tx ${shortId(issueTxId)}`);
      setShowIssue(false);
      setIssueError(null);
    } catch (error) {
      setIssueError(error instanceof Error ? error.message : "Issue failed.");
    } finally {
      setBusy(false);
    }
  }

  async function renew(record: LicenseRecord) {
    const next = new Date(record.expiresAt);
    next.setUTCFullYear(next.getUTCFullYear() + 2);
    if (liveMode) {
      const boardSecret = window.prompt("Enter board secret to renew this license:");
      if (!boardSecret || !wallet.session || !record.privateCredential) return;
      setBusy(true);
      try {
        const rotated = rotatePrivateCredential(record.privateCredential);
        const renewTxId = await renewLicenseOnChain(
          wallet.session,
          CONTRACT_ADDRESS,
          boardSecret,
          record.id,
          rotated.credentialId,
          BigInt(Math.floor(Date.now() / 1000)),
          BigInt(Math.floor(next.getTime() / 1000)),
        );
        setRecords((current) => current.map((entry) => entry.id === record.id ? {
          ...entry,
          id: rotated.credentialId,
          issuedAt: new Date().toISOString().slice(0, 10),
          expiresAt: next.toISOString().slice(0, 10),
          privateCredential: rotated.privateCredential,
        } : entry));
        await refreshRegistry();
        setNotice(`License renewed on preview · tx ${shortId(renewTxId)}`);
      } catch (error) {
        setNotice(error instanceof Error ? error.message : "Renewal failed.");
      } finally {
        setBusy(false);
      }
      return;
    }
    setNotice("Set NEXT_PUBLIC_CONTRACT_ADDRESS to renew licenses on chain.");
  }

  async function revoke(record: LicenseRecord) {
    if (liveMode) {
      const boardSecret = window.prompt("Enter board secret to revoke this license:");
      if (!boardSecret || !wallet.session) return;
      setBusy(true);
      try {
        const revokeTxId = await revokeLicenseOnChain(wallet.session, CONTRACT_ADDRESS, boardSecret, record.id);
        await refreshRegistry();
        setNotice(`License revoked on preview · tx ${shortId(revokeTxId)}`);
      } catch (error) {
        setNotice(error instanceof Error ? error.message : "Revocation failed.");
      } finally {
        setBusy(false);
      }
      return;
    }
    setNotice("Set NEXT_PUBLIC_CONTRACT_ADDRESS to revoke licenses on chain.");
  }

  const connectedLabel = wallet.connected ? shortId(wallet.address ?? "connected") : "Connect 1AM";

  return (
    <main className="app-shell">
      <header className="topbar">
        <button className="brand" onClick={() => setWorkspace("verify")}>
          <BrandSeal />
          <span>LicenseSeal</span>
          <small>MEDICAL REGISTRY</small>
        </button>
        <nav aria-label="Primary navigation">
          <button className={workspace === "verify" ? "active" : ""} onClick={() => setWorkspace("verify")}>Verify</button>
          <button className={workspace === "doctor" ? "active" : ""} onClick={() => setWorkspace("doctor")}>Your credential</button>
          <button className={workspace === "board" ? "active" : ""} onClick={() => setWorkspace("board")}>Board registry</button>
          <Link href="/deploy">Deploy</Link>
        </nav>
        <div className="network-controls">
          <span className="network-label"><i />{liveMode ? wallet.connected ? "PREPROD · LIVE" : "PREPROD · OFFLINE" : "SANDBOX"}</span>
          <button className="wallet-button" onClick={wallet.connected ? wallet.disconnect : wallet.connect} disabled={wallet.connecting}>
            {wallet.connected ? <Unplug size={14} /> : <WalletCards size={14} />}
            {wallet.connecting ? "Connecting…" : connectedLabel}
          </button>
        </div>
      </header>

      {wallet.error && <div className="global-message error"><CircleAlert size={15} />{wallet.error}</div>}
      {notice && <div className="toast"><Check size={14} />{notice}</div>}

      {workspace === "verify" && (
        <section className="verify-workspace">
          <div className="checkpoint-heading">
            <div>
              <p className="eyebrow">Hospital verification desk</p>
              <h1>Check the seal.<br />Keep the file private.</h1>
            </div>
            <p>Confirm a medical license against its registry commitment. The doctor&apos;s personal file stays with the doctor.</p>
          </div>

          <div className="checkpoint">
          <div className="checkpoint-index">
              <span>CHECKPOINT</span>
              <strong>MD / {liveMode ? wallet.connected ? "LIVE" : "OFFLINE" : "NO CONTRACT"}</strong>
              <small>{stats.checks.toLocaleString()} checks indexed</small>
            </div>
            <div className="scanner">
              <form onSubmit={verify}>
                <label htmlFor="credential">Credential ID or proof code</label>
                <div className="hero-input">
                  <Search aria-hidden="true" />
                  <input
                    id="credential"
                    value={credentialId}
                    onChange={(event) => {
                      setCredentialId(event.target.value);
                      if (sealPhase === "landed") setSealPhase("idle");
                    }}
                    placeholder="Paste credential ID or scan code"
                    spellCheck={false}
                    autoComplete="off"
                  />
                  <button className="notary-cta" disabled={busy}>{busy ? "Checking…" : "Verify"}</button>
                </div>
                {!liveMode && <p>Set NEXT_PUBLIC_CONTRACT_ADDRESS to query live registry data.</p>}
              </form>
              <div className="seal-stage" aria-live="polite">
                <NotarySeal phase={sealPhase} status={receiptStatus(result, chainResult)} />
                <span>{sealPhase === "verifying" ? "Checking registry commitment" : sealPhase === "landed" ? "Check complete" : "Awaiting credential"}</span>
              </div>
            </div>

            <VerificationReceipt result={result} chainResult={chainResult} checkedAt={checkedAt} />
          </div>

          <section className="check-ledger" aria-labelledby="ledger-title">
            <div className="ledger-heading">
              <div><p className="eyebrow">Audit trail</p><h2 id="ledger-title">Recent checks</h2></div>
              <span>LOCAL DEVICE · LAST {Math.max(history.length, 0)}</span>
            </div>
            {history.length ? history.map((entry) => <LedgerRow entry={entry} key={`${entry.checkedAt}-${entry.credentialId}`} />) : (
              <div className="ledger-empty">No checks recorded on this device.</div>
            )}
          </section>
        </section>
      )}

      {workspace === "doctor" && proofRecord && (
        <section className="wallet-workspace">
          <div className="wallet-copy">
            <p className="eyebrow">Your credential</p>
            <h1>Carry proof,<br />not paperwork.</h1>
            <p>Generate a two-minute proof when a hospital asks. Your source credential stays in this wallet.</p>
            {doctorRecords.length > 1 && (
              <div className="credential-picker" aria-label="Choose credential">
                {doctorRecords.slice(0, 3).map((record) => (
                  <button key={record.id} className={record.id === proofRecord.id ? "active" : ""} onClick={() => { setProofRecordId(record.id); setProof(null); setProofExpiresAt(null); }}>
                    <span>{record.doctorLabel}</span><small>{record.licenseNumber ?? shortId(record.id)}</small>
                  </button>
                ))}
              </div>
            )}
            <div className="wallet-privacy"><BrandSeal /><span>Only status, board, and expiry are disclosed by a verification.</span></div>
          </div>

          <div className="wallet-device">
            <div className={`credential-flipper ${proof ? "is-flipped" : ""}`}>
              <article className="physical-credential credential-front">
                <div className="card-security-edge" />
                <div className="card-topline"><span>MEDICAL LICENSE</span><StaticSeal status={effectiveStatus(proofRecord, renderTime)} /></div>
                <div className="card-name"><small>LICENSE HOLDER</small><h2>{proofRecord.doctorLabel}</h2></div>
                <dl>
                  <div><dt>License no.</dt><dd>{proofRecord.licenseNumber ?? serialFor(proofRecord, proofRecord.id)}</dd></div>
                  <div><dt>Specialty</dt><dd>{proofRecord.specialty}</dd></div>
                  <div className="wide"><dt>Issuing board</dt><dd>{proofRecord.board}</dd></div>
                  <div><dt>Issued</dt><dd>{formatDate(proofRecord.issuedAt)}</dd></div>
                  <div><dt>Expires</dt><dd>{formatDate(proofRecord.expiresAt)}</dd></div>
                </dl>
                <div className="card-footer"><code>{shortId(proofRecord.id)}</code><span>{effectiveStatus(proofRecord, renderTime).toUpperCase()}</span></div>
              </article>

              <article className="physical-credential credential-back">
                <div className="proof-heading"><span>LIVE VERIFICATION PROOF</span><small>SINGLE USE</small></div>
                {proof && (
                  <>
                    <div className="qr-wrap">
                      <QRCodeSVG value={proof} size={166} bgColor="#F6F3EC" fgColor="#12181F" level="M" marginSize={1} />
                      <CountdownRing remaining={proofRemaining} />
                    </div>
                    <div className="proof-time"><strong>{Math.floor(proofRemaining / 60)}:{String(proofRemaining % 60).padStart(2, "0")}</strong><span>until proof expires</span></div>
                    <button className="copy-proof" onClick={() => copy(proof, "Proof code")}><Clipboard size={14} />Copy proof code</button>
                  </>
                )}
              </article>
            </div>
            <button className="notary-cta wallet-proof-button" disabled={busy || effectiveStatus(proofRecord, renderTime) !== "valid"} onClick={() => proof ? (setProof(null), setProofExpiresAt(null)) : void generateProof(proofRecord)}>
              {busy ? "Generating proof…" : proof ? "Return to credential" : "Generate proof"}
            </button>
            <p>{proof ? "Present this code to the verifier before the timer ends." : "Proof reveals validity and expiry. It does not transfer the credential."}</p>
          </div>
        </section>
      )}

      {workspace === "doctor" && !proofRecord && (
        <section className="wallet-workspace">
          <div className="wallet-copy">
            <p className="eyebrow">Your credential</p>
            <h1>No local credential.</h1>
            <p>Credentials issued from this browser appear here after their preview transaction finalizes.</p>
          </div>
        </section>
      )}

      {workspace === "board" && (
        <section className="registry-workspace">
          <div className="registry-title">
            <div><p className="eyebrow">Issuing authority</p><h1>License registry</h1><p>Create, renew, revoke, and inspect committed credential states.</p></div>
            <button className="notary-cta" onClick={() => setShowIssue(true)} disabled={busy || !liveMode || !wallet.connected}><Plus size={15} />Issue credential</button>
          </div>
          <div className="registry-summary">
            <span><strong>{stats.active}</strong> ACTIVE</span><span><strong>{stats.expiring}</strong> EXPIRING ≤120D</span><span><strong>{registry?.issuanceCount ?? 0}</strong> ISSUED</span><span><strong>{stats.checks}</strong> PROOFS</span>
          </div>
          <div className="registry-table">
            <div className="table-head"><span>License holder / ID</span><span>Specialty</span><span>Expiration</span><span>Status</span><span>Registry action</span></div>
            {registryLoading && <div className="ledger-empty">Loading preview registry…</div>}
            {!registryLoading && liveMode && !wallet.connected && <div className="ledger-empty">Connect 1AM to load preview registry data.</div>}
            {!registryLoading && liveMode && wallet.connected && chainRecords.length === 0 && <div className="ledger-empty">Registry is live. No licenses issued yet.</div>}
            {!registryLoading && !liveMode && <div className="ledger-empty">Set `NEXT_PUBLIC_CONTRACT_ADDRESS` to use live registry data.</div>}
            {chainRecords.map((record) => (
              <div className="table-row" key={record.id}>
                <div><strong>{record.doctorLabel}</strong><button onClick={() => copy(record.id, "Credential ID")}>{record.licenseNumber ?? shortId(record.id)}<Clipboard size={11} /></button></div>
                <span>{record.specialty}</span><span>{formatDate(record.expiresAt)}</span><span><StaticSeal status={effectiveStatus(record, renderTime)} />{effectiveStatus(record, renderTime).toUpperCase()}</span>
                <div className="row-actions"><button onClick={() => void renew(record)} disabled={busy || record.status === "revoked" || (liveMode && !record.privateCredential)}><RefreshCw size={13} />Renew</button><button className="danger" onClick={() => void revoke(record)} disabled={busy || record.status === "revoked"}><X size={13} />Revoke</button></div>
              </div>
            ))}
          </div>
        </section>
      )}

      {showIssue && (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setShowIssue(false)}>
          <form className="issue-modal" onSubmit={submitLicense} onMouseDown={(event) => event.stopPropagation()}>
            <div className="modal-head"><div><p className="eyebrow">Registry entry</p><h2>Issue medical license</h2></div><button type="button" onClick={() => setShowIssue(false)} aria-label="Close"><X /></button></div>
            <label>Doctor display label<input required name="doctor" placeholder="Dr. Maya Chen" /></label>
            <div className="form-pair"><label>License number<input required name="licenseNumber" placeholder="NY-294817" /></label><label>Specialty<input required name="specialty" placeholder="Cardiology" /></label></div>
            <label>Issuing board<input required name="board" defaultValue="New York State Medical Board" /></label>
            <div className="form-pair"><label>Issue date<input required name="issuedAt" type="date" defaultValue={new Date().toISOString().slice(0, 10)} /></label><label>Expiration<input required name="expiresAt" type="date" /></label></div>
            {liveMode && (
              <>
                <label>Board secret<input required name="boardSecret" type="password" autoComplete="off" placeholder="64 hexadecimal characters" /></label>
                {(registry?.boardCount ?? 0) === 0 && <label>Registry owner secret<input required name="ownerSecret" type="password" autoComplete="off" placeholder="Required once to register first board" /></label>}
              </>
            )}
            {issueError && <p className="form-error"><CircleAlert size={15} />{issueError}</p>}
            <p className="modal-privacy">1AM submits this transaction to preview. Local proof server proves it. Display labels and private credential material stay on this device.</p>
            <button className="notary-cta" disabled={busy}><Plus size={15} />{busy ? "Submitting to preview…" : "Issue credential"}</button>
          </form>
        </div>
      )}
    </main>
  );
}

function receiptStatus(result: VerificationResult | null, chainResult: OnChainLicense | null) {
  if (chainResult) return chainResult.valid ? "valid" : chainResult.revoked ? "revoked" : chainResult.exists ? "expired" : "not-found";
  return result?.status ?? "not-found";
}

function BrandSeal() {
  return <span className="brand-seal" aria-hidden="true"><i /><b /></span>;
}

function NotarySeal({ phase, status }: { phase: SealPhase; status: LicenseStatus | "not-found" }) {
  return (
    <div className={`notary-seal ${phase} ${phase === "landed" ? status : ""}`} aria-hidden="true">
      <span className="seal-ripple" />
      <svg viewBox="0 0 120 120">
        <circle cx="60" cy="60" r="55" />
        <circle cx="60" cy="60" r="43" />
        <path d="M60 29v61M43 43c3 10 10 13 17 14 7-1 14-4 17-14M42 67c4-8 11-11 18-11 7 0 14 3 18 11M49 82c3-5 7-7 11-7 4 0 8 2 11 7" />
        <path d="M51 34h18M52 89h16" />
      </svg>
      <strong>{phase === "landed" ? status === "valid" ? "VALID" : "CHECKED" : "LS"}</strong>
    </div>
  );
}

function StaticSeal({ status }: { status: LicenseStatus | "not-found" }) {
  return <span className={`static-seal ${status}`} aria-hidden="true"><i /></span>;
}

function VerificationReceipt({ result, chainResult, checkedAt }: { result: VerificationResult | null; chainResult: OnChainLicense | null; checkedAt: string }) {
  if (!result && !chainResult) {
    return <div className="receipt-empty"><NotarySeal phase="idle" status="not-found" /><p>Paste a credential to check it</p><small>Status, issuing board, expiry, and check time appear here.</small></div>;
  }
  const status = receiptStatus(result, chainResult);
  const record = result?.found ? result.record : null;
  const exists = Boolean(record || chainResult?.exists);
  const heading = status === "valid" ? "VALID" : status === "not-found" ? "NOT FOUND" : status.toUpperCase();
  return (
    <article className={`verification-receipt ${status}`}>
      <div className="receipt-kicker"><span>LICENSE VERIFICATION RECEIPT</span><small>NO PERSONAL FILE COLLECTED</small></div>
      <div className="receipt-status"><StaticSeal status={status} /><h2>{heading}</h2></div>
      {exists ? (
        <dl>
          <div><dt>License no.</dt><dd>{serialFor(record, record?.id ?? "ONCHAIN")}</dd></div>
          <div><dt>Issuing board</dt><dd>{record?.board ?? "Committed issuing authority"}</dd></div>
          <div><dt>Expires</dt><dd>{record ? formatDate(record.expiresAt) : unixDate(chainResult?.expiresAt ?? null)}</dd></div>
          <div><dt>Checked at</dt><dd>{formatTimestamp(checkedAt)}</dd></div>
        </dl>
      ) : <p className="receipt-finding">No credential commitment matched this ID.</p>}
      <div className="receipt-foot"><span>Cryptographic registry check</span><code>{checkedAt ? checkedAt.replace("T", " ").slice(0, 19) + "Z" : ""}</code></div>
    </article>
  );
}

function LedgerRow({ entry }: { entry: CheckEntry }) {
  return (
    <div className="ledger-row">
      <span><StaticSeal status={entry.status} /></span>
      <div><strong>{entry.licenseNumber}</strong><code>{shortId(entry.credentialId)}</code></div>
      <span>{entry.board}</span>
      <span>{entry.expiresAt ? formatDate(entry.expiresAt) : "—"}</span>
      <time dateTime={entry.checkedAt}>{formatTimestamp(entry.checkedAt)}</time>
      <b className={entry.status}>{entry.status.toUpperCase()}</b>
    </div>
  );
}

function CountdownRing({ remaining }: { remaining: number }) {
  const radius = 22;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - remaining / PROOF_LIFETIME);
  return (
    <svg className="countdown-ring" viewBox="0 0 52 52" aria-hidden="true">
      <circle cx="26" cy="26" r={radius} />
      <circle className="countdown-progress" cx="26" cy="26" r={radius} strokeDasharray={circumference} strokeDashoffset={offset} />
    </svg>
  );
}
