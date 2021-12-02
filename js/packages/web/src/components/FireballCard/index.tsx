import React from 'react';
import {Card} from 'antd';
import {useArt} from "../../hooks";
import {ArtCardProps} from "../ArtCard";
import {ArtContent} from "../ArtContent";


export interface NFT {
  name: string;
  image: string;
}


export interface TestArtCardProps extends ArtCardProps {
  test? : boolean
}


export const FireballCard = (props: TestArtCardProps) => {
  const {
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
    ...rest
  } = props;
  const art = useArt(pubkey);
  const nameCard = art?.title || name || ' ';

  return (
    <Card
      hoverable={true}
      className={`fireball-card ${small ? 'small' : ''} ${className ?? ''}`}
      cover={
        <div className="image-container">
          {
            test ?
              <img style={{width: width, height: height}} src={image} alt={name}/> :
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
        <p className={"card-title"}>The Collectoooooor</p>
        <p className={"card-name"}>{ nameCard }</p>
      </div>
    </Card>
  );
};
