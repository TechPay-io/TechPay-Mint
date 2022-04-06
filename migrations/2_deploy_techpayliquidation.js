const {
  deployProxy,
  upgradeProxy,
  prepareUpgrade
} = require('@openzeppelin/truffle-upgrades');

const TechPayLiquidationManager = artifacts.require('TechPayLiquidationManager');
const TechPayMintTokenRegistry = artifacts.require('TechPayMintTokenRegistry');
const TechPayDeFiTokenStorage = artifacts.require('TechPayDeFiTokenStorage');
const TechPayMint = artifacts.require('TechPayMint');
const TechPayMintAddressProvider = artifacts.require(
  'TechPayMintAddressProvider'
);
const TechPayMintRewardDistribution = artifacts.require(
  'TechPayMintRewardDistribution'
);
const TechPayTUSD = artifacts.require('TechPayTUSD');
const MockToken = artifacts.require('MockToken');
const MockPriceOracleProxy = artifacts.require('MockPriceOracleProxy');

const etherToWei = (n) => {
  return new web3.utils.BN(web3.utils.toWei(n.toString(), 'ether'));
};

module.exports = async function(deployer, network, accounts) {
  console.log('network: ', network);
  if (network === 'ganache' || network === 'localhost') {
    // to be deployed to the local ganache

    //////////////////////////////////////
    // deploy and set like the beforeEach in TechPayLiquidationManager.test.js
    const owner = accounts[0];
    const admin = accounts[1];
    const borrower = accounts[2];
    const bidder1 = accounts[3];
    const bidder2 = accounts[4];
    const techpayFeeVault = accounts[5];
    await deployer.deploy(TechPayMintAddressProvider);
    const techpayMintAddressProvider = await TechPayMintAddressProvider.deployed();
    await techpayMintAddressProvider.initialize(owner);

    await deployer.deploy(TechPayLiquidationManager);
    const techpayLiquidationManager = await TechPayLiquidationManager.deployed();
    await techpayLiquidationManager.initialize(
      owner,
      techpayMintAddressProvider.address
    );

    await deployer.deploy(TechPayMint);
    const techpayMint = await TechPayMint.deployed();
    await techpayMint.initialize(owner, techpayMintAddressProvider.address);

    await deployer.deploy(TechPayMintTokenRegistry);
    const techpayMintTokenRegistry = await TechPayMintTokenRegistry.deployed();
    await techpayMintTokenRegistry.initialize(owner);

    await deployer.deploy(TechPayDeFiTokenStorage);
    const collateralPool = await TechPayDeFiTokenStorage.deployed();
    await collateralPool.initialize(techpayMintAddressProvider.address, true);

    await deployer.deploy(TechPayDeFiTokenStorage);
    const debtPool = await TechPayDeFiTokenStorage.deployed();
    await debtPool.initialize(techpayMintAddressProvider.address, true);

    await deployer.deploy(TechPayTUSD);
    const techpayTUSD = await TechPayTUSD.deployed();
    await techpayTUSD.initialize(owner);

    await deployer.deploy(TechPayMintRewardDistribution);
    const techpayMintRewardDistribution = await TechPayMintRewardDistribution.deployed();
    await techpayMintRewardDistribution.initialize(
      owner,
      techpayMintAddressProvider.address
    );

    await deployer.deploy(MockToken);
    const mockToken = await MockToken.deployed();
    await mockToken.initialize('wTPC', 'wTPC', 18);

    await deployer.deploy(MockPriceOracleProxy);
    const mockPriceOracleProxy = await MockPriceOracleProxy.deployed();

    await techpayMintAddressProvider.setTechPayMint(techpayMint.address);
    await techpayMintAddressProvider.setCollateralPool(collateralPool.address);
    await techpayMintAddressProvider.setDebtPool(debtPool.address);
    await techpayMintAddressProvider.setTokenRegistry(
      techpayMintTokenRegistry.address
    );
    await techpayMintAddressProvider.setRewardDistribution(
      techpayMintRewardDistribution.address
    );
    await techpayMintAddressProvider.setPriceOracleProxy(
      mockPriceOracleProxy.address
    );
    await techpayMintAddressProvider.setTechPayLiquidationManager(
      techpayLiquidationManager.address
    );

    // set the initial value; 1 wTPC = 1 USD; 1 tUSD = 1 USD
    await mockPriceOracleProxy.setPrice(mockToken.address, etherToWei(1));
    await mockPriceOracleProxy.setPrice(techpayTUSD.address, etherToWei(1));

    await techpayMintTokenRegistry.addToken(
      mockToken.address,
      '',
      mockPriceOracleProxy.address,
      18,
      true,
      true,
      false
    );
    await techpayMintTokenRegistry.addToken(
      techpayTUSD.address,
      '',
      mockPriceOracleProxy.address,
      18,
      true,
      false,
      true
    );

    await techpayTUSD.addMinter(techpayMint.address);

    await techpayLiquidationManager.updateTechPayMintContractAddress(
      techpayMint.address
    );
    await techpayLiquidationManager.updateTechPayUSDAddress(techpayTUSD.address);

    await techpayLiquidationManager.addAdmin(admin);

    await techpayLiquidationManager.updateTechPayFeeVault(techpayFeeVault);

    //////////////////////////////////////

    // set like part of scenario 1
    await mockToken.mint(borrower, etherToWei(9999));
    await techpayTUSD.mint(bidder1, etherToWei(10000));
    await mockToken.approve(techpayMint.address, etherToWei(9999), {
      from: borrower
    });
    await techpayMint.mustDeposit(mockToken.address, etherToWei(9999), {
      from: borrower
    });
    await techpayMint.mustMintMax(techpayTUSD.address, 32000, { from: borrower });

    // when testing the liquidation bot, on the truffle console set the price of wTPC to 0.5
    // the liquidation bot will start the liquidation of the borrower's collateral successfully
  } else {
    const techpayLiquidationManager = await deployProxy(
      TechPayLiquidationManager,
      [
        '0xe8A06462628b49eb70DBF114EA510EB3BbBDf559',
        '0xcb20a1A22976764b882C2f03f0C8523F3df54b10'
      ],
      { deployer }
    );
  }
};
