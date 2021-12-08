import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button, Menu, Modal, Popover } from 'antd';
import { useWallet } from '@solana/wallet-adapter-react';
import useWindowDimensions from '../../utils/layout';
import { MenuOutlined } from '@ant-design/icons';
import { HowToBuyModal } from '../HowToBuyModal';
import { HashQueryLink } from '@oyster/common';
import {
  Cog,
  CurrentUserBadge,
  CurrentUserBadgeMobile,
} from '../CurrentUserBadge';
import { ConnectButton } from '@oyster/common';

const getDefaultLinkActions = (connected: boolean) => {
  return [];
};

const DefaultActions = ({ vertical = false }: { vertical?: boolean }) => {
  // const { connected } = useWallet();
  return (
    null
    // <div
    //   style={{
    //     display: 'flex',
    //     flexDirection: vertical ? 'column' : 'row',
    //   }}
    // >
    //   {getDefaultLinkActions(connected)}
    // </div>
  );
};

const BuyButton = () => {
  return (
    <Popover
      trigger="click"
      placement="bottomRight"
      content={(
        <div
          style={{
            width: 250,
          }}
        >
          <h5
            style={{
              color: 'rgba(255, 255, 255, 0.7)',
              letterSpacing: '0.02em',
            }}
          >
            MARKETPLACES
          </h5>
          <Button
            className="modal-button-default"
            style={{
              width: "100%"
            }}
          >
            <a
              href="https://solanart.io/collections/thecollectoooooor"
              target="_blank"
            >
              Solanart
            </a>
          </Button>
          <Button
            className="modal-button-default"
            style={{
              width: "100%"
            }}
          >
            <a
              href="https://magiceden.io/marketplace/collectoooooor"
              target="_blank"
            >
              Magic Eden
            </a>
          </Button>
        </div>
      )}
    >
      <Button
        className="wallet-key"
        style={{
          marginRight: "10px",
        }}
      >
        Buy
      </Button>
    </Popover>
  );
}

const MetaplexMenu = () => {
  const { width } = useWindowDimensions();
  const [isModalVisible, setIsModalVisible] = useState<boolean>(false);
  const { connected } = useWallet();

  if (width < 768)
    return (
      <>
        <Modal
          title={<p className={"collectoooooor-logo"}>COLLECTOOOOOR</p>}
          visible={isModalVisible}
          footer={null}
          className={'modal-box'}
          closeIcon={
            <img
              onClick={() => setIsModalVisible(false)}
              src={'/modals/close.svg'}
            />
          }
        >
          <div className="site-card-wrapper mobile-menu-modal">
            <Menu onClick={() => setIsModalVisible(false)}>
              {getDefaultLinkActions(connected).map((item, idx) => (
                <Menu.Item key={idx}>{item}</Menu.Item>
              ))}
            </Menu>
            <div className="actions">
              {!connected ? (
                <div className="actions-buttons">
                  <ConnectButton
                    onClick={() => setIsModalVisible(false)}
                    className="secondary-btn"
                  />
                  <BuyButton />
                </div>
              ) : (
                <>
                  <CurrentUserBadgeMobile
                    showBalance={false}
                    showAddress={true}
                    iconSize={24}
                    closeModal={() => {
                      setIsModalVisible(false);
                    }}
                  />
                  <Cog />
                </>
              )}
            </div>
          </div>
        </Modal>
        <MenuOutlined
          onClick={() => setIsModalVisible(true)}
          style={{ fontSize: '1.4rem' }}
        />
      </>
    );

  return <DefaultActions />;
};

export const LogoLink = () => {
  return (
    <Link to={`/`}>
      <p className={"collectoooooor-logo"}>COLLECTOOOOOOR</p>
    </Link>
  );
};

export const AppBar = () => {
  const { connected } = useWallet();
  return (
    <>
      <div id="mobile-navbar">
        <LogoLink />
        <MetaplexMenu />
      </div>
      <div id="desktop-navbar">
        <div className="app-left" style={{ marginLeft: 0 }}>
          <LogoLink />
          &nbsp;&nbsp;&nbsp;
          <MetaplexMenu />
        </div>
        <div className="app-right" style={{ marginRight: 0 }}>
          {<BuyButton />}
          {!connected && (
            <ConnectButton style={{ height: 48 }} allowWalletChange />
          )}
          {connected && (
            <>
              <CurrentUserBadge
                showBalance={false}
                showAddress={true}
                iconSize={24}
              />
              <Cog />
            </>
          )}
        </div>
      </div>
    </>
  );
};
