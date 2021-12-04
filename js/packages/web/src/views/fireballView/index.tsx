import React from "react";
import { RouteComponentProps, } from "react-router-dom";
import queryString from 'query-string';

import ContentLoader from 'react-content-loader';
import { Image } from 'antd';
import {
  Box,
  Button,
  Card,
  CircularProgress,
  Link as HyperLink,
  ImageList,
  ImageListItem,
  ImageListItemBar,
  Stack,
  Step,
  StepLabel,
  Stepper,
  Tab,
  Tabs,
  TextField,
} from "@mui/material";

import {
  Connection as RPCConnection,
  Keypair,
  PublicKey,
  SystemProgram,
  TransactionInstruction,
  SYSVAR_RENT_PUBKEY,
} from "@solana/web3.js";
import {
  AccountLayout,
  MintLayout,
  Token,
} from '@solana/spl-token'
import * as anchor from '@project-serum/anchor';
import {
  Connection,
  useConnectionConfig,
  chunks,
  decodeMasterEdition,
  decodeMetadata,
  getUnixTs,
  Metadata,
  notify,
  shortenAddress,
  SPL_ASSOCIATED_TOKEN_ACCOUNT_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
} from '@oyster/common';
import {
  useWallet,
} from '@solana/wallet-adapter-react';
import BN from 'bn.js';
import { capitalize } from 'lodash';

import {
  getAssociatedTokenAccount,
  getEdition,
  getEditionMarkerPda,
  getMetadata,
} from '../../utils/accounts';
import {
  FIREBALL_PREFIX,
  FIREBALL_PROGRAM_ID,
  TOKEN_METADATA_PROGRAM_ID,
} from '../../utils/ids';
import {
  envFor,
  explorerLinkFor,
} from '../../utils/transactions';
import {
  MerkleTree,
} from "../../utils/merkleTree";

export const ThreeDots = () => (
  <ContentLoader
    viewBox="0 0 212 200"
    height={200}
    width={212}
    backgroundColor="transparent"
    style={{
      width: '100%',
      margin: 'auto',
    }}
  >
    <circle cx="86" cy="100" r="8" />
    <circle cx="106" cy="100" r="8" />
    <circle cx="126" cy="100" r="8" />
  </ContentLoader>
);

const LoadingImage = (
  props : {
    url : string,
  },
) => {
  const [loaded, setLoaded] = React.useState<boolean>(false);
  return (
    <Image
      src={props.url}
      onLoad={() => {
        setLoaded(true);
      }}
      placeholder={<ThreeDots />}
      {...(loaded ? {} : { height: "100%" })}
    />
  );
}

const createMintAndAccount = async (
  connection : RPCConnection,
  walletKey : PublicKey,
  mint : PublicKey,
  setup : Array<TransactionInstruction>,
) => {
  const walletTokenKey = await getAssociatedTokenAccount(
      walletKey, mint);

  setup.push(SystemProgram.createAccount({
    fromPubkey: walletKey,
    newAccountPubkey: mint,
    space: MintLayout.span,
    lamports:
      await connection.getMinimumBalanceForRentExemption(
        MintLayout.span,
      ),
    programId: TOKEN_PROGRAM_ID,
  }));

  setup.push(Token.createInitMintInstruction(
    TOKEN_PROGRAM_ID,
    mint,
    0,
    walletKey,
    walletKey,
  ));

  setup.push(Token.createAssociatedTokenAccountInstruction(
    SPL_ASSOCIATED_TOKEN_ACCOUNT_PROGRAM_ID,
    TOKEN_PROGRAM_ID,
    mint,
    walletTokenKey,
    walletKey,
    walletKey
  ));

  setup.push(Token.createMintToInstruction(
    TOKEN_PROGRAM_ID,
    mint,
    walletTokenKey,
    walletKey,
    [],
    1,
  ));

}

type MintAndImage = {
  mint: PublicKey,
  name: string,
  image: string,
};

type RelevantMint = MintAndImage & { ingredient : string };

// remaining is never technically strictly up-to-date...
// TODO: add as of block height?
type RecipeYield = MintAndImage & { remaining : number };

const fetchMintsAndImages = async (
  connection : RPCConnection,
  mintKeys : Array<PublicKey>
) : Promise<Array<MintAndImage>> => {
  const metadataKeys = await Promise.all(mintKeys.map(getMetadata));
  const metadataAccounts = await (connection as any).getMultipleAccountsInfo(metadataKeys);

  const metadatasDecoded : Array<Metadata> = metadataAccounts
    .map((account, idx) => {
      if (account === null) {
        const missingMint = mintKeys[idx].toBase58();
        notify({
          message: 'Fetch mint failed',
          description: `Could not fetch metadata for mint ${missingMint}`,
        });
        return null;
      }

      return decodeMetadata(account.data);
    })
    .filter((ret) : ret is Metadata => ret !== null);

  const schemas = await Promise.all(metadatasDecoded.map(m => fetch(m.data.uri)));
  const schemaJsons = await Promise.all(schemas.map(s => s.json()));

  console.log(schemaJsons);

  return schemaJsons.map((schema, idx) => {
    return {
      mint: mintKeys[idx],
      name: schema.name,
      image: schema.image,
    };
  });
};

const getRecipeYields = async (
  connection : RPCConnection,
  recipeKey : PublicKey,
) => {
  const [recipeMintOwner, ] = await PublicKey.findProgramAddress(
    [
      FIREBALL_PREFIX,
      recipeKey.toBuffer(),
    ],
    FIREBALL_PROGRAM_ID
  );

  const yieldsAccounts = await connection.getTokenAccountsByOwner(
      recipeMintOwner,
      { programId: TOKEN_PROGRAM_ID },
    );
  const yieldsDecoded = yieldsAccounts.value.map(v => AccountLayout.decode(v.account.data));
  const masterMints = yieldsDecoded
    .filter(r => new BN(r.amount, 'le').toNumber() > 0)
    .map(r => new PublicKey(r.mint));

  const masterEditions = await Promise.all(masterMints.map(m => getEdition(m)));

  const editionAccounts = await (connection as any).getMultipleAccountsInfo(masterEditions);
  const remaining = editionAccounts
    .map((account, idx) => {
      if (account === null) {
        const missingMint = masterMints[idx].toBase58();
        notify({
          message: 'Fetch mint failed',
          description: `Could not fetch master edition for mint ${missingMint}`,
        });
        return NaN;
      }

      const edition = decodeMasterEdition(account.data);
      if (!edition.maxSupply) {
        return NaN;
      }
      const maxSupply = new BN(edition.maxSupply);
      const supply = new BN(edition.supply);
      if (supply.gte(maxSupply)) {
        return 0;
      } else {
        return maxSupply.sub(supply).toNumber();
      }
    })
    .reduce((acc, n, idx) => {
      return {
        ...acc,
        [masterMints[idx].toBase58()]: n,
      }
    },
    {});

  return (await fetchMintsAndImages(
      connection,
      masterMints,
    ))
    .map(r => ({ ...r, remaining: remaining[r.mint.toBase58()] }));
};

const getOnChainIngredients = async (
  connection : RPCConnection,
  recipeKey : PublicKey,
  walletKey : PublicKey,
  ingredientList : Array<any>,
) => {
  const [dishKey, ] = await PublicKey.findProgramAddress(
    [
      FIREBALL_PREFIX,
      recipeKey.toBuffer(),
      walletKey.toBuffer(),
    ],
    FIREBALL_PROGRAM_ID,
  );

  const storeKeys = await Promise.all(ingredientList.map((group, idx) => {
          const ingredientNum = new BN(idx);
          return PublicKey.findProgramAddress(
            [
              FIREBALL_PREFIX,
              dishKey.toBuffer(),
              Buffer.from(ingredientNum.toArray('le', 8)),
            ],
            FIREBALL_PROGRAM_ID,
          );
        }));

  const storeAccounts = await (connection as any).getMultipleAccountsInfo(storeKeys.map(s => s[0]));

  const mints = {};
  for (let idx = 0; idx < ingredientList.length; ++idx) {
    const group = ingredientList[idx];
    const storeAccount = storeAccounts[idx];
    if (storeAccount !== null) {
      const currentStore = AccountLayout.decode(Buffer.from(storeAccount.data));
      mints[new PublicKey(currentStore.mint).toBase58()] = group.ingredient;
    }
  }
  console.log(mints);
  const ingredientImages = await fetchMintsAndImages(
      connection, Object.keys(mints).map(r => new PublicKey(r)));
  const ret = ingredientImages.map(
      r => ({ ...r, ingredient: mints[r.mint.toBase58()] }));
  ret.sort((lft, rht) => lft.ingredient.localeCompare(rht.ingredient));
  return ret;
};

const getRelevantTokenAccounts = async (
  connection : RPCConnection,
  walletKey : PublicKey,
  ingredientList : Array<any>,
) => {
  const mints = {};
  for (const group of ingredientList)
    for (const mint of group.mints)
      mints[mint] = group.ingredient;

  const owned = await connection.getTokenAccountsByOwner(
      walletKey,
      { programId: TOKEN_PROGRAM_ID },
    );

  const decoded = owned.value.map(v => AccountLayout.decode(v.account.data));
  console.log(decoded);
  const relevant = decoded.filter(a => {
    const mintMatches = (new PublicKey(a.mint).toBase58()) in mints;
    const hasToken = new BN(a.amount, 'le').toNumber() > 0;
    return mintMatches && hasToken;
  });

  // TODO: getMultipleAccounts
  const relevantImages = await fetchMintsAndImages(
      connection, relevant.map(r => new PublicKey(r.mint)));
  const ret = relevantImages.map(
      r => ({ ...r, ingredient: mints[r.mint.toBase58()] }));
  ret.sort((lft, rht) => lft.ingredient.localeCompare(rht.ingredient));
  return ret;
};

const fetchRelevantMints = async (
  anchorWallet : anchor.Wallet,
  program : anchor.Program,
  connection : RPCConnection,
  recipeKey : PublicKey,
) => {
  if (!anchorWallet || !program) {
    return;
  }

  const startTime = getUnixTs();
  let recipe;
  try {
    recipe = await program.account.recipe.fetch(recipeKey);
  } catch (err) {
    const recipeKeyStr = recipeKey.toBase58();
    throw new Error(`Failed to find recipe ${recipeKeyStr}`);
  }

  console.log('Finished recipe fetch', getUnixTs() - startTime);

  const ingredientUrl = recipe.ingredients.replace(/\0/g, '');
  const ingredientList = await (await fetch(ingredientUrl)).json();

  console.log('Finished ingerdients fetch', getUnixTs() - startTime);

  if (recipe.roots.length !== ingredientList.length) {
    throw new Error(`Recipe has a different number of ingredient lists and merkle hashes. Bad configuration`);
  }

  const onChainIngredients = await getOnChainIngredients(
        connection, recipeKey, anchorWallet.publicKey, ingredientList);

  console.log('Finished on-chain ingredients fetch', getUnixTs() - startTime);

  const relevantMints = await getRelevantTokenAccounts(
        connection, anchorWallet.publicKey, ingredientList);
  console.log(relevantMints);

  console.log('Finished relevant tokens fetch', getUnixTs() - startTime);

  return {
    ingredientList,
    onChainIngredients,
    relevantMints,
  };
};

enum IngredientView {
  add = 'add',
  recover = 'recover',
}

export type RedeemProps = {};

export const FireballView = (
  props : RouteComponentProps<RedeemProps>,
) => {
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

  const recipeKey = new PublicKey("jjpuB5m3CHAx7HenRYLPbDkFMWqkz4A96SQ8jKZEH6H");

  const [recipeYields, setRecipeYields] = React.useState<Array<RecipeYield>>([]);
  const [relevantMints, setRelevantMints] = React.useState<Array<RelevantMint>>([]);
  const [ingredientList, setIngredientList] = React.useState<Array<any>>([]);
  const [dishIngredients, setIngredients] = React.useState<Array<RelevantMint>>([]);
  const [changeList, setChangeList] = React.useState<Array<any>>([]);
  const [ingredientView, setIngredientView] = React.useState(IngredientView.add);


  React.useMemo(() => {
    if (!connection || !anchorWallet || !program) return;
    console.log(anchorWallet, program, connection, recipeKey);
    try {
      const wrap = async () => {
        try {
          setRecipeYields(await getRecipeYields(connection, recipeKey));
          console.log("ingredient list", ingredientList);
        } catch (err) {
          console.log('Fetch yield preview err', err);
        }
        try {
          const { ingredientList, onChainIngredients, relevantMints } =
              await fetchRelevantMints(anchorWallet, program, connection, recipeKey);
          setIngredientList(ingredientList);
          setIngredients(onChainIngredients)
          setRelevantMints(relevantMints);
        } catch (err) {
          console.log('Fetch relevant mints err', err);
        }
      };
      wrap();
    } catch (err) {
      setRecipeYields([]);
      console.log('Key decode err', err);
    }
  }, [anchorWallet?.publicKey, !program, !connection, recipeKey.toBase58()]);


  const addIngredient = async (e : React.SyntheticEvent, ingredient: string, mint: PublicKey) => {
    // TODO: less hacky. let the link click go through
    if ((e.target as any).href !== undefined) {
      return;
    } else {
      e.preventDefault();
    }

    if (dishIngredients.find(c => c.ingredient === ingredient)) {
      throw new Error(`Ingredient ${ingredient} has already been added to this dish`);
    }

    const match = changeList.find(c => c.ingredient === ingredient);
    if (match) {
      if (match.mint.equals(mint)) return;
      if (match.operation !== 'add') {
        throw new Error(`Internal error: Cannot recover and add a mint`);
      }
      const prev = match.mint.toBase58();
      const next = mint.toBase58();
      notify({
        message: "Dish Changes",
        description: `Replaced ingredient ${prev} with ${next}`,
      });

      match.mint = mint;
    } else {
      setChangeList(
        [
          ...changeList,
          {
            ingredient: ingredient,
            mint: mint,
            operation: IngredientView.add,
          },
        ]
      );
    }
  };

  const recoverIngredient = async (e : React.SyntheticEvent, ingredient : string) => {
    // TODO: less hacky. let the link click go through
    if ((e.target as any).href !== undefined) {
      return;
    } else {
      e.preventDefault();
    }

    const mint = dishIngredients.find(c => c.ingredient === ingredient);
    if (!mint) {
      throw new Error(`Ingredient ${ingredient} is not part of this dish`);
    }

    const match = changeList.find(c => c.ingredient === ingredient);
    if (match) {
      if (match.mint !== mint.mint || match.operation !== 'recover') {
        throw new Error(`Internal error: Cannot recover and add a mint`);
      }
      // already added
    } else {
      setChangeList(
        [
          ...changeList,
          {
            ingredient: ingredient,
            mint: mint.mint,
            operation: IngredientView.recover,
          },
        ]
      );
    }
  };

  const cancelChangeForIngredient = async (e : React.SyntheticEvent, ingredient: string) => {
    // TODO: less hacky. let the link click go through
    if ((e.target as any).href !== undefined) {
      return;
    } else {
      e.preventDefault();
    }

    const newList = [...changeList];
    const idx = newList.findIndex(c => c.ingredient === ingredient);
    if (idx === -1) {
      throw new Error(`Ingredient ${ingredient} is not part of the change-list`);
    }

    newList.splice(idx, 1);
    setChangeList(newList);
  };

  const buildDishChanges = async (e : React.SyntheticEvent) => {
    e.preventDefault();
    if (!anchorWallet || !program) {
      throw new Error(`Wallet or program is not connected`);
      return;
    }

    if (ingredientList.length === 0) {
      throw new Error(`No ingredient list`);
    }

    const startTime = getUnixTs();

    const [dishKey, dishBump] = await PublicKey.findProgramAddress(
      [
        FIREBALL_PREFIX,
        recipeKey.toBuffer(),
        anchorWallet.publicKey.toBuffer(),
      ],
      FIREBALL_PROGRAM_ID,
    );

    const setup : Array<TransactionInstruction> = [];

    const dishAccount = await connection.getAccountInfo(dishKey);
    if (dishAccount === null) {
      setup.push(await program.instruction.startDish(
        dishBump,
        {
          accounts: {
            recipe: recipeKey,
            dish: dishKey,
            payer: anchorWallet.publicKey,
            systemProgram: SystemProgram.programId,
          },
          signers: [],
          instructions: [],
        }
      ));
    }

    console.log('Finished finding dish', getUnixTs() - startTime);

    const storeKeysAndBumps = await Promise.all(ingredientList.map(
      (_, idx) => {
        const ingredientNum = new BN(idx);
        return PublicKey.findProgramAddress(
          [
            FIREBALL_PREFIX,
            dishKey.toBuffer(),
            Buffer.from(ingredientNum.toArray('le', 8)),
          ],
          FIREBALL_PROGRAM_ID,
        );
      }
    ));
    const storeAccounts = await (connection as any).getMultipleAccountsInfo(
        storeKeysAndBumps.map(s => s[0]));
    console.log('Finished fetching stores', getUnixTs() - startTime);
    for (let idx = 0; idx < ingredientList.length; ++idx) {
      const group = ingredientList[idx];
      const change = changeList.find(c => c.ingredient === group.ingredient);

      if (!change) {
        continue;
      }

      const ingredientNum = new BN(idx);
      const [storeKey, storeBump] = storeKeysAndBumps[idx];
      const storeAccount = storeAccounts[idx];
      const walletATA = await getAssociatedTokenAccount(
        anchorWallet.publicKey, change.mint);
      if (change.operation === 'add') {
        if (storeAccount === null) {
          // nothing
        } else {
          throw new Error(`Ingredient ${group.ingredient} has already been added to this dish`);
        }

        // TODO: cache?
        const mintsKeys = group.mints.map(m => new PublicKey(m));
        const mintIdx = mintsKeys.findIndex(m => m.equals(change.mint));
        if (mintIdx === -1) {
          const changeMint = change.mint.toBase58();
          throw new Error(`Could not find mint matching ${changeMint} in ingredient group ${group.ingredient}`);
        }

        const tree = new MerkleTree(mintsKeys.map(m => m.toBuffer()));
        const proof = tree.getProof(mintIdx);

        setup.push(await program.instruction.addIngredient(
          storeBump,
          ingredientNum,
          proof,
          {
            accounts: {
              recipe: recipeKey,
              dish: dishKey,
              ingredientMint: change.mint,
              ingredientStore: storeKey,
              payer: anchorWallet.publicKey,
              from: walletATA,
              systemProgram: SystemProgram.programId,
              tokenProgram: TOKEN_PROGRAM_ID,
              rent: SYSVAR_RENT_PUBKEY,
            },
            signers: [],
            instructions: [],
          }
        ));
      } else if (change.operation === 'recover') {
        if (storeAccount === null) {
          throw new Error(`Ingredient ${group.ingredient} is not in this dish`);
        }

        setup.push(await program.instruction.removeIngredient(
          storeBump,
          ingredientNum,
          {
            accounts: {
              dish: dishKey,
              ingredientMint: change.mint,
              ingredientStore: storeKey,
              payer: anchorWallet.publicKey,
              to: walletATA,
              systemProgram: SystemProgram.programId,
              tokenProgram: TOKEN_PROGRAM_ID,
              rent: SYSVAR_RENT_PUBKEY,
            },
            signers: [],
            instructions: [],
          }
        ));
      } else {
        throw new Error(`Unknown change operation ${change.operation}`);
      }
    }

    console.log('Finished building instrs', getUnixTs() - startTime);

    return setup;
  };

  const mintRecipe = async (e : React.SyntheticEvent, masterMintKey : PublicKey) => {
    // TODO: less hacky. let the link click go through
    if ((e.target as any).href !== undefined) {
      return;
    } else {
      e.preventDefault();
    }

    if (!anchorWallet || !program) {
      throw new Error(`Wallet or program is not connected`);
    }

    const [dishKey, ] = await PublicKey.findProgramAddress(
      [
        FIREBALL_PREFIX,
        recipeKey.toBuffer(),
        anchorWallet.publicKey.toBuffer(),
      ],
      FIREBALL_PROGRAM_ID,
    );

    const [recipeMintOwner, recipeMintBump] = await PublicKey.findProgramAddress(
      [
        FIREBALL_PREFIX,
        recipeKey.toBuffer(),
      ],
      FIREBALL_PROGRAM_ID
    );

    const recipeATA = await getAssociatedTokenAccount(
        recipeMintOwner, masterMintKey);

    const newMint = Keypair.generate();
    const newMetadataKey = await getMetadata(newMint.publicKey);
    const masterMetadataKey = await getMetadata(masterMintKey);
    const newEdition = await getEdition(newMint.publicKey);
    const masterEdition = await getEdition(masterMintKey);

    const setup : Array<TransactionInstruction> = [];
    await createMintAndAccount(connection, anchorWallet.publicKey, newMint.publicKey, setup);

    const masterEditionAccount = await connection.getAccountInfo(masterEdition);
    if (masterEditionAccount === null) {
      throw new Error(`Could not retrieve master edition for mint ${masterMintKey.toBase58()}`);
    }
    const masterEditionDecoded = decodeMasterEdition(masterEditionAccount.data);

    // TODO: less naive?
    const masterEditionSupply = new BN(masterEditionDecoded.supply);
    const edition = masterEditionSupply.add(new BN(1));
    if (!masterEditionDecoded.maxSupply) {
      // no limit. try for next
    } else {
      const maxSupply = new BN(masterEditionDecoded.maxSupply);
      if (edition.gt(maxSupply)) {
        const masterMintStr = masterMintKey.toBase58();
        throw new Error(`No more editions remaining for ${masterMintStr}`);
      }
    }

    const editionMarkKey = await getEditionMarkerPda(masterMintKey, edition);

    setup.push(await program.instruction.makeDish(
      recipeMintBump,
      edition, // edition
      {
        accounts: {
          recipe: recipeKey,
          dish: dishKey,
          payer: anchorWallet.publicKey,
          metadataNewMetadata: newMetadataKey,
          metadataNewEdition: newEdition,
          metadataMasterEdition: masterEdition,
          metadataNewMint: newMint.publicKey,
          metadataEditionMarkPda: editionMarkKey,
          metadataNewMintAuthority: anchorWallet.publicKey,
          metadataMasterTokenOwner: recipeMintOwner,
          metadataMasterTokenAccount: recipeATA,
          metadataNewUpdateAuthority: anchorWallet.publicKey,
          metadataMasterMetadata: masterMetadataKey,
          metadataMasterMint: masterMintKey,
          systemProgram: SystemProgram.programId,
          tokenProgram: TOKEN_PROGRAM_ID,
          tokenMetadataProgram: TOKEN_METADATA_PROGRAM_ID,
          rent: SYSVAR_RENT_PUBKEY,
        },
        signers: [],
        instructions: [],
      }
    ));

    const dishChanges = await buildDishChanges(e);
    const txs = [...dishChanges.map(ix => [ix]), setup];
    const passed = await Connection.sendTransactions(
      program.provider.connection,
      anchorWallet,
      txs,
      new Array<Keypair[]>(txs.length).fill([]),
      Connection.SequenceType.StopOnFailure,
      'singleGossip',
      // success callback
      (txid: string, ind: number) => {
        const message =
          ind + 1 < txs.length
          ? `Dish Changes succeeded: ${ind + 1} of ${txs.length - 1}`
          : `Mint succeeded!`;
          notify({
            message,
            description: (
              <HyperLink href={explorerLinkFor(txid, connection)}>
                View transaction on explorer
              </HyperLink>
            ),
          });
      },
      // failure callback
      (reason: string, ind: number) => {
        console.log(`Mint failed on ${ind}: ${reason}`);
        return true;
      },
    );

    console.log(passed);

    if (passed !== chunked.length) {
      throw new Error(`One of the mint instructions failed. See console logs`);
    }

    setIngredients(await getOnChainIngredients(
          connection, recipeKey, anchorWallet.publicKey, ingredientList));

    setRelevantMints(await getRelevantTokenAccounts(
          connection, anchorWallet.publicKey, ingredientList));

    setChangeList([]);
  };


  const explorerLinkForAddress = (key : PublicKey, shorten: boolean = true) => {
    return (
      <HyperLink
        href={`https://explorer.solana.com/address/${key.toBase58()}?cluster=${envFor(connection)}`}
        target="_blank"
        rel="noreferrer"
        title={key.toBase58()}
        underline="none"
        sx={{ fontFamily: 'Monospace' }}
      >
        {shorten ? shortenAddress(key.toBase58()) : key.toBase58()}
      </HyperLink>
    );
  };

  const [loading, setLoading] = React.useState(false);
  const loadingProgress = () => (
    <CircularProgress
      size={24}
      sx={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        marginTop: '-12px',
        marginLeft: '-12px',
      }}
    />
  );

  const recipes = [
    {
      image: "https://www.arweave.net/EYE3jfEKhzj6vgs1OtrNe7B99SUi6X-iN4dQoOeM3-U?ext=gif",
      name: "city 1",
      mint: new PublicKey("8s2RPB1vEy5yTbYa85Y8QR1ATi7PgDBpuCFVNYv4be7s"),
    },
    {
      image: "https://www.arweave.net/25iaa4uK7W56ga9BXz37ZezRcCWx5BC442PBqtNyVPk?ext=gif",
      name: "city 2",
      mint: new PublicKey("jQ9LPzPpK1cdsC3qK8iZGWWasCALPZ6aCL5qD7GPHK7"),
    },
    { // TODO
      image: "https://www.arweave.net/RNdstwUgOcXc7ognVkUoTjfoO2B3Kp2iZ34m86x6gzw?ext=gif",
      name: "ufo",
      mint: new PublicKey("GHabNiugLr5o5TLTrBLiU26QVFhxoDNgooFZAsZ1yhus"),
    }
  ];


  const ingredients = {
    "airplane"           : "https://www.arweave.net/84UaRlQ7lIM6rjGodFsruqNNAoOBt6dBoJ-eHv9Fr50?ext=gif",
    "bull"               : "https://www.arweave.net/GfSyYWWgOIY3llKsU9CiR_sUKNlIBaE1-Wnx_JgvaC4?ext=gif",
    "duck with doughnut" : "https://www.arweave.net/4M30mRpOwq9M1DrlMAUipUAaAPsCeMLm8gTSDXo_rmI?ext=gif",
    "hot air balloon"    : "https://www.arweave.net/_mNWVadW1eA5Be3qJlDJeY5qc5tcfL0VdwJ7mc2oxgU?ext=gif",
    "house"              : "https://www.arweave.net/StFWkC5bN_vMuY6oluIlJbFMPsCL-6Q93aVCobrA_mM?ext=gif",
    "normal duck"        : "https://www.arweave.net/PJySMI3c2s-DFvJ_ruRrCScsNJiUDiJsu9J6haeWaww?ext=gif",
    "rocket"             : "https://www.arweave.net/tWQYjhOarxQbQvF9eGRUnI3S-vaWd8Qj7ag7CmiVRqk?ext=gif",
    "sailboat"           : "https://www.arweave.net/RIkpf6zSCcFLi6KetJrnwd5feZdlVc9-5E37n58D_H4?ext=gif",
    "telescope ape"      : "https://www.arweave.net/yxWPmiQY3OBHLn1kWhDOrvuJMNAbkglI3VzrL8xZk1Y?ext=gif",
    "traincar"           : "https://www.arweave.net/mt_fveAydzly6mEeAUNxDuAWevIe9NPoxBuPoTCDIYY?ext=gif",
    "ufo"                : "https://www.arweave.net/RNdstwUgOcXc7ognVkUoTjfoO2B3Kp2iZ34m86x6gzw?ext=gif",
    "umbrella duck"      : "https://www.arweave.net/-ApXoK_X3rlclU-rijXiqU4pm85tggLej4ax3HwsI3U?ext=gif",
    "whale"              : "https://www.arweave.net/e0VvxBG4VrAmli9v7E0d_JDxqbXohS50D7oExbtzVkg?ext=gif",
  };

  const batchChangeWrapper = (
    inBatch : boolean,
    r : RelevantMint,
    operation : IngredientView,
  ) => {
    return e => {
      setLoading(true);
      const wrap = async () => {
        try {
          if (inBatch) {
            await cancelChangeForIngredient(e, r.ingredient);
          } else if (operation === 'add') {
            await addIngredient(e, r.ingredient, r.mint);
          } else if (operation === 'recover') {
            await recoverIngredient(e, r.ingredient);
          } else {
            // TODO: error earlier...
            throw new Error(`Unknown operation ${operation}`);
          }
          setLoading(false);
        } catch (err) {
          notify({
            message: `${inBatch ? 'Cancel of ' : ''} ${capitalize(operation)} ingredient failed`,
            description: `${err}`,
          });
          setLoading(false);
        }
      };
      wrap();
    };
  };

  const cols = 4;
  // TODO: width sizing
  return (
    <Stack spacing={2}>
      <ImageList cols={cols}>
        {recipes.map((r, idx) => {
          return (
            <div
              key={idx}
              style={{
                padding: "20px",
              }}
            >
              <ImageListItem>
                <img
                  src={r.image}
                  style={{
                    borderRadius: "2px",
                    padding: 2,
                    backgroundColor: "white",
                  }}
                />
                <ImageListItemBar
                  title={r.name}
                  subtitle={explorerLinkForAddress(r.mint)}
                  position="below"
                />
                <Button
                  style={{
                    borderRadius: "30px",
                    color: "black",
                    backgroundColor: "white",
                    height: "45px",
                  }}
                  disabled={!Object.keys(ingredients).reduce(
                    (acc, ingredient) => {
                      return acc && changeList.find(c => c.ingredient === ingredient);
                    },
                    true,
                  )}
                  onClick={e => {
                    setLoading(true);
                    const wrap = async () => {
                      try {
                        await mintRecipe(e, r.mint);
                        setLoading(false);
                      } catch (err) {
                        notify({
                          message: `Mint failed`,
                          description: `${err}`,
                        });
                        setLoading(false);
                      }
                    };
                    wrap();
                  }}
                >
                  Mint
                </Button>
              </ImageListItem>
            </div>
          );
        })}
      </ImageList>
      <ImageList cols={cols}>
        {Object.keys(ingredients).map((ingredient, idx) => {
          const ingredientInDish = false;
          const ingredientInWallet = relevantMints.find(c => c.ingredient === ingredient);

          let imgStyle, disabled;
          if (ingredientInWallet) {
            imgStyle = {}
            disabled = false;
          } else {
            imgStyle = { filter: "grayscale(100%)", };
            disabled = true;
          }

          const r = ingredientInWallet;
          const operation = IngredientView.add;
          const inBatch = changeList.find(
              c => r && c.mint.equals(r.mint) && c.operation === operation);
          console.log(ingredient, inBatch, changeList);
          return (
            <div
              key={idx}
              style={{
                padding: "20px",
              }}
            >
              <ImageListItem>
                <img
                  src={ingredients[ingredient]}
                  style={{
                    borderRadius: "2px",
                    padding: inBatch ? 10 : 2,
                    backgroundColor: "white",
                    ...imgStyle,
                  }}
                />
                <ImageListItemBar
                  title={ingredient}
                  subtitle={
                    r
                      ? explorerLinkForAddress(r.mint)
                      : <p sx={{ fontFamily: 'Monospace' }}>{"\u00A0"}</p>
                  }
                  position="below"
                />
                <Button
                  style={{
                    borderRadius: "30px",
                    color: "black",
                    backgroundColor: "white",
                    height: "45px",
                    textTransform: "none",
                  }}
                  disabled={disabled}
                  onClick={batchChangeWrapper(inBatch, r, operation)}
                >
                  {!inBatch ? "Add" : "Remove"}
                </Button>
              </ImageListItem>
            </div>
          );
        })}
      </ImageList>
    </Stack>
  );
};

// export async function getStaticProps() {
//   console.log(anchor.NodeWallet.local());
//   console.log(anchor.workspace);
//   return {
//     props: {}
//   };
// }

// import { Col, Layout, Modal, Button } from 'antd';
// import React, {useState} from 'react';
// import Masonry from 'react-masonry-css';
// import { FireballCard } from '../../components/FireballCard';
// import { FireballCardMint } from '../../components/FireballCardMint';
// import {useSmallData, usePreviewData, useDummyData} from "../../hooks";
// import {SmallModalCard} from "../../components/SmallModalCard";

// const { Content } = Layout;


// export const FireballView = () => {
//   const [isModalVisible, setIsModalVisible] = useState(false);
//   const [minted, setMinted] = useState(false)
//   const dataSmall = useSmallData();
//   const mockPreview = usePreviewData();
//   const dummyData = useDummyData();

//   const breakpointColumnsObj = {
//     default: 4,
//     1100: 3,
//     700: 2,
//     500: 1,
//   };

//   const cardGrid = (
//     <Masonry
//       breakpointCols={breakpointColumnsObj}
//       className="my-masonry-grid fireball-masonry"
//       columnClassName="my-masonry-grid_column"
//     >
//       {dataSmall.map((m, id) => {
//         return (
//           <FireballCard
//             key={id}
//             pubkey={m.pubkey}
//             name={m.name}
//             image={m.image}
//             preview={false}
//             height={250}
//             width={250}
//             artView
//             test={true}
//           />
//         );
//       })}
//     </Masonry>
//   );

//   const showModal = () => {
//     setIsModalVisible(true);
//   };

//   const collectorGrid = (
//     <Masonry
//       breakpointCols={breakpointColumnsObj}
//       className="my-masonry-grid fireball-masonry"
//       columnClassName="my-masonry-grid_column"
//     >
//       {
//         dummyData.map((m, id) => {
//         return (
//           <FireballCardMint
//             key={id}
//             pubkey={m.pubkey}
//             name={m.name}
//             image={m.image}
//             preview={false}
//             height={250}
//             width={250}
//             artView
//             test={true}
//             onClick={showModal}
//           />
//         );
//       })
//       }
//     </Masonry>
//   );

//   const handleOk = () => {
//     setIsModalVisible(false);
//   };

//   const handleCancel = () => {
//     setIsModalVisible(false);
//   };

//   const handleMint = () => {
//     setMinted(p => !p);
//   }

//   return (
//     <Layout style={{ margin: 0, marginTop: 30}}>
//       <p className={"text-title"}>Collector NFTs</p>
//       <p className={"text-subtitle"}>You can burn 13 NFTs to redeem an exclusive NFT. You don’t have enough right now.</p>
//       <Content style={{ display: 'flex', flexWrap: 'wrap' }}>
//         <Col style={{ width: '100%', marginTop: 10}}>{collectorGrid}</Col>
//       </Content>
//       <div className={"row"}>
//         <p className={"text-title"}>Your NFTs</p>
//         <div className={"unlock-nft"}> <p className={"unlock-text"}>3/13 NFTs unlocked</p></div>
//       </div>
//       <p className={"text-subtitle"}>The NFTs you have collected so far.</p>
//       <br/>
//       <Content style={{ display: 'flex', flexWrap: 'wrap' }}>
//         <Col style={{ width: '100%', marginTop: 10}}>{cardGrid}</Col>
//       </Content>
//       <Modal
//         className={"modal-mint"}
//         visible={isModalVisible}
//         onOk={handleOk}
//         onCancel={handleCancel}
//         footer={[]}
//       >
//         {
//           minted ?
//             <div className={"minted-modal"}>
//               <div className={"modal-image-container"}>
//                 <FireballCard
//                   key={mockPreview.name}
//                   pubkey={mockPreview.pubkey}
//                   preview={false}
//                   height={250}
//                   width={250}
//                   artView
//                   image={mockPreview.image}
//                   name={mockPreview.name}
//                   test={true}
//                 />
//               </div>
//               <div className={"modal-content-container"}>
//                 <div>
//                   <p className={"modal-title-mint"}>Congratulations, Jake! </p>
//                   <p>Your 13 NFTs have been burned to mint ownership to  ‘Pink Cloud’ by PPLPLEASER. </p>
//                 </div>
//                 <div className={"modal-button-container"}>
//                  <Button className={"mint-modal-btn"} onClick={handleCancel}>Check out your NFT</Button>
//                 </div>
//               </div>
//             </div> :
//           <>
//             <p className={"modal-title-mint"}>Confirm minting</p>
//             <p>NOTE: You will lose your old NFTs after minting. </p>
//             <div className={"modal-button-container"}>
//               <Button className={"mint-modal-btn"} key={"back"} onClick={handleMint}> Mint</Button>
//               <Button className={"cancel-modal-btn"} key={"back"} onClick={handleCancel}> Cancel</Button>
//             </div>
//             <div className={"modal-content-mint"}>
//               <div>
//                 <p className={"modal-subtitle-mint"} >Burning 13 NFTs</p>
//                 <div className={"nft-list"}>
//                   {
//                     dataSmall.map((m, id) => {
//                     return (
//                       <SmallModalCard
//                         key={id}
//                         pubkey={m.pubkey}
//                         preview={false}
//                         height={80}
//                         width={80}
//                         artView
//                         image={m.image}
//                         name={m.name}
//                         test={true}
//                       />
//                     );
//                   })
//                   }
//                 </div>
//               </div>
//               <div>
//                 <p className={"modal-subtitle-mint"}>To mint</p>
//                 <FireballCard
//                   key={mockPreview.name}
//                   pubkey={mockPreview.pubkey}
//                   preview={false}
//                   height={250}
//                   width={250}
//                   artView
//                   image={mockPreview.image}
//                   name={mockPreview.name}
//                   test={true}
//                 />
//               </div>
//             </div>
//           </>
//         }
//       </Modal>
//     </Layout>
//   );
// };
