const {
  BN,
  constants,
  expectEvent,
  expectRevert,
  time
} = require('@openzeppelin/test-helpers');

const { ethers } = require('hardhat');
const { expect } = require('chai');

const { weiToEther, etherToWei } = require('./utils/index');

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

contract('TechPayMint', function([
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

    this.mockTokenOne = await MockToken.new({ from: owner });
    this.mockTokenTwo = await MockToken.new({ from: owner });
    this.mockTokenNT = await MockToken.new({ from: owner }); // non-tradable token

    await this.mockTokenOne.initialize('wTPC', 'wTPC', 18);
    await this.mockTokenTwo.initialize('xTPC', 'xTPC', 18);
    await this.mockTokenNT.initialize('sTPC', 'sTPC', 18);

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
      this.mockTokenOne.address,
      etherToWei(1)
    );

    await this.mockPriceOracleProxy.setPrice(
      this.mockTokenTwo.address,
      etherToWei(1)
    );

    await this.mockPriceOracleProxy.setPrice(
      this.mockTokenNT.address,
      etherToWei(0.005)
    );

    await this.mockPriceOracleProxy.setPrice(
      this.techpayTUSD.address,
      etherToWei(1)
    );

    await this.techpayMintTokenRegistry.addToken(
      this.mockTokenOne.address,
      '',
      this.mockPriceOracleProxy.address,
      18,
      true,
      true,
      false,
      true
    );

    await this.techpayMintTokenRegistry.addToken(
      this.mockTokenTwo.address,
      '',
      this.mockPriceOracleProxy.address,
      18,
      true,
      true,
      false,
      true
    );

    await this.techpayMintTokenRegistry.addToken(
      this.mockTokenNT.address,
      '',
      this.mockPriceOracleProxy.address,
      18,
      true,
      true,
      false,
      false
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

  describe('Minting two tradable tokens', function() {
    before(async function() {
      await this.mockTokenOne.mint(borrower, etherToWei(7500));
      await this.mockTokenTwo.mint(borrower, etherToWei(7500));
    });

    it('should allow the borrower to deposit 7500 wTPC and 7500 xTPC', async function() {
      await this.mockTokenOne.approve(
        this.techpayMint.address,
        etherToWei(7500),
        { from: borrower }
      );

      await this.mockTokenTwo.approve(
        this.techpayMint.address,
        etherToWei(7500),
        { from: borrower }
      );

      // borrower deposits all his/her 7500 wTPC
      await this.techpayMint.mustDeposit(
        this.mockTokenOne.address,
        etherToWei(7500),
        { from: borrower }
      );

      // borrower deposits all his/her 7500 xTPC
      await this.techpayMint.mustDeposit(
        this.mockTokenTwo.address,
        etherToWei(7500),
        { from: borrower }
      );
    });

    it('should show 7500 wTPC and 7500 xTPC in Collateral Pool (for borrower)', async function() {
      // check the collateral balance of the borrower in the collateral pool
      const balanceOne = await this.collateralPool.balanceOf(
        borrower,
        this.mockTokenOne.address
      );

      const balanceTwo = await this.collateralPool.balanceOf(
        borrower,
        this.mockTokenTwo.address
      );

      expect(weiToEther(balanceOne)).to.be.equal('7500');
      expect(weiToEther(balanceTwo)).to.be.equal('7500');

      // now TechPayMint contract should get 7500 wTPC and 7500 xTPC
      const mintBalanceOne = await this.mockTokenOne.balanceOf(
        this.techpayMint.address
      );
      const mintBalanceTwo = await this.mockTokenTwo.balanceOf(
        this.techpayMint.address
      );
      const balanceX = await this.mockTokenTwo.balanceOf(
        borrower
      );

      expect(weiToEther(mintBalanceOne)).to.be.equal('7500');
      expect(weiToEther(mintBalanceTwo)).to.be.equal('7500');
    });

    it('should give a maxToMint (tUSD) value of 5000', async function() {
      const maxToMint = await this.techpayMint.maxToMint(
        borrower,
        this.techpayTUSD.address,
        30000
      );

      // let debtOfAccount = await this.debtPool.totalOf(borrower);
      // let collateralOfAccount = await this.collateralPool.totalOf(borrower);

      // console.log('maxToMint in ether: ', weiToEther(maxToMint) * 1);
      // console.log('current DEBT (debtValueOf): ', weiToEther(debtOfAccount));
      // console.log(
      //   'current Collateral (collateralValueOf): ',
      //   weiToEther(collateralOfAccount)
      // );

      // maxToMint Calculation (((((10000 - ((0 * 30000) / 10000)) * 10000) / 30000) - 1) * 10**18) / 10**18

      expect(maxToMint).to.be.bignumber.greaterThan('0');
      expect(weiToEther(maxToMint) * 1).to.be.greaterThanOrEqual(5000);
    });

    it('should mint maximium (5000) amount of tUSD', async function() {
      // mint maximum amount possible of tUSD for borrower
      await this.techpayMint.mustMintMax(this.techpayTUSD.address, 30000, {
        from: borrower
      });

      const tUSDBalance = await this.techpayTUSD.balanceOf(borrower);
      expect(weiToEther(tUSDBalance) * 1).to.be.lessThanOrEqual(5000);
    });
  });

    describe('Minting a non-tradable token', function() {
    it('should allow the borrower to deposit 5000 sTPC (non-tradable token)', async function() {
      await this.mockTokenNT.mint(borrower, etherToWei(5000));

      await this.mockTokenNT.approve(
        this.techpayMint.address,
        etherToWei(5000),
        { from: borrower }
      );

      // borrower deposits all his/her 5000 sTPC
      await this.techpayMint.mustDeposit(
        this.mockTokenNT.address,
        etherToWei(5000),
        { from: borrower }
      );

      const balance = await this.collateralPool.balanceOf(
        borrower,
        this.mockTokenNT.address
      );

      expect(weiToEther(balance)).to.be.equal('5000');
    });

    it('should allow minting of tUSD after depositing non-tradable collateral', async function() {
      const maxToMint = await this.techpayMint.maxToMint(
        borrower,
        this.techpayTUSD.address,
        30000
      );
      expect(weiToEther(maxToMint) * 1).to.be.lessThanOrEqual(8.4);
    });

    it('should mint maximium (8.33) amount of tUSD', async function() {
      // mint maximum amount possible of tUSD for borrower
      await this.techpayMint.mustMintMax(this.techpayTUSD.address, 30000, {
        from: borrower
      });

      const tUSDBalance = await this.techpayTUSD.balanceOf(borrower);
      expect(weiToEther(tUSDBalance) * 1).to.be.lessThan(5000);
    });
  });

  describe('Liquidation phase [Price goes down, single bidder bids completely]', function() {
    it('should get the new updated xTPC price ($1 -> $0.5)', async function() {
      await this.mockPriceOracleProxy.setPrice(
        this.mockTokenTwo.address,
        etherToWei(0.5)
      );

      const price = await this.mockPriceOracleProxy.getPrice(
        this.mockTokenTwo.address
      );

      expect(weiToEther(price).toString()).to.be.equal('0.5');
    });

    it('should find collateral not eligible anymore', async function() {
      // make sure the collateral isn't eligible any more
      const isEligible = await this.techpayLiquidationManager.collateralIsEligible(
        borrower
      );

      expect(isEligible).to.be.equal(false);
    });

    it('should show unused balance (10000) for initiator', async function() {
      let balance = await provider.getBalance(initiator); // 0

      expect(Number(weiToEther(balance))).to.equal(10000);
    });

    it('should start liquidation', async function() {
      let _auctionStartEvent = await this.techpayLiquidationManager.liquidate(
        borrower,
        {from: initiator
        }
      );

      expectEvent(_auctionStartEvent, 'AuctionStarted', {
        0: new BN('1'),
        1: borrower
      });
    });

    it('increase time by 1 minute', async function() {
      await this.techpayLiquidationManager.increaseTime(60);
    })

    it('should allow a bidder to bid', async function() {
      await this.techpayTUSD.approve(
        this.techpayLiquidationManager.address,
        etherToWei(6000),
        { from: firstBidder }
      );

      let _bidPlacedEvent = await this.techpayLiquidationManager.bid(1, etherToWei(1), {
        from: firstBidder,
        value: etherToWei(0.05)
      });

      expectEvent(_bidPlacedEvent, 'BidPlaced', {
        nonce: new BN('1'),
        percentage: etherToWei(1),
        bidder: firstBidder,
        offeredRatio: etherToWei(0.3)
      });
    });

    it('the initiator should get initiatorBonus', async function() {
      let balance = await provider.getBalance(initiator); // 0
      expect(Number(weiToEther(balance))).to.be.greaterThanOrEqual(10000);
    });

    it('the bidder should have (10000 - 5059) 4941 tUSD remaining', async function() {
      let currentBalance = await this.techpayTUSD.balanceOf(firstBidder);
      expect(weiToEther(currentBalance) * 1).to.lessThan(4950);
    });

    it('the bidder should get 30% of the total wTPC/xTPC collateral', async function() {
      let balanceOne = await this.mockTokenOne.balanceOf(firstBidder);
      let balanceTwo = await this.mockTokenTwo.balanceOf(firstBidder);
      
      expect(weiToEther(balanceOne)).to.equal('2250');
      expect(weiToEther(balanceTwo)).to.equal('2250');
      
    });

    it('the bidder should not receive any % from non-tradable (sTPC)', async function() {
      let balanceThree = await this.mockTokenNT.balanceOf(firstBidder);
      expect(weiToEther(balanceThree)).to.equal('0');
    })

    it('the collateral pool should get the remaining 70% of the wTPC collateral back', async function() {
      let balanceOne = await this.collateralPool.balanceOf(borrower, this.mockTokenOne.address);
      let balanceTwo = await this.collateralPool.balanceOf(borrower, this.mockTokenTwo.address);

      expect(weiToEther(balanceOne)).to.equal('5250');
      expect(weiToEther(balanceTwo)).to.equal('5250');
    });
  });
});
