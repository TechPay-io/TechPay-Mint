const {
  BN,
  constants,
  expectEvent,
  expectRevert,
  time
} = require('@openzeppelin/test-helpers');

const { ethers } = require('hardhat');
const { expect } = require('chai');

const { etherToWei, amount18 } = require('../utils/index');

const TechPayLiquidationManager = artifacts.require(
  'MockTechPayLiquidationManager'
);
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

let startTime;

contract('TechPayLiquidationManager', function([
  owner,
  admin,
  borrower,
  firstBidder,
  secondBidder,
  initiator
]) {
  before(async function() {
    provider = ethers.provider;

    /** all the necessary setup  */
    this.techpayMintAddressProvider = await TechPayMintAddressProvider.new({
      from: owner
    });
    await this.techpayMintAddressProvider.initialize(owner);

    this.techpayLiquidationManager = await TechPayLiquidationManager.new({
      from: owner
    });
    await this.techpayLiquidationManager.initialize(
      owner,
      this.techpayMintAddressProvider.address
    );

    this.techpayMint = await TechPayMint.new({ from: owner });
    await this.techpayMint.initialize(
      owner,
      this.techpayMintAddressProvider.address
    );

    this.techpayMintTokenRegistry = await TechPayMintTokenRegistry.new();
    await this.techpayMintTokenRegistry.initialize(owner);

    this.collateralPool = await TechPayDeFiTokenStorage.new({ from: owner });
    await this.collateralPool.initialize(
      this.techpayMintAddressProvider.address,
      true
    );

    this.debtPool = await TechPayDeFiTokenStorage.new({ from: owner });
    await this.debtPool.initialize(
      this.techpayMintAddressProvider.address,
      true
    );

    this.techpayTUSD = await TechPayTUSD.new({ from: owner });

    await this.techpayTUSD.initialize(owner);

    this.techpayMintRewardDistribution = await TechPayMintRewardDistribution.new({
      from: owner
    });
    await this.techpayMintRewardDistribution.initialize(
      owner,
      this.techpayMintAddressProvider.address
    );

    this.mockToken = await MockToken.new({ from: owner });
    await this.mockToken.initialize('wTPC', 'wTPC', 18);

    this.mockPriceOracleProxy = await MockPriceOracleProxy.new({
      from: owner
    });

    await this.techpayMintAddressProvider.setTechPayMint(
      this.techpayMint.address,
      { from: owner }
    );
    await this.techpayMintAddressProvider.setCollateralPool(
      this.collateralPool.address,
      { from: owner }
    );
    await this.techpayMintAddressProvider.setDebtPool(this.debtPool.address, {
      from: owner
    });
    await this.techpayMintAddressProvider.setTokenRegistry(
      this.techpayMintTokenRegistry.address,
      { from: owner }
    );
    await this.techpayMintAddressProvider.setRewardDistribution(
      this.techpayMintRewardDistribution.address,
      { from: owner }
    );
    await this.techpayMintAddressProvider.setPriceOracleProxy(
      this.mockPriceOracleProxy.address,
      { from: owner }
    );
    await this.techpayMintAddressProvider.setTechPayLiquidationManager(
      this.techpayLiquidationManager.address,
      { from: owner }
    );

    // set the initial value; 1 wTPC = 1 USD; 1 xTPC = 1 USD; 1 tUSD = 1 USD
    await this.mockPriceOracleProxy.setPrice(
      this.mockToken.address,
      etherToWei(1)
    );
    await this.mockPriceOracleProxy.setPrice(
      this.techpayTUSD.address,
      etherToWei(1)
    );

    await this.techpayMintTokenRegistry.addToken(
      this.mockToken.address,
      '',
      this.mockPriceOracleProxy.address,
      18,
      true,
      true,
      false,
      true
    );
    await this.techpayMintTokenRegistry.addToken(
      this.techpayTUSD.address,
      '',
      this.mockPriceOracleProxy.address,
      18,
      true,
      false,
      true,
      false
    );

    await this.techpayTUSD.addMinter(this.techpayMint.address, { from: owner });

    await this.techpayLiquidationManager.updateTechPayMintContractAddress(
      this.techpayMint.address,
      { from: owner }
    );

    await this.techpayLiquidationManager.updateInitiatorBonus(etherToWei(0.05));

    // mint firstBidder enough tUSD to bid for liquidated collateral
    await this.techpayTUSD.mint(firstBidder, etherToWei(10000), {
      from: owner
    });

    await this.techpayTUSD.mint(secondBidder, etherToWei(10000), {
      from: owner
    });
  });

  describe('Offering ratio provided according to time', function() {
    before(async function() {
      await this.mockToken.mint(borrower, etherToWei(9999));

      await this.mockToken.approve(this.techpayMint.address, etherToWei(9999), {
        from: borrower
      });

      // borrower deposits all his/her 9999 wTPC
      await this.techpayMint.mustDeposit(
        this.mockToken.address,
        etherToWei(9999),
        { from: borrower }
      );

      await this.techpayMint.mustMintMax(this.techpayTUSD.address, 30000, {
        from: borrower
      });

      await this.mockPriceOracleProxy.setPrice(
        this.mockToken.address,
        etherToWei(0.5)
      );

      startTime = await time.latest();
      await this.techpayLiquidationManager.setTime(startTime);

      await this.techpayLiquidationManager.liquidate(borrower, {
        from: initiator
      });
    });

    it('should show offering ratio -- 30% (after 1 minute)', async function() {
      startTime = Number(startTime) + 60; //passing a timestamp with additional 60 seconds
      let details = await this.techpayLiquidationManager.getAuctionPricing(
        new BN('1'),
        new BN(startTime)
      );

      const { 0: offeringRatio } = details;
      expect(offeringRatio.toString()).to.be.equal(amount18(0.3));
    });

    it('should show offering ratio -- 32.6% (after 1 minute 40 seconds)', async function() {
      startTime = Number(startTime) + 40;
      let details = await this.techpayLiquidationManager.getAuctionPricing(
        new BN('1'),
        new BN(startTime)
      );

      const { 0: offeringRatio } = details;
      expect(offeringRatio.toString()).to.be.equal(amount18(0.326666666666666660));
    });

    it('should show offering ratio -- 34% (after 2 minutes)', async function() {
      startTime = Number(startTime) + 20;
      let details = await this.techpayLiquidationManager.getAuctionPricing(
        new BN('1'),
        new BN(startTime)
      );

      const { 0: offeringRatio } = details;
      expect(offeringRatio.toString()).to.be.equal(amount18(0.34));
    });

    it('should show offering ratio -- 51% (after 40 minutes)', async function() {
      startTime = Number(startTime) + 2280;
      let details = await this.techpayLiquidationManager.getAuctionPricing(
        new BN('1'),
        new BN(startTime)
      );

      const { 0: offeringRatio } = details;
      expect(offeringRatio.toString()).to.be.equal(amount18(0.510344827586208000));
    });

    it('should show offering ratio -- 60% (after 1 hour)', async function() {
      startTime = Number(startTime) + 1200;
      let details = await this.techpayLiquidationManager.getAuctionPricing(
        new BN('1'),
        new BN(startTime)
      );

      const { 0: offeringRatio } = details;
      expect(offeringRatio.toString()).to.be.equal(amount18(0.6));
    });

    it('should show offering ratio -- 83.9% (after 3 days)', async function() {
      startTime = Number(startTime) + 255600;
      let details = await this.techpayLiquidationManager.getAuctionPricing(
        new BN('1'),
        new BN(startTime)
      );

      const { 0: offeringRatio } = details;
      expect(offeringRatio.toString()).to.be.equal(amount18('0.838655462185004800'));
    });

    it('should show offering ratio -- 100% (after 5 days)', async function() {
      startTime = Number(startTime) + 172800;
      let details = await this.techpayLiquidationManager.getAuctionPricing(
        new BN('1'),
        new BN(startTime)
      );

      const { 0: offeringRatio } = details;
      expect(offeringRatio.toString()).to.be.equal(amount18(1));
    });

    it('should show offering ratio -- 100% (after 5 and 1 hour)', async function() {
      startTime = Number(startTime) + 428460;
      let details = await this.techpayLiquidationManager.getAuctionPricing(
        new BN('1'),
        new BN(startTime)
      );

      const { 0: offeringRatio } = details;
      expect(offeringRatio.toString()).to.be.equal(amount18(1));
    });
  });
});
