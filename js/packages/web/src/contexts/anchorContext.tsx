import React from "react";

import {
  useWallet,
} from '@solana/wallet-adapter-react';

export const AnchorContext = React.createContext({});

export const AnchorContextProvider = ({ children = undefined } : { children : React.ReactNode }) => {
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

