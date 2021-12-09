import {
  createAssociatedTokenAccountInstruction,
  createMetadataInstruction,
  createMasterEditionInstruction,
  createUpdateMetadataInstruction,
} from '../helpers/instructions';
import { sendTransactionWithRetryWithKeypair } from '../helpers/transactions';
import {
  getTokenWallet,
  getEditionMarkPda,
  getMetadata,
  getMasterEdition,
} from '../helpers/accounts';
import * as anchor from '@project-serum/anchor';
import {
  Data,
  Creator,
  CreateMetadataArgs,
  UpdateMetadataArgs,
  CreateMasterEditionArgs,
  METADATA_SCHEMA,
} from '../helpers/schema';
import { serialize } from 'borsh';
import {
  TOKEN_METADATA_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  SPL_ASSOCIATED_TOKEN_ACCOUNT_PROGRAM_ID,
} from '../helpers/constants';
import fetch from 'node-fetch';
import { MintLayout, Token } from '@solana/spl-token';
import {
  Keypair,
  Connection,
  SystemProgram,
  TransactionInstruction,
  PublicKey,
  SYSVAR_RENT_PUBKEY,
} from '@solana/web3.js';
import log from 'loglevel';

export const createMetadata = async (metadataLink: string): Promise<Data> => {
  // Metadata
  let metadata;
  try {
    metadata = await (await fetch(metadataLink, { method: 'GET' })).json();
  } catch (e) {
    log.debug(e);
    log.error('Invalid metadata at', metadataLink);
    return;
  }

  // Validate metadata
  if (
    !metadata.name ||
    !metadata.image ||
    isNaN(metadata.seller_fee_basis_points) ||
    !metadata.properties ||
    !Array.isArray(metadata.properties.creators)
  ) {
    log.error('Invalid metadata file', metadata);
    return;
  }

  // Validate creators
  const metaCreators = metadata.properties.creators;
  if (
    metaCreators.some(creator => !creator.address) ||
    metaCreators.reduce((sum, creator) => creator.share + sum, 0) !== 100
  ) {
    return;
  }

  const creators = metaCreators.map(
    creator =>
      new Creator({
        address: creator.address,
        share: creator.share,
        verified: 1,
      }),
  );

  return new Data({
    symbol: metadata.symbol,
    name: metadata.name,
    uri: metadataLink,
    sellerFeeBasisPoints: metadata.seller_fee_basis_points,
    creators: creators,
  });
};

export const generateMint = async (
  connection: Connection,
  wallet: anchor.Wallet,
  instructions: Array<TransactionInstruction>,
) => {
  // Allocate memory for the account
  const mintRent = await connection.getMinimumBalanceForRentExemption(
    MintLayout.span,
  );

  // Generate a mint
  const mint = anchor.web3.Keypair.generate();

  instructions.push(
    SystemProgram.createAccount({
      fromPubkey: wallet.publicKey,
      newAccountPubkey: mint.publicKey,
      lamports: mintRent,
      space: MintLayout.span,
      programId: TOKEN_PROGRAM_ID,
    }),
  );
  instructions.push(
    Token.createInitMintInstruction(
      TOKEN_PROGRAM_ID,
      mint.publicKey,
      0,
      wallet.publicKey,
      wallet.publicKey,
    ),
  );

  const userTokenAccoutAddress = await getTokenWallet(
    wallet.publicKey,
    mint.publicKey,
  );
  instructions.push(
    createAssociatedTokenAccountInstruction(
      userTokenAccoutAddress,
      wallet.publicKey,
      wallet.publicKey,
      mint.publicKey,
    ),
  );

  instructions.push(
    Token.createMintToInstruction(
      TOKEN_PROGRAM_ID,
      mint.publicKey,
      userTokenAccoutAddress,
      wallet.publicKey,
      [],
      1,
    ),
  );

  return {
    mint,
    userTokenAccoutAddress,
  };
}

export const mintNFT = async (
  connection: Connection,
  walletKeypair: Keypair,
  metadataLink: string,
  mutableMetadata: boolean = true,
): Promise<PublicKey | void> => {
  // Retrieve metadata
  const data = await createMetadata(metadataLink);
  if (!data) return;

  // Create wallet from keypair
  const wallet = new anchor.Wallet(walletKeypair);
  if (!wallet?.publicKey) return;

  const instructions: TransactionInstruction[] = [];
  const signers: anchor.web3.Keypair[] = [walletKeypair];

  const { mint, userTokenAccoutAddress } = await generateMint(
      connection, wallet, instructions);
  signers.push(mint);

  // Create metadata
  const metadataAccount = await getMetadata(mint.publicKey);
  let txnData = Buffer.from(
    serialize(
      METADATA_SCHEMA,
      new CreateMetadataArgs({ data, isMutable: mutableMetadata }),
    ),
  );

  instructions.push(
    createMetadataInstruction(
      metadataAccount,
      mint.publicKey,
      wallet.publicKey,
      wallet.publicKey,
      wallet.publicKey,
      txnData,
    ),
  );

  // Create master edition
  const editionAccount = await getMasterEdition(mint.publicKey);
  txnData = Buffer.from(
    serialize(
      METADATA_SCHEMA,
      new CreateMasterEditionArgs({ maxSupply: new anchor.BN(0) }),
    ),
  );

  instructions.push(
    createMasterEditionInstruction(
      metadataAccount,
      editionAccount,
      mint.publicKey,
      wallet.publicKey,
      wallet.publicKey,
      wallet.publicKey,
      txnData,
    ),
  );

  const res = await sendTransactionWithRetryWithKeypair(
    connection,
    walletKeypair,
    instructions,
    signers,
  );

  try {
    await connection.confirmTransaction(res.txid, 'max');
  } catch {
    // ignore
  }

  // Force wait for max confirmations
  await connection.getParsedConfirmedTransaction(res.txid, 'confirmed');
  log.info('NFT created', res.txid);
  return metadataAccount;
};

export const mintLimitedEdition = async (
  connection: Connection,
  walletKeypair: Keypair,
  masterMint: string,
  edition: number,
): Promise<PublicKey | void> => {
  // Create wallet from keypair
  const wallet = new anchor.Wallet(walletKeypair);
  if (!wallet?.publicKey) return;

  const masterMintKey = new PublicKey(masterMint);
  const masterMetadataKey = await getMetadata(masterMintKey);
  const masterEditionKey = await getMasterEdition(masterMintKey);

  const instructions: TransactionInstruction[] = [];
  const signers: anchor.web3.Keypair[] = [walletKeypair];

  const { mint, userTokenAccoutAddress } = await generateMint(
      connection, wallet, instructions);
  signers.push(mint);

  const newMetadataKey = await getMetadata(mint.publicKey);
  const newEditionKey = await getMasterEdition(mint.publicKey); // same PDA spot

  const editionMarkPda = await getEditionMarkPda(masterMintKey, edition);

  const [walletTokenKey, ] = await PublicKey.findProgramAddress(
    [
      wallet.publicKey.toBuffer(),
      TOKEN_PROGRAM_ID.toBuffer(),
      masterMintKey.toBuffer(),
    ],
    SPL_ASSOCIATED_TOKEN_ACCOUNT_PROGRAM_ID
  );

  instructions.push(new TransactionInstruction({
      programId: TOKEN_METADATA_PROGRAM_ID,
      keys: [
          { pubkey: newMetadataKey            , isSigner: false , isWritable: true  } ,
          { pubkey: newEditionKey             , isSigner: false , isWritable: true  } ,
          { pubkey: masterEditionKey          , isSigner: false , isWritable: true  } ,
          { pubkey: mint.publicKey            , isSigner: false , isWritable: true  } ,
          { pubkey: editionMarkPda            , isSigner: false , isWritable: true  } ,
          { pubkey: wallet.publicKey          , isSigner: false , isWritable: false } , // `mint` auth
          { pubkey: wallet.publicKey          , isSigner: true  , isWritable: false } , // payer
          { pubkey: wallet.publicKey          , isSigner: true  , isWritable: false } , // token account owner
          { pubkey: walletTokenKey            , isSigner: false , isWritable: false } , // token account
          { pubkey: wallet.publicKey          , isSigner: false , isWritable: false } , // new metadata update authority
          { pubkey: masterMetadataKey         , isSigner: false , isWritable: false } ,

          { pubkey: TOKEN_PROGRAM_ID          , isSigner: false , isWritable: false } ,
          { pubkey: SystemProgram.programId   , isSigner: false , isWritable: false } ,
          { pubkey: SYSVAR_RENT_PUBKEY        , isSigner: false , isWritable: false } ,
      ],
      data: Buffer.from([
        11,
        ...new anchor.BN(edition).toArray('le', 8),
      ])
  }));

  const res = await sendTransactionWithRetryWithKeypair(
    connection,
    walletKeypair,
    instructions,
    signers,
  );

  try {
    await connection.confirmTransaction(res.txid, 'max');
  } catch {
    // ignore
  }

  // Force wait for max confirmations
  await connection.getParsedConfirmedTransaction(res.txid, 'confirmed');
  log.info('NFT created', res.txid);
  return newMetadataKey;
};

export const updateMetadata = async (
  mintKey: PublicKey,
  connection: Connection,
  walletKeypair: Keypair,
  metadataLink: string,
): Promise<PublicKey | void> => {
  // Retrieve metadata
  const data = await createMetadata(metadataLink);
  if (!data) return;

  const metadataAccount = await getMetadata(mintKey);
  const signers: anchor.web3.Keypair[] = [];
  const value = new UpdateMetadataArgs({
    data,
    updateAuthority: walletKeypair.publicKey.toBase58(),
    primarySaleHappened: null,
  });
  const txnData = Buffer.from(serialize(METADATA_SCHEMA, value));

  const instructions = [
    createUpdateMetadataInstruction(
      metadataAccount,
      walletKeypair.publicKey,
      txnData,
    ),
  ];

  // Execute transaction
  const txid = await sendTransactionWithRetryWithKeypair(
    connection,
    walletKeypair,
    instructions,
    signers,
  );
  console.log('Metadata updated', txid);
  return metadataAccount;
};
