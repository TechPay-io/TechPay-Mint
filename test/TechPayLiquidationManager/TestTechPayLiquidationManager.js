const {
  BN,
  constants,
  expectEvent,
  time
} = require('@openzeppelin/test-helpers');

const { ethers } = require('hardhat');
const { expect } = require('chai');

const { weiToEther, etherToWei, amount18 } = require('../utils/index');

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

let debtValue;
let offeredRatio;
let totalSupply;
let provider;
let startTime;

const PRICE_PRECISION = 1e18;

contract(
  'TechPayLiquidationManager',
  function ([
    owner,
    admin,
    borrower,
    firstBidder,
    secondBidder,
    initiator
  ]) {
    before(async function () {
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

      this.techpayMintRewardDistribution =
        await TechPayMintRewardDistribution.new({
          from: owner
        });
      await this.techpayMintRewardDistribution.initialize(
        owner,
        this.techpayMintAddressProvider.address
      );

      this.mockToken = await MockToken.new({ from: owner });
      await this.mockToken.initialize('wTPC', 'wTPC', 18);

      this.mockToken2 = await MockToken.new({ from: owner });
      await this.mockToken2.initialize('xTPC', 'xTPC', 18);

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
        this.mockToken2.address,
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
        this.mockToken2.address,
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

      await this.techpayLiquidationManager.updateInitiatorBonus(
        etherToWei(0.05)
      );

      // mint firstBidder enough tUSD to bid for liquidated collateral
      await this.techpayTUSD.mint(firstBidder, etherToWei(10000), {
        from: owner
      });
    });

    describe('Deposit Collateral', function () {
      it('should get the correct wTPC price ($1)', async function () {
        const price = await this.mockPriceOracleProxy.getPrice(
          this.mockToken.address
        );

        expect(weiToEther(price).toString()).to.be.equal('1');
      });

      it('should allow the borrower to deposit 9999 wTPC', async function () {
        await this.mockToken.mint(borrower, etherToWei(9999));

        await this.mockToken.approve(
          this.techpayMint.address,
          etherToWei(9999),
          {
            from: borrower
          }
        );

        // make sure the wTPC (test token) can be registered
        const canDeposit = await this.techpayMintTokenRegistry.canDeposit(
          this.mockToken.address
        );
        //console.log('canDeposit: ', canDeposit);
        expect(canDeposit).to.be.equal(true);

        // borrower deposits all his/her 9999 wTPC
        await this.techpayMint.mustDeposit(
          this.mockToken.address,
          etherToWei(9999),
          { from: borrower }
        );

        const balance1 = await this.mockToken.balanceOf(borrower);

        expect(balance1).to.be.bignumber.equal('0');
      });

      it('should show 9999 wTPC in Collateral Pool (for borrower)', async function () {
        // check the collateral balance of the borrower in the collateral pool
        const balance2 = await this.collateralPool.balanceOf(
          borrower,
          this.mockToken.address
        );
        expect(weiToEther(balance2)).to.be.equal('9999');

        // now TechPayMint contract should get 9999 wTPC
        const balance3 = await this.mockToken.balanceOf(
          this.techpayMint.address
        );
        expect(weiToEther(balance3)).to.be.equal('9999');
      });
    });
    describe('Mint tUSD', function () {
      it('should give a maxToMint (tUSD) value around 3333', async function () {
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

        // maxToMint Calculation ((((9999 - ((0 * 30000) / 10000)) / 30000) - 1) * 10**18) / 10**18

        expect(maxToMint).to.be.bignumber.greaterThan('0');
        expect(weiToEther(maxToMint) * 1).to.be.lessThanOrEqual(3333);
      });

      it('should mint maximium (3333) amount of tUSD', async function () {
        // mint maximum amount possible of tUSD for borrower
        await this.techpayMint.mustMintMax(this.techpayTUSD.address, 30000, {
          from: borrower
        });

        const tUSDBalance = await this.techpayTUSD.balanceOf(borrower);
        totalSupply = weiToEther(await this.techpayTUSD.totalSupply());

        expect(weiToEther(tUSDBalance) * 1).to.be.lessThanOrEqual(3333);
      });
    });

    describe('Liquidation phase [Price goes down, single bidder bids completely]', function () {
      it('should get the new updated wTPC price ($1 -> $0.5)', async function () {
        // assume: the value of wTPC has changed to 0.5 USD !!
        await this.mockPriceOracleProxy.setPrice(
          this.mockToken.address,
          etherToWei(0.5)
        );

        const price = await this.mockPriceOracleProxy.getPrice(
          this.mockToken.address
        );

        expect(weiToEther(price).toString()).to.be.equal('0.5');
      });

      it('should find collateral not eligible anymore', async function () {
       // make sure the collateral isn't eligible any more
        const isEligible =
          await this.techpayLiquidationManager.collateralIsEligible(borrower);

        expect(isEligible).to.be.equal(false);
      });

      it('should show unused balance (10000) for initiator', async function () {
        let balance = await provider.getBalance(initiator); // 0

        expect(Number(weiToEther(balance))).to.equal(10000);
      });

      it('should start liquidation', async function () {
      startTime = await time.latest();
      await this.techpayLiquidationManager.setTime(startTime);

        let _auctionStartEvent =
          await this.techpayLiquidationManager.liquidate(borrower, {
            from: initiator
          });

        expectEvent(_auctionStartEvent, 'AuctionStarted', {
          0: new BN('1'),
          1: borrower
        });
      });

      it('should get correct auction details', async function () {
        let newTime = Number(startTime) + 60; //passing a timestamp with 60 additional seconds

        let details = await this.techpayLiquidationManager.getAuctionPricing(
          new BN('1'),
          new BN(newTime)
        );

        const { 0: offeringRatio, 3: auctionStartTime } = details;

        offeredRatio = offeringRatio;
        debtValue = 3366329999999999999998 / 1e18;

        expect(offeringRatio.toString()).to.equal(amount18(0.3));
        expect(auctionStartTime.toString()).to.equal(startTime.toString());
      });

      it('increase time by 1 minute', async function() {
        await this.techpayLiquidationManager.increaseTime(60);
      })

      it('should allow a bidder to bid', async function () {
        await this.techpayTUSD.approve(
          this.techpayLiquidationManager.address,
          etherToWei(5000),
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

      it('the initiator should get initiatorBonus', async function () {
        let balance = await provider.getBalance(initiator); 
        expect(Number(weiToEther(balance))).to.be.greaterThanOrEqual(10000);
      });

      it('the bidder should have (10000 - 3366.33) 6633.67 tUSD remaining', async function () {
        let remainingBalance = 10000 - debtValue;
        let currentBalance = await this.techpayTUSD.balanceOf(firstBidder);

        expect(weiToEther(currentBalance) * 1).to.equal(remainingBalance);
      });

      it('the bidder should get 30% of the total wTPC collateral', async function () {
        let balance = await this.mockToken.balanceOf(firstBidder);

        let offeredCollateral = ((offeredRatio / PRICE_PRECISION) * 9999);
        expect(weiToEther(balance)).to.equal(offeredCollateral.toString());
      });

      it('the collateral pool should get the remaining 70% of the wTPC collateral back', async function () {
        let balance = await this.collateralPool.balanceOf(borrower, this.mockToken.address);

        let remainingCollateral = 9999 - ((offeredRatio / PRICE_PRECISION) * 9999);
        expect(weiToEther(balance)).to.equal(remainingCollateral.toString());
      });

      it('should show the new total supply (after burning tokens)', async function () { 
        let burntAmount = await this.techpayLiquidationManager.getBurntAmount(this.techpayTUSD.address);
        let newTotalSupply = weiToEther(await this.techpayTUSD.totalSupply());

        expect(Number(newTotalSupply)).to.equal(
          totalSupply - weiToEther(burntAmount)
        );
      });
    });
  }
);
