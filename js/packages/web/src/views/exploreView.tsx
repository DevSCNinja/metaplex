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
  const columnsGap = 4;
  const maxColumns = 3;
  const columnWidth = (maxWidth - columnsGap * (maxColumns - 1)) / maxColumns;

  const tilePadding = 20;
  const imageWidth = columnWidth - tilePadding * 2;

  const { width } = useWindowDimensions();
  const sizedColumns = (width : number) => {
           if (width > columnWidth * 3 + columnsGap * 2) {
      return 3;
    } else if (width > columnWidth * 2 + columnsGap * 1) {
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
        width: Math.min(maxWidth, width),
        marginLeft: 'auto',
        marginRight: 'auto',
      }}
    >
      <p className={"text-title"}>
        Explore Recipes
      </p>
      <ImageList cols={cols} variant="masonry">
        {props.recipeYields.map((r, idx) => {
          const yieldImage = (style) => (
            <img
              src={r.image}
              style={{
                ...style,
                width: imageWidth,
              }}
            />
          );
          return (
            <div
              key={idx}
              style={{
                padding: "20px",
                minWidth: columnWidth,
              }}
            >
              <ImageListItem>
                {r.link
                  ? (
                    <Link
                      to={r.link}
                      style={{
                        color: 'inherit',
                        width: imageWidth,
                      }}
                    >
                      {yieldImage({})}
                    </Link>
                  )
                  : yieldImage({ filter: 'grayscale(100%)' })
                }
                <ImageListItemBar
                  title={r.name}
                  subtitle={(
                    <div>
                      {r.mint ? explorerLinkForAddress(r.mint) : null}
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

