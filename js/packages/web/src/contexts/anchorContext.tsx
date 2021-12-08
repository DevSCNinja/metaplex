import React from "react";

import * as anchor from '@project-serum/anchor';
import {
  Connection as RPCConnection,
} from "@solana/web3.js";
import {
  useWallet,
} from '@solana/wallet-adapter-react';
import {
  useConnectionConfig,
} from '@oyster/common';

import {
  FIREBALL_PROGRAM_ID,
} from '../utils/ids';

export const AnchorContext = React.createContext({});

export const AnchorContextProvider = ({ children = undefined } : { children : React.ReactNode }) => {
  const { endpoint } = useConnectionConfig();
  const connection = React.useMemo(
    () => new RPCConnection(endpoint.url, 'recent'),
    [endpoint]
  );

  const wallet = useWallet();
  const anchorWallet = React.useMemo(() => {
    if (
      !wallet ||
      !wallet.publicKey ||
      !wallet.signAllTransactions ||
      !wallet.signTransaction
    ) {
      return;
    }

    return {
      publicKey: wallet.publicKey,
      signAllTransactions: wallet.signAllTransactions,
      signTransaction: wallet.signTransaction,
    } as anchor.Wallet;
  }, [wallet]);

  const [program, setProgram] = React.useState<anchor.Program | null>(null);

  React.useEffect(() => {
    if (!anchorWallet) {
      return;
    }

    const wrap = async () => {
      try {
        const provider = new anchor.Provider(connection, anchorWallet, {
          preflightCommitment: 'recent',
        });
        const idl = await anchor.Program.fetchIdl(FIREBALL_PROGRAM_ID, provider);

        const program = new anchor.Program(idl, FIREBALL_PROGRAM_ID, provider);
        setProgram(program);
      } catch (err) {
        console.error('Failed to fetch IDL', err);
      }
    };
    wrap();
  }, [anchorWallet]);

  return (
    <AnchorContext.Provider
      value={{
        endpoint,
        connection,
        wallet,
        anchorWallet,
        program,
      }}
    >
      {children}
    </AnchorContext.Provider>
  );
};

export const useAnchorContext = (): any => {
  const context = React.useContext(AnchorContext);
  if (!context) {
    throw new Error('Must provide AnchorContext to use');
  }
  return context;
};

