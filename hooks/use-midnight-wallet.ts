"use client";

import { useCallback, useState } from "react";
import { connectOneAmPreview, type BrowserSession } from "@/lib/midnight-browser";

type WalletState = {
  connected: boolean;
  connecting: boolean;
  address: string | null;
  session: BrowserSession | null;
  indexerUri: string | null;
  indexerWsUri: string | null;
  error: string | null;
};

const initialState: WalletState = {
  connected: false,
  connecting: false,
  address: null,
  session: null,
  indexerUri: null,
  indexerWsUri: null,
  error: null,
};

export function useMidnightWallet() {
  const [state, setState] = useState(initialState);

  const connect = useCallback(async () => {
    setState((current) => ({ ...current, connecting: true, error: null }));
    try {
      const session = await connectOneAmPreview("/zk/doctor_license/");
      setState({
        connected: true,
        connecting: false,
        address: session.unshieldedAddress,
        session,
        indexerUri: session.config.indexerUri,
        indexerWsUri: session.config.indexerWsUri,
        error: null,
      });
    } catch (error) {
      setState({
        ...initialState,
        error: error instanceof Error ? error.message : "Wallet connection failed.",
      });
    }
  }, []);

  const disconnect = useCallback(() => setState(initialState), []);
  return { ...state, connect, disconnect };
}
