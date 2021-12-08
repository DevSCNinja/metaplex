import React from "react";
import { Link } from "react-router-dom";

import {
  Box,
  Button,
  Chip,
  Link as HyperLink,
  ImageList,
  ImageListItem,
  ImageListItemBar,
  Stack,
} from "@mui/material";

import {
  Connection as RPCConnection,
} from "@solana/web3.js";

import {
  useConnectionConfig,
  shortenAddress,
} from '@oyster/common';
import { Recipe } from './fireballView';
import useWindowDimensions from '../utils/layout';
import {
  envFor,
} from '../utils/transactions';

export type RecipeLink = Recipe & { link: string };

export const ExploreView = (
  props: {
    recipeYields: Array<RecipeLink>,
  },
) => {
  const { endpoint } = useConnectionConfig();
  const connection = React.useMemo(
    () => new RPCConnection(endpoint.url, 'recent'),
    [endpoint]
  );

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

  // TODO: more robust
  const maxWidth = 960;
  const outerPadding = 48 * 2;
  const columnsGap = 8;
  const maxColumns = 2;
  const columnWidth = (maxWidth - outerPadding - columnsGap * (maxColumns - 1)) / maxColumns;

  const tilePadding = 20;
  const imageWidth = columnWidth - tilePadding * 2;

  const { width } = useWindowDimensions();
  const sizedColumns = (width : number) => {
    if (width > columnWidth * 2 + columnsGap * 1 + outerPadding) {
      return 2;
    } else {
      return 1;
    }
  };
  const cols = sizedColumns(width);
  return (
    <Stack
      spacing={1}
      style={{
        width: maxWidth,
        marginLeft: 'auto',
        marginRight: 'auto',
      }}
    >
      <p className={"text-subtitle"}>
        Explore
      </p>
      <ImageList cols={cols}>
        {props.recipeYields.map((r, idx) => {
          return (
            <div
              key={idx}
              style={{
                padding: "20px",
                minWidth: columnWidth,
              }}
            >
              <ImageListItem>
                <img
                  src={r.image}
                  style={{
                    borderRadius: "5px",
                    padding: 3,
                    backgroundColor: "#888",
                    width: imageWidth,
                    height: imageWidth,
                  }}
                />
                <ImageListItemBar
                  title={(
                    <Link to={r.link} style={{color: 'inherit'}}>
                      {r.name}
                    </Link>
                  )}
                  subtitle={(
                    <div>
                      {explorerLinkForAddress(r.mint)}
                    </div>
                  )}
                  position="below"
                />
              </ImageListItem>
            </div>
          );
        })}
      </ImageList>
    </Stack>
  );
}

