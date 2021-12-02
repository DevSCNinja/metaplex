import { Button } from 'antd';
import React from 'react';
import {ArtCardProps} from "../ArtCard";
import {FireballCard} from "../FireballCard";

interface DummyArtCardProps extends ArtCardProps{
   test?: boolean;
   onClick? : any
}

export const FireballCardMint = (props: DummyArtCardProps) => {
  let {
    key,
    className,
    small,
    category,
    image,
    animationURL,
    name,
    preview,
    pubkey,
    height,
    artView,
    width,
    test,
    onClick,
    ...rest
  } = props;

  return (
    <div>
      <FireballCard
        key={key}
        pubkey={pubkey}
        name={name}
        image={image}
        preview={false}
        height={250}
        width={250}
        artView
        test={true}
      />
      <div className={"nft-container"}>
        <div className={"label-quantity"}>
          3/13 NFTs needed to burn
        </div>
        <Button onClick={onClick} className={"mint-button"}>Mint</Button>
      </div>
    </div>
  );
};
