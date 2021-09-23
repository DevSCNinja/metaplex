import './App.css';
import { useEffect, useMemo, useRef } from 'react';

import Home from './Home';

import * as anchor from '@project-serum/anchor';
import { clusterApiUrl } from '@solana/web3.js';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import {
  getPhantomWallet,
  getSolflareWallet,
  getSolletWallet,
} from '@solana/wallet-adapter-wallets';

import {
  ConnectionProvider,
  WalletProvider,
} from '@solana/wallet-adapter-react';

import { WalletDialogProvider } from '@solana/wallet-adapter-material-ui';
import { ThemeProvider, createTheme } from '@material-ui/core';
import { ConfettiProvider } from './confetti';

const theme = createTheme({
  palette: {
    type: 'dark',
  },
});

const candyMachineId = process.env.REACT_APP_CANDY_MACHINE_ID
  ? new anchor.web3.PublicKey(process.env.REACT_APP_CANDY_MACHINE_ID)
  : undefined;

const fairLaunchId = new anchor.web3.PublicKey(
  process.env.REACT_APP_FAIR_LAUNCH_ID!,
);

const network = process.env.REACT_APP_SOLANA_NETWORK as WalletAdapterNetwork;

const rpcHost = process.env.REACT_APP_SOLANA_RPC_HOST!;
const connection = new anchor.web3.Connection(rpcHost);

const startDateSeed = parseInt(process.env.REACT_APP_CANDY_START_DATE!, 10);

const txTimeout = 30000; // milliseconds (confirm this works for your project)

const App = () => {
  const endpoint = useMemo(() => clusterApiUrl(network), []);

  const wallets = useMemo(
    () => [getPhantomWallet(), getSolflareWallet(), getSolletWallet()],
    [],
  );

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef(new Image())

  useEffect(() => {
    const canvas = canvasRef.current
    if(canvas) {
      const context = canvas.getContext('2d');
      if(context) {
        const dpr = window.devicePixelRatio || 1;
        const rect = canvas.getBoundingClientRect(); // css
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        context.scale(dpr, dpr);

        //Our first draw
        context.fillStyle = '#000000'
        context.fillRect(0, 0, context.canvas.width, context.canvas.height)

        const render = () => {
          const imageHeight = imageRef.current.height;
          const imageWidth = imageRef.current.width;

          const height = Math.ceil(canvas.height / imageHeight);
          const width = Math.ceil(canvas.width / imageWidth);

          for (let i = 0; i < width; i++) {
            for (let j= 0; j< height; j++) {
              context.save();
              context.translate(i * imageWidth, j * imageHeight);
              if(j % 2 === 1) {
                context.translate(0, imageHeight);
                context.scale(1, -1);
              }
              if(i % 2 === 1) {
                context.translate(imageWidth, 0);
                context.scale(-1, 1);
              }
              context.drawImage(imageRef.current, 0, 0, imageWidth, imageHeight);
              context.restore();
            }
          }
        };

        imageRef.current.onload = render;
        imageRef.current.src = 'bg.png';
      }
    }
  }, []);

  return (
    <ThemeProvider theme={theme}>
      <ConnectionProvider endpoint={endpoint}>
        <WalletProvider wallets={wallets} autoConnect>
          <WalletDialogProvider>
            <ConfettiProvider>
              <canvas ref={canvasRef} style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh' }} />
              <Home
                candyMachineId={candyMachineId}
                fairLaunchId={fairLaunchId}
                connection={connection}
                startDate={startDateSeed}
                txTimeout={txTimeout}
              />
            </ConfettiProvider>
          </WalletDialogProvider>
        </WalletProvider>
      </ConnectionProvider>
    </ThemeProvider>
  );
};

export default App;
