"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  Check,
  CircleAlert,
  Clipboard,
  ExternalLink,
  KeyRound,
  LoaderCircle,
  Rocket,
  ShieldCheck,
  WalletCards,
} from "lucide-react";
import { deployDoctorLicense } from "@/lib/deploy-doctor-license";
import {
  connectOneAmPreview,
  detectOneAmWallet,
  MIDNIGHT_NETWORK,
  pollForContract,
  toHex,
  type BrowserSession,
} from "@/lib/midnight-browser";

const DEPLOYMENT_STORAGE_KEY = "licenseseal:deployment:preview";

type DeploymentRecord = {
  contractAddress: string;
  transactionId: string;
  deployedAt: string;
};

export default function DeployClient() {
  const [walletInstalled, setWalletInstalled] = useState<boolean | null>(null);
  const [session, setSession] = useState<BrowserSession | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [deploying, setDeploying] = useState(false);
  const [status, setStatus] = useState("Waiting for 1AM wallet");
  const [error, setError] = useState("");
  const [deployment, setDeployment] = useState<DeploymentRecord | null>(null);
  const [ownerSecret, setOwnerSecret] = useState("");
  const mounted = useRef(true);

  useEffect(() => {
    const saved = window.localStorage.getItem(DEPLOYMENT_STORAGE_KEY);
    if (saved) {
      try {
        // Deployment address is public and safe to persist.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setDeployment(JSON.parse(saved) as DeploymentRecord);
      } catch {
        window.localStorage.removeItem(DEPLOYMENT_STORAGE_KEY);
      }
    }
    void detectOneAmWallet().then((wallet) => {
      if (mounted.current) setWalletInstalled(wallet !== null);
    });
    return () => { mounted.current = false; };
  }, []);

  const connect = useCallback(async () => {
    setConnecting(true);
    setError("");
    setStatus("Opening 1AM on preview…");
    try {
      const connected = await connectOneAmPreview("/zk/doctor_license/");
      if (!mounted.current) return;
      setSession(connected);
      setStatus("1AM connected. Ready to deploy.");
    } catch (reason) {
      if (!mounted.current) return;
      setError(reason instanceof Error ? reason.message : "Wallet connection failed.");
      setStatus("Wallet connection failed");
    } finally {
      if (mounted.current) setConnecting(false);
    }
  }, []);

  const deploy = useCallback(async () => {
    if (!session) return;
    setDeploying(true);
    setError("");
    setOwnerSecret("");
    setStatus("Building deployment transaction in browser…");

    try {
      const secret = crypto.getRandomValues(new Uint8Array(32));
      setStatus("Generating proof through local proof server…");
      const result = await deployDoctorLicense(session, secret);
      if (!mounted.current) return;

      const record: DeploymentRecord = {
        ...result,
        deployedAt: new Date().toISOString(),
      };
      setDeployment(record);
      setOwnerSecret(toHex(secret));
      window.localStorage.setItem(DEPLOYMENT_STORAGE_KEY, JSON.stringify(record));
      setStatus("Transaction submitted. Waiting for preview indexer…");

      try {
        await pollForContract(
          session.config.indexerUri,
          result.contractAddress,
          (attempt) => {
            if (mounted.current) setStatus(`Waiting for preview indexer — attempt ${attempt}`);
          },
        );
        if (mounted.current) setStatus("Contract deployed and indexed on preview.");
      } catch (reason) {
        if (mounted.current) {
          setError(reason instanceof Error ? reason.message : "Indexer confirmation timed out.");
          setStatus("Transaction submitted; indexer confirmation pending.");
        }
      }
    } catch (reason) {
      if (mounted.current) {
        setError(reason instanceof Error ? reason.message : "Deployment failed.");
        setStatus("Deployment failed");
      }
    } finally {
      if (mounted.current) setDeploying(false);
    }
  }, [session]);

  function copy(value: string) {
    void navigator.clipboard.writeText(value);
  }

  return (
    <main className="deploy-shell">
      <header className="deploy-nav">
        <Link className="brand" href="/">
          <span className="brand-mark"><ShieldCheck size={21} /></span>
          <span>LicenseSeal</span>
          <small>MD</small>
        </Link>
        <Link className="back-link" href="/"><ArrowLeft size={15} />Back to app</Link>
      </header>

      <section className="deploy-stage">
        <div className="deploy-intro">
          <p className="eyebrow">1AM browser deployment · preview</p>
          <h1>Put license trust<br /><em>on Midnight.</em></h1>
          <p>Deployment happens entirely in this browser. 1AM supplies wallet access, balancing, and submission. Local proof server handles proving. No server deployer enters flow.</p>
          <ol className="deploy-steps">
            <li className={session ? "done" : "current"}><span>{session ? <Check size={15} /> : "1"}</span><div><strong>Connect 1AM</strong><small>Explicit Midnight preview session</small></div></li>
            <li className={deployment ? "done" : session ? "current" : ""}><span>{deployment ? <Check size={15} /> : "2"}</span><div><strong>Approve deployment</strong><small>Proof and transaction stay browser-side</small></div></li>
            <li className={deployment ? "current" : ""}><span>3</span><div><strong>Save contract address</strong><small>Public registry identity</small></div></li>
          </ol>
        </div>

        <div className="deploy-console">
          <div className="deploy-console-head">
            <div><span>Deployment console</span><strong><i /> MIDNIGHT PREVIEW</strong></div>
            <Rocket size={27} />
          </div>

          <div className="deploy-console-body">
            <div className="runtime-row"><span>Contract</span><code>doctor_license</code></div>
            <div className="runtime-row"><span>Compact runtime</span><code>0.16.0</code></div>
            <div className="runtime-row"><span>Network</span><code>{MIDNIGHT_NETWORK}</code></div>

            {walletInstalled === false && (
              <div className="deploy-warning"><CircleAlert size={17} /><div><strong>1AM wallet required</strong><p>Install extension, select preview, enable local proof server, then reload page.</p><a href="https://1am.xyz" target="_blank" rel="noreferrer">Open 1AM <ExternalLink size={12} /></a></div></div>
            )}

            {!session && (
              <button className="deploy-primary" onClick={connect} disabled={connecting}>
                {connecting ? <LoaderCircle className="spin" size={18} /> : <WalletCards size={18} />}
                {connecting ? "Connecting…" : walletInstalled === false ? "Try connect 1AM wallet" : "Connect 1AM wallet"}
              </button>
            )}

            {session && (
              <div className="connected-wallet">
                <WalletCards size={18} /><div><span>Connected wallet</span><code>{session.unshieldedAddress}</code></div><i />
              </div>
            )}

            {session && !deploying && (
              <button className="deploy-primary" onClick={deploy}>
                <Rocket size={18} />{deployment ? "Deploy another contract" : "Deploy LicenseSeal contract"}
              </button>
            )}

            {deploying && <div className="deployment-progress"><LoaderCircle className="spin" size={24} /><div><strong>1AM is processing deployment</strong><span>{status}</span></div></div>}

            {error && <div className="deploy-error"><CircleAlert size={16} /><span>{error}</span></div>}

            {deployment && (
              <div className="deployment-success">
                <div className="success-title"><span><Check size={18} /></span><div><small>Deployment result</small><strong>{status}</strong></div></div>
                <label>Contract address</label>
                <div className="copy-field"><code>{deployment.contractAddress}</code><button onClick={() => copy(deployment.contractAddress)} aria-label="Copy contract address"><Clipboard size={16} /></button></div>
                <label>Transaction ID</label>
                <div className="copy-field"><code>{deployment.transactionId}</code><button onClick={() => copy(deployment.transactionId)} aria-label="Copy transaction ID"><Clipboard size={16} /></button></div>
              </div>
            )}

            {ownerSecret && (
              <div className="owner-secret">
                <KeyRound size={18} /><div><strong>Save owner secret now</strong><p>Required for board administration. It is generated in browser and not sent to server.</p><div className="copy-field"><code>{ownerSecret}</code><button onClick={() => copy(ownerSecret)} aria-label="Copy owner secret"><Clipboard size={16} /></button></div></div>
              </div>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
