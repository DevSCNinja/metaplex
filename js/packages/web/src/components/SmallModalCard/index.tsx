import React from 'react';
import {Card} from 'antd';
import {useArt} from "../../hooks";
import {Artist, ArtType} from "../../types";
import {ArtCardProps} from "../ArtCard";
import {ArtContent} from "../ArtContent";
import {MetadataCategory, StringPublicKey} from "@oyster/common";

export interface NFT {
  name: string;
  image: string;
}

export interface TestArtCardProps extends ArtCardProps {
  pubkey?: StringPublicKey;

  image?: string;
  animationURL?: string;

  category?: MetadataCategory;

  name?: string;
  symbol?: string;
  description?: string;
  creators?: Artist[];
  preview?: boolean;
  small?: boolean;
  close?: () => void;

  height?: number;
  artView?: boolean;
  width?: number;

  count?: string;
  test?: boolean;
}

export const SmallModalCard = (props: TestArtCardProps) => {
  const {
    className,
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
    ...rest
  } = props;
  const art = useArt(pubkey);
  const nameCard = art?.title || name || ' ';

  console.log(props)

  return (
    <Card
      hoverable={true}
      className={`small-modal-card ${className ?? ''}`}
      cover={
        <div className="image-container">
          {
            test ? <img src={image} alt={name} width={width} height={height}/> :
              <ArtContent
                pubkey={pubkey}
                uri={image}
                animationURL={animationURL}
                category={category}
                preview={preview}
                height={height}
                width={width}
                artView={artView}
                style={{border: "15px"}}
              />
          }
        </div>
      }
      bordered={false}
     {...rest}
    >
      <div>
        <p className={"text"}>The Collectoooooor</p>
        <p className={"name"}>{ nameCard }</p>
      </div>
    </Card>
  );
};
