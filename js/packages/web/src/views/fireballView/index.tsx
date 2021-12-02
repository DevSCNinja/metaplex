import { Col, Row, Layout, Modal, Button } from 'antd';
import React, {useState} from 'react';
import Masonry from 'react-masonry-css';
import { FireballCard } from '../../components/FireballCard';
import {ArtworkViewState} from "../artworks";
import {useCreatorArts, useUserArts, useSmallData, usePreviewData} from "../../hooks";
import {useMeta} from "@oyster/common";
import {useWallet} from "@solana/wallet-adapter-react";
import {SmallModalCard} from "../../components/SmallModalCard";

const { Content } = Layout;


export const FireballView = () => {
  const { publicKey } = useWallet();
  const ownedMetadata = useUserArts();
  const createdMetadata = useCreatorArts(publicKey?.toBase58() || '');
  const { metadata } = useMeta();
  const [activeKey] = useState(ArtworkViewState.Owned);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [minted, setMinted] = useState(false)
  const dataSmall = useSmallData();
  const mockPreview = usePreviewData();

  const breakpointColumnsObj = {
    default: 4,
    1100: 3,
    700: 2,
    500: 1,
  };

  const items =
    activeKey === ArtworkViewState.Owned
      ? ownedMetadata.map(m => m.metadata)
      : activeKey === ArtworkViewState.Created
      ? createdMetadata
      : metadata;


  const cardGrid = (
    <Masonry
      breakpointCols={breakpointColumnsObj}
      className="my-masonry-grid fireball-masonry"
      columnClassName="my-masonry-grid_column"
    >
      {items.map((m, id) => {
        return (
          <FireballCard
            key={id}
              pubkey={m.pubkey}
              preview={false}
              height={250}
              width={250}
              artView
          />
        );
      })}
    </Masonry>
  );

  const showModal = () => {
    setIsModalVisible(true);
  };

  const handleOk = () => {
    setIsModalVisible(false);
  };

  const handleCancel = () => {
    setIsModalVisible(false);
  };

  const handleMint = () => {
    setMinted(p => !p);
  }

  return (
    <Layout style={{ margin: 0, marginTop: 30}}>
      <p>You`re a Collectoooooor</p>
      <p>You can burn 13 NFTs to unlock an exclusive Collector NFT. You need more.</p>
      <Row className={"mintContainer"}>
        <Col lg={8} sm={24}>
          <div className={"nftContainer"}>
            <img className={"imgNft"} src="" alt="" height={350} width={350}/>
            <button onClick={showModal} className={"mintBtn"}>Mint</button>
          </div>
        </Col>
        <Col lg={8} sm={24}>
          <div className={"nftContainer"}>
            <img className={"imgNft"} src="" alt="" height={350} width={350}/>
            <button onClick={showModal} className={"mintBtn"}>Mint</button>
          </div>
        </Col>
        <Col lg={8} sm={24}>
          <div className={"nftContainer"}>
            <img className={"imgNft"} src="" alt="" height={350} width={350}/>
            <button onClick={showModal} className={"mintBtn"}>Mint</button>
          </div>
        </Col>
      </Row>
      <div className={"row"}>
        <p className={"textTitle"}>Your NFTs</p>
        <div className={"unlock-nft"}> <p className={"unlock-text"}>3/13 NFTs unlocked</p></div>
      </div>
      <p>The NFTs you have collected so far.</p>
      <br/>
      <Content style={{ display: 'flex', flexWrap: 'wrap' }}>
        <Col style={{ width: '100%', marginTop: 10}}>{cardGrid}</Col>
      </Content>
      <Modal
        className={"modal-mint"}
        visible={isModalVisible}
        onOk={handleOk}
        onCancel={handleCancel}
        footer={[]}
      >
        {
          minted ?
            <div className={"minted-modal"}>
              <div className={"modal-image-container"}>
                <FireballCard
                  key={mockPreview.name}
                  pubkey={mockPreview.pubkey}
                  preview={false}
                  height={250}
                  width={250}
                  artView
                  image={mockPreview.image}
                  name={mockPreview.name}
                  test={true}
                />
              </div>
              <div className={"modal-content-container"}>
                <div>
                  <p className={"modal-title-mint"}>Congratulations, Jake! </p>
                  <p>Your 13 NFTs have been burned to mint ownership to  ‘Pink Cloud’ by PPLPLEASER. </p>
                </div>
                <div className={"modal-button-container"}>
                 <Button className={"mint-modal-btn"} onClick={handleCancel}>Check out your NFT</Button>
                </div>
              </div>
            </div> :
          <>
            <p className={"modal-title-mint"}>Confirm minting</p>
            <p>NOTE: You will lose your old NFTs after minting. </p>
            <div className={"modal-button-container"}>
              <Button className={"mint-modal-btn"} key={"back"} onClick={handleMint}> Mint</Button>
              <Button className={"cancel-modal-btn"} key={"back"} onClick={handleCancel}> Cancel</Button>
            </div>
            <div className={"modal-content-mint"}>
              <div>
                <p className={"modal-subtitle-mint"} >Burning 13 NFTs</p>
                <div className={"nft-list"}>
                  {
                    dataSmall.map((m, id) => {
                    return (
                      <SmallModalCard
                        key={id}
                        pubkey={m.pubkey}
                        preview={false}
                        height={80}
                        width={80}
                        artView
                        image={m.image}
                        name={m.name}
                        test={true}
                      />
                    );
                  })
                  }
                </div>
              </div>
              <div>
                <p className={"modal-subtitle-mint"}>To mint</p>
                <FireballCard
                  key={mockPreview.name}
                    pubkey={mockPreview.pubkey}
                    preview={false}
                    height={250}
                    width={250}
                    artView
                    image={mockPreview.image}
                    name={mockPreview.name}
                    test={true}
                />
              </div>
            </div>
          </>
        }
      </Modal>
    </Layout>
  );
};
