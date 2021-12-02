import { Col, Layout, Modal, Button } from 'antd';
import React, {useState} from 'react';
import Masonry from 'react-masonry-css';
import { FireballCard } from '../../components/FireballCard';
import { FireballCardMint } from '../../components/FireballCardMint';
import {useSmallData, usePreviewData, useDummyData} from "../../hooks";
import {SmallModalCard} from "../../components/SmallModalCard";

const { Content } = Layout;


export const FireballView = () => {
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [minted, setMinted] = useState(false)
  const dataSmall = useSmallData();
  const mockPreview = usePreviewData();
  const dummyData = useDummyData();

  const breakpointColumnsObj = {
    default: 4,
    1100: 3,
    700: 2,
    500: 1,
  };

  const cardGrid = (
    <Masonry
      breakpointCols={breakpointColumnsObj}
      className="my-masonry-grid fireball-masonry"
      columnClassName="my-masonry-grid_column"
    >
      {dataSmall.map((m, id) => {
        return (
          <FireballCard
            key={id}
            pubkey={m.pubkey}
            name={m.name}
            image={m.image}
            preview={false}
            height={250}
            width={250}
            artView
            test={true}
          />
        );
      })}
    </Masonry>
  );

  const showModal = () => {
    setIsModalVisible(true);
  };

  const collectorGrid = (
    <Masonry
      breakpointCols={breakpointColumnsObj}
      className="my-masonry-grid fireball-masonry"
      columnClassName="my-masonry-grid_column"
    >
      {
        dummyData.map((m, id) => {
        return (
          <FireballCardMint
            key={id}
            pubkey={m.pubkey}
            name={m.name}
            image={m.image}
            preview={false}
            height={250}
            width={250}
            artView
            test={true}
            onClick={showModal}
          />
        );
      })
      }
    </Masonry>
  );

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
      <p className={"text-title"}>Collector NFTs</p>
      <p className={"text-subtitle"}>You can burn 13 NFTs to redeem an exclusive NFT. You don’t have enough right now.</p>
      <Content style={{ display: 'flex', flexWrap: 'wrap' }}>
        <Col style={{ width: '100%', marginTop: 10}}>{collectorGrid}</Col>
      </Content>
      <div className={"row"}>
        <p className={"text-title"}>Your NFTs</p>
        <div className={"unlock-nft"}> <p className={"unlock-text"}>3/13 NFTs unlocked</p></div>
      </div>
      <p className={"text-subtitle"}>The NFTs you have collected so far.</p>
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
