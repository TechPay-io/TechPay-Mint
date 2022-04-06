//npx hardhat test .\test\TechPayLiquidationManager.test.js --network localhost
// or truffle test .\test\TechPayLiquidationManager.test.js --network ganache
const {
  BN,
  constants,
  expectEvent,
  expectRevert,
  time
} = require('@openzeppelin/test-helpers');
const { ZERO_ADDRESS } = constants;

const { expect } = require('chai');

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

const weiToEther = (n) => {
  return web3.utils.fromWei(n.toString(), 'ether');
};

const etherToWei = (n) => {
  return new web3.utils.BN(web3.utils.toWei(n.toString(), 'ether'));
};

console.log(`
Notes:
- The amount of the collateral that bidders receive don't seem correct. The borrower seem
  to be refunded too much.`);

contract('Unit Test for TechPayLiquidationManager', function([
  owner,
  admin,
  borrower,
  bidder1,
  bidder2,
  techpayFeeVault
]) {
  beforeEach(async function() {
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

    this.techpayMint = await TechPayMint.new({ form: owner });
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

    this.mockToken2 = await MockToken.new({ from: owner });
    await this.mockToken2.initialize('wTPC2', 'wTPC2', 18);

    this.mockPriceOracleProxy = await MockPriceOracleProxy.new({ from: owner });

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

    // set the initial value; 1 wTPC = 1 USD; 1 wTPC2 = 1 USD; 1 tUSD = 1 USD
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
      false
    );
    await this.techpayMintTokenRegistry.addToken(
      this.mockToken2.address,
      '',
      this.mockPriceOracleProxy.address,
      18,
      true,
      true,
      false
    );
    await this.techpayMintTokenRegistry.addToken(
      this.techpayTUSD.address,
      '',
      this.mockPriceOracleProxy.address,
      18,
      true,
      false,
      true
    );

    await this.techpayTUSD.addMinter(this.techpayMint.address, { from: owner });

    await this.techpayLiquidationManager.updateTechPayMintContractAddress(
      this.techpayMint.address,
      { from: owner }
    );
    await this.techpayLiquidationManager.updateTechPayUSDAddress(
      this.techpayTUSD.address
    );

    await this.techpayLiquidationManager.addAdmin(admin, { from: owner });

    await this.techpayLiquidationManager.updateTechPayFeeVault(techpayFeeVault, {
      from: owner
    });

    /** all the necesary setup */
  });

  describe('depositing collateral and minting tUSD', function() {
    /*  it('gets the price of wTPC', async function() {
            // check the initial value of wTPC
            const price = await this.mockPriceOracleProxy.getPrice(this.mockToken.address);
            console.log(`
            *The price of wTPC should be ${weiToEther(price)} USD`);
            //console.log(weiToEther(price));
            expect(weiToEther(price).toString()).to.be.equal('1');        
        }) */

    /*  it('Scenario 1', async function(){
            
            console.log(`
            Scenario 1:
            Borrower approves and deposits 9999 wTPC, 
            Then mints possible max amount of tUSD,
            The price of the wTPC changes from 1 to 0.5,
            The liquidation starts
            Bidder1 approve 5000 tUSDs and bids the auction to get all 9999 wTPC`);

            console.log('');
            console.log(`
            Mint 9999 wTPCs for the borrower so he/she can borrow some tUSD`);
            await this.mockToken.mint(borrower, etherToWei(9999));

            console.log(`
            Mint bidder1 10000 tUSDs to bid for the liquidated collateral`);
            await this.techpayTUSD.mint(bidder1, etherToWei(10000), {from: owner});

            console.log(`
            Borrower approves 9999 wTPC to TechPayMint contract`);
            await this.mockToken.approve(this.techpayMint.address, etherToWei(9999), {from: borrower});

            console.log(`
            Borrower deposits all his/her 9999 wTPCs`);
            await this.techpayMint.mustDeposit(this.mockToken.address, etherToWei(9999), {from: borrower});

            console.log(`
            *Now the borrower should have 0 wTPC`);
            let balance = await this.mockToken.balanceOf(borrower);
            expect(balance).to.be.bignumber.equal('0');

            console.log(`
            Mint the maximum amount of tUSD for the borrower`);
            await this.techpayMint.mustMintMax(this.techpayTUSD.address, 32000, {from: borrower});
            console.log(`
            *Now borrower should have tUSD between 0 and 3333`);
            let amount = await this.techpayTUSD.balanceOf(borrower);
            expect(amount).to.be.bignumber.greaterThan('0');
            expect(weiToEther(amount)*1).to.be.lessThanOrEqual(3333);
            console.log(`
            The actual amount of tUSD minted: `, weiToEther(amount));

            console.log(`
            Let's set the price of wTPC to 0.5 USD`);
            await this.mockPriceOracleProxy.setPrice(this.mockToken.address, etherToWei(0.5));
            
            console.log(`
            An admin starts the liquidation`);
            let result = await this.techpayLiquidationManager.startLiquidation(borrower, {from: admin});

            console.log(`
            *Event AuctionStarted should be emitted with correct values: nonce = 1, user = borrower`);
            expectEvent.inLogs(result.logs, 'AuctionStarted',{
                nonce: new BN('1'),
                user: borrower
            })

            console.log(`
            Bidder1 approves TechPayLiquidationManager to spend 5000 tUSD to buy the collateral`);
            await this.techpayTUSD.approve(this.techpayLiquidationManager.address, etherToWei(5000), {from: bidder1});

            console.log(`
            Bidder1 bids all the collateral`);
            await this.techpayLiquidationManager.bidAuction(1, new BN('100000000'), {from: bidder1});

            console.log(`
            *Bidder1's tUSD balance should be less than 10000`);
            balance = await this.techpayTUSD.balanceOf(bidder1);
            expect(weiToEther(balance)*1).to.be.lessThan(10000);

            console.log(`
            The actual balance of bidder1's tUSD now: ${weiToEther(balance)}`);

            console.log(`
            The amount of tUSD that bidder1 has spent is 10000 minus ${weiToEther(balance)}`);
            let balance2 = 10000 - weiToEther(balance);

            console.log(`
            The actual amount of tUSD that bidder1 has spent is ${balance2}`);

            console.log(`
            Check the amount of tUSD that techpayFeeVault has`);
            balance = await this.techpayTUSD.balanceOf(techpayFeeVault);

            console.log(`
            The actual balance of techpayFeeVault's tUSD now: ${weiToEther(balance)}`);

            console.log(`
            *The two amounts should be the same`);
            expect(balance2).to.be.equal(weiToEther(balance)*1);

            console.log(`
            Check the amount of wTPC that bidder1 receives`);
            balance = await this.mockToken.balanceOf(bidder1);

            console.log(`
            The amount of wTPC that bidder1 receives: ${weiToEther(balance)}`);

            console.log(`
            Check the amount of wTPC that borrower is refunded`);
            balance2 = await this.mockToken.balanceOf(borrower);

            console.log(`
            The amount of wTPC that borrower is refunded: ${weiToEther(balance2)}`);
            
            console.log(`
            *The actual wTPC balance of bidder1 and the borrower should be 9999`);
            expect(weiToEther(balance)*1 + weiToEther(balance2)*1).to.be.equal(9999);

        })

        it('Scenario 2', async function(){
            
            console.log(`
            Scenario 2:
            Borrower approves and deposits 9999 wTPC 
            Then mints possible max amount of tUSD
            The price of the wTPC changes from 1 to 0.5
            The liquidation starts
            Bidder1 approves 2500 tUSDs and bids the auction to get 4999.5 wTPC`);

            console.log('');
            console.log(`
            Mint 9999 wTPCs for the borrower so he/she can borrow some tUSD`);
            await this.mockToken.mint(borrower, etherToWei(9999));

            console.log(`
            Mint bidder1 10000 tUSDs to bid for the liquidated collateral`);
            await this.techpayTUSD.mint(bidder1, etherToWei(10000), {from: owner});

            console.log(`
            Borrower approves 9999 wTPC to TechPayMint contract`);
            await this.mockToken.approve(this.techpayMint.address, etherToWei(9999), {from: borrower});

            console.log(`
            Borrower deposits all his/her 9999 wTPCs`);
            await this.techpayMint.mustDeposit(this.mockToken.address, etherToWei(9999), {from: borrower});

            console.log(`
            *Now the borrower should have 0 wTPC`);
            let balance = await this.mockToken.balanceOf(borrower);
            expect(balance).to.be.bignumber.equal('0');

            console.log(`
            Mint the maximum amount of tUSD for the borrower`);
            await this.techpayMint.mustMintMax(this.techpayTUSD.address, 32000, {from: borrower});
            console.log(`
            *Now borrower should have tUSD between 0 and 3333`);
            let amount = await this.techpayTUSD.balanceOf(borrower);
            expect(amount).to.be.bignumber.greaterThan('0');
            expect(weiToEther(amount)*1).to.be.lessThanOrEqual(3333);
            console.log(`
            The actual amount of tUSD minted: `, weiToEther(amount));

            console.log(`
            Let's set the price of wTPC to 0.5 USD`);
            await this.mockPriceOracleProxy.setPrice(this.mockToken.address, etherToWei(0.5));
            
            console.log(`
            An admin starts the liquidation`);
            let result = await this.techpayLiquidationManager.startLiquidation(borrower, {from: admin});

            console.log(`
            *Event AuctionStarted should be emitted with correct values: nonce = 1, user = borrower`);
            expectEvent.inLogs(result.logs, 'AuctionStarted',{
                nonce: new BN('1'),
                user: borrower
            })

            console.log(`
            Bidder1 approves TechPayLiquidationManager to spend 2500 tUSD to buy the collateral`);
            await this.techpayTUSD.approve(this.techpayLiquidationManager.address, etherToWei(2500), {from: bidder1});

            console.log(`
            Bidder1 bids  the collateral`);
            await this.techpayLiquidationManager.bidAuction(1, new BN('50000000'), {from: bidder1});

            console.log(`
            *Bidder1's tUSD balance should be less than 10000`);
            balance = await this.techpayTUSD.balanceOf(bidder1);
            expect(weiToEther(balance)*1).to.be.lessThan(10000);

            console.log(`
            The actual balance of bidder1's tUSD now: ${weiToEther(balance)}`);

            console.log(`
            The amount of tUSD that bidder1 has spent is 10000 minus ${weiToEther(balance)}`);
            let balance2 = 10000 - weiToEther(balance);

            console.log(`
            The actual amount of tUSD that bidder1 has spent is ${balance2}`);

            console.log(`
            Check the amount of tUSD that techpayFeeVault has`);
            balance = await this.techpayTUSD.balanceOf(techpayFeeVault);

            console.log(`
            The actual balance of techpayFeeVault's tUSD now: ${weiToEther(balance)}`);

            console.log(`
            *The two amounts should be the same`);
            expect(balance2.toFixed(3)).to.be.equal((weiToEther(balance)*1).toFixed(3));

            console.log(`
            Check the amount of wTPC that bidder1 receives`);
            balance = await this.mockToken.balanceOf(bidder1);

            console.log(`
            The amount of wTPC that bidder1 receives: ${weiToEther(balance)}`);

            console.log(`
            Check the amount of wTPC that borrower is refunded`);
            balance2 = await this.mockToken.balanceOf(borrower);

            console.log(`
            The amount of wTPC that borrower is refunded: ${weiToEther(balance2)}`)            

            console.log(`
            *The actual wTPC balance of bidder1 and the borrower should be 4999.5`);
            expect(weiToEther(balance)*1 + weiToEther(balance2)*1).to.be.equal(4999.5);

            console.log(`
            *The remaining of collateral with TechPayMint should be 4999.5`);
            balance = await this.mockToken.balanceOf(this.techpayMint.address);
            expect(weiToEther(balance)*1).to.be.equal(4999.5);

        })

        it('Scenario 3', async function(){
            
            console.log(`
            Scenario 3:
            Borrower approves and deposits 9999 wTPC, 
            Then mints possible max amount of tUSD,
            The price of the wTPC changes from 1 to 0.5,
            The liquidation starts
            Bidder1 tries to bid the auction to get all 9999 wTPC but forgets to approve enough amount
            The bid will fail`);

            console.log('');
            console.log(`
            Mint 9999 wTPCs for the borrower so he/she can borrow some tUSD`);
            await this.mockToken.mint(borrower, etherToWei(9999));

            console.log(`
            Mint bidder1 10000 tUSDs to bid for the liquidated collateral`);
            await this.techpayTUSD.mint(bidder1, etherToWei(10000), {from: owner});

            console.log(`
            Borrower approves 9999 wTPC to TechPayMint contract`);
            await this.mockToken.approve(this.techpayMint.address, etherToWei(9999), {from: borrower});

            console.log(`
            Borrower deposits all his/her 9999 wTPCs`);
            await this.techpayMint.mustDeposit(this.mockToken.address, etherToWei(9999), {from: borrower});

            console.log(`
            *Now the borrower should have 0 wTPC`);
            let balance = await this.mockToken.balanceOf(borrower);
            expect(balance).to.be.bignumber.equal('0');

            console.log(`
            Mint the maximum amount of tUSD for the borrower`);
            await this.techpayMint.mustMintMax(this.techpayTUSD.address, 32000, {from: borrower});
            console.log(`
            *Now borrower should have tUSD between 0 and 3333`);
            let amount = await this.techpayTUSD.balanceOf(borrower);
            expect(amount).to.be.bignumber.greaterThan('0');
            expect(weiToEther(amount)*1).to.be.lessThanOrEqual(3333);
            console.log(`
            The actual amount of tUSD minted: `, weiToEther(amount));

            console.log(`
            Let's set the price of wTPC to 0.5 USD`);
            await this.mockPriceOracleProxy.setPrice(this.mockToken.address, etherToWei(0.5));
            
            console.log(`
            An admin starts the liquidation`);
            let result = await this.techpayLiquidationManager.startLiquidation(borrower, {from: admin});

            console.log(`
            *Event AuctionStarted should be emitted with correct values: nonce = 1, user = borrower`);
            expectEvent.inLogs(result.logs, 'AuctionStarted',{
                nonce: new BN('1'),
                user: borrower
            })
            
            console.log(`
            *Bidder1 bids all the collateral but will fail as he forgets to approve enough 
            amount of tUSD to be transferred`);
            await expectRevert(this.techpayLiquidationManager.bidAuction(1, new BN('100000000'), {from: bidder1}),"Low allowance of debt token.");
            

        }) */

    it('Scenario 4', async function() {
      console.log(`
            Scenario 4:
            Borrower approves and deposits 9999 wTPC, 
            Then mints possible max amount of tUSD,
            The price of the wTPC changes from 1 to 1.5,
            The liquidation starts but it will fail with "Collateral is not eligible for liquidation"
            `);

      console.log('');
      console.log(`
            Mint 9999 wTPCs for the borrower so he/she can borrow some tUSD`);
      await this.mockToken.mint(borrower, etherToWei(9999));

      console.log(`
            Mint bidder1 10000 tUSDs to bid for the liquidated collateral`);
      await this.techpayTUSD.mint(bidder1, etherToWei(10000), { from: owner });

      console.log(`
            Borrower approves 9999 wTPC to TechPayMint contract`);
      await this.mockToken.approve(this.techpayMint.address, etherToWei(9999), {
        from: borrower
      });

      console.log(`
            Borrower deposits all his/her 9999 wTPCs`);
      await this.techpayMint.mustDeposit(
        this.mockToken.address,
        etherToWei(9999),
        { from: borrower }
      );

      console.log(`
            *Now the borrower should have 0 wTPC`);
      let balance = await this.mockToken.balanceOf(borrower);
      expect(balance).to.be.bignumber.equal('0');

      console.log(`
            Mint the maximum amount of tUSD for the borrower`);
      await this.techpayMint.mustMintMax(this.techpayTUSD.address, 32000, {
        from: borrower
      });
      console.log(`
            *Now borrower should have tUSD between 0 and 3333`);
      let amount = await this.techpayTUSD.balanceOf(borrower);
      expect(amount).to.be.bignumber.greaterThan('0');
      expect(weiToEther(amount) * 1).to.be.lessThanOrEqual(3333);
      console.log(
        `
            The actual amount of tUSD minted: `,
        weiToEther(amount)
      );

      console.log(`
            Let's set the price of wTPC to 0.5 USD`);
      await this.mockPriceOracleProxy.setPrice(
        this.mockToken.address,
        etherToWei(1.5)
      );

      console.log(`
            *An admin starts the liquidation but it will fail with "Collateral is not eligible for liquidation"`);
      await expectRevert(
        this.techpayLiquidationManager.startLiquidation(borrower, {
          from: admin
        }),
        'Collateral is not eligible for liquidation'
      );
    });

    it('Scenario 5', async function() {
      console.log(`
            Scenario 5:
            Borrower approves and deposits 9999 wTPC, 
            Then mints possible max amount of tUSD,
            The price of the wTPC changes from 1 to 0.5,
            The liquidation starts
            Bidder1 approve 1500 tUSDs and bids the auction to get a quarter of 9999 wTPC
            Bidder2 approve 3900 tUSDs and bids the auction to get the rest or three quarters of 9999 wTPC`);

      console.log('');
      console.log(`
            Mint 9999 wTPCs for the borrower so he/she can borrow some tUSD`);
      await this.mockToken.mint(borrower, etherToWei(9999));

      console.log(`
            Mint bidder1 10000 tUSDs to bid for the liquidated collateral`);
      await this.techpayTUSD.mint(bidder1, etherToWei(10000), { from: owner });

      console.log(`
            Mint bidder2 10000 tUSDs to bid for the liquidated collateral`);
      await this.techpayTUSD.mint(bidder2, etherToWei(10000), { from: owner });

      console.log(`
            Borrower approves 9999 wTPC to TechPayMint contract`);
      await this.mockToken.approve(this.techpayMint.address, etherToWei(9999), {
        from: borrower
      });

      console.log(`
            Borrower deposits all his/her 9999 wTPCs`);
      await this.techpayMint.mustDeposit(
        this.mockToken.address,
        etherToWei(9999),
        { from: borrower }
      );

      console.log(`
            *Now the borrower should have 0 wTPC`);
      let balance = await this.mockToken.balanceOf(borrower);
      expect(balance).to.be.bignumber.equal('0');

      console.log(`
            Mint the maximum amount of tUSD for the borrower`);
      await this.techpayMint.mustMintMax(this.techpayTUSD.address, 32000, {
        from: borrower
      });
      console.log(`
            *Now borrower should have tUSD between 0 and 3333`);
      let amount = await this.techpayTUSD.balanceOf(borrower);
      expect(amount).to.be.bignumber.greaterThan('0');
      expect(weiToEther(amount) * 1).to.be.lessThanOrEqual(3333);
      console.log(
        `
            The actual amount of tUSD minted: `,
        weiToEther(amount)
      );

      console.log(`
            Let's set the price of wTPC to 0.5 USD`);
      await this.mockPriceOracleProxy.setPrice(
        this.mockToken.address,
        etherToWei(0.5)
      );

      console.log(`
            An admin starts the liquidation`);
      let result = await this.techpayLiquidationManager.startLiquidation(
        borrower,
        { from: admin }
      );

      console.log(`
            *Event AuctionStarted should be emitted with correct values: nonce = 1, user = borrower`);
      expectEvent(result, 'AuctionStarted', {
        nonce: new BN('1'),
        user: borrower
      });

      console.log(`
            Bidder1 approves TechPayLiquidationManager to spend 1500 tUSD to buy the a quarter of the collateral`);
      await this.techpayTUSD.approve(
        this.techpayLiquidationManager.address,
        etherToWei(1500),
        { from: bidder1 }
      );

      console.log(`
            Bidder1 bids 25% of the collateral`);
      await this.techpayLiquidationManager.bidAuction(1, new BN('25000000'), {
        from: bidder1
      });

      console.log(`
            *Bidder1's tUSD balance should be less than 10000`);
      balance = await this.techpayTUSD.balanceOf(bidder1);
      expect(weiToEther(balance) * 1).to.be.lessThan(10000);

      console.log(`
            The actual balance of bidder1's tUSD now: ${weiToEther(balance)}`);

      console.log(`
            The amount of tUSD that bidder1 has spent is 10000 minus ${weiToEther(
              balance
            )}`);
      let balance2 = 10000 - weiToEther(balance);

      console.log(`
            The actual amount of tUSD that bidder1 has spent is ${balance2}`);

      console.log(`
            Bidder2 approves TechPayLiquidationManager to spend 3900 tUSD to buy the a quarter of the collateral`);
      await this.techpayTUSD.approve(
        this.techpayLiquidationManager.address,
        etherToWei(3900),
        { from: bidder2 }
      );

      console.log(`
            Bidder2 bids the rest of the collateral`);
      await this.techpayLiquidationManager.bidAuction(1, new BN('100000000'), {
        from: bidder2
      });

      console.log(`
            *Bidder2's tUSD balance should be less than 10000`);
      balance = await this.techpayTUSD.balanceOf(bidder2);
      expect(weiToEther(balance) * 1).to.be.lessThan(10000);

      console.log(`
            The actual balance of bidder2's tUSD now: ${weiToEther(balance)}`);

      console.log(`
            The amount of tUSD that bidder2 has spent is 10000 minus ${weiToEther(
              balance
            )}`);
      let balance3 = 10000 - weiToEther(balance);

      console.log(`
            The actual amount of tUSD that bidder2 has spent is ${balance3}`);

      console.log(`
            Check the amount of tUSD that techpayFeeVault has`);
      let balance4 = await this.techpayTUSD.balanceOf(techpayFeeVault);

      console.log(`
            The actual balance of techpayFeeVault's tUSD now: ${weiToEther(
              balance4
            )}`);

      console.log(`
            *The tUSD techpayFeeVault's balance should be the same as total of tUSDs paid by bidder1 and bidder2`);
      expect((balance2 + balance3).toFixed(3)).to.be.equal(
        (weiToEther(balance4) * 1).toFixed(3)
      );

      console.log(`
            Check the amount of wTPC that bidder1 receives`);
      balance = await this.mockToken.balanceOf(bidder1);

      console.log(
        `
            The actual amount of wTPC that bidder1 receives: `,
        weiToEther(balance)
      );

      console.log(`
            Check the amount of wTPC that bidder2 receives`);
      balance2 = await this.mockToken.balanceOf(bidder2);

      console.log(
        `
            The actual amount of wTPC that bidder2 receives: `,
        weiToEther(balance2)
      );

      console.log(`
            Check the amount of wTPC that borrower is refunded`);
      balance3 = await this.mockToken.balanceOf(borrower);

      console.log(`
            The amount of wTPC that borrower is refunded: ${weiToEther(
              balance3
            )}`);

      console.log(`
            *The actual wTPC balance of bidder1,bidder2 and the borrower should be 9999`);
      expect(
        weiToEther(balance) * 1 +
          weiToEther(balance2) * 1 +
          weiToEther(balance3) * 1
      ).to.be.equal(9999);
    });

    it('Scenario 6', async function() {
      console.log(`
            Scenario 6:
            Borrower approves and deposits 9999 wTPC, 
            Then mints possible max amount of tUSD,
            The price of the wTPC changes from 1 to 0.5,
            The liquidation starts
            Check the collateral value
            10 hours pass no body bids
            Check the collateral after 10 hours`);

      console.log('');
      console.log(`
            Mint 9999 wTPCs for the borrower so he/she can borrow some tUSD`);
      await this.mockToken.mint(borrower, etherToWei(9999));

      console.log(`
            Mint bidder1 10000 tUSDs to bid for the liquidated collateral`);
      await this.techpayTUSD.mint(bidder1, etherToWei(10000), { from: owner });

      console.log(`
            Mint bidder2 10000 tUSDs to bid for the liquidated collateral`);
      await this.techpayTUSD.mint(bidder2, etherToWei(10000), { from: owner });

      console.log(`
            Borrower approves 9999 wTPC to TechPayMint contract`);
      await this.mockToken.approve(this.techpayMint.address, etherToWei(9999), {
        from: borrower
      });

      console.log(`
            Borrower deposits all his/her 9999 wTPCs`);
      await this.techpayMint.mustDeposit(
        this.mockToken.address,
        etherToWei(9999),
        { from: borrower }
      );

      console.log(`
            *Now the borrower should have 0 wTPC`);
      let balance = await this.mockToken.balanceOf(borrower);
      expect(balance).to.be.bignumber.equal('0');

      console.log(`
            Mint the maximum amount of tUSD for the borrower`);
      await this.techpayMint.mustMintMax(this.techpayTUSD.address, 32000, {
        from: borrower
      });
      console.log(`
            *Now borrower should have tUSD between 0 and 3333`);
      let amount = await this.techpayTUSD.balanceOf(borrower);
      expect(amount).to.be.bignumber.greaterThan('0');
      expect(weiToEther(amount) * 1).to.be.lessThanOrEqual(3333);
      console.log(
        `
            The actual amount of tUSD minted: `,
        weiToEther(amount)
      );

      console.log(`
            Let's set the price of wTPC to 0.5 USD`);
      await this.mockPriceOracleProxy.setPrice(
        this.mockToken.address,
        etherToWei(0.5)
      );

      console.log(`
            An admin starts the liquidation`);
      let result = await this.techpayLiquidationManager.startLiquidation(
        borrower,
        { from: admin }
      );

      console.log(`
            *Event AuctionStarted should be emitted with correct values: nonce = 1, user = borrower`);
      expectEvent(result, 'AuctionStarted', {
        nonce: new BN('1'),
        user: borrower
      });

      console.log(`
            Get the liquidation detail now`);
      let liquidationDetails = await this.techpayLiquidationManager.getLiquidationDetails(
        1
      );
      console.log(
        `
            The offeringRatio now: `,
        weiToEther(liquidationDetails[0])
      );
      console.log(
        `
            Collateral Value now: `,
        weiToEther(liquidationDetails[4][0])
      );

      console.log(`
            Fast forward 10 hours`);
      //await time.increase(10*60*60);
      await this.techpayLiquidationManager.increaseTime(10 * 60 * 60);

      console.log(`
            Get the liquidation detail after 10 hours`);
      liquidationDetails = await this.techpayLiquidationManager.getLiquidationDetails(
        1
      );
      console.log(
        `
            The offeringRatio after 10 hours: `,
        weiToEther(liquidationDetails[0])
      );
      console.log(
        `
            Collateral Value after 10 hours: `,
        weiToEther(liquidationDetails[4][0])
      );

      console.log(`
            Should the the Collateral value after 10 hours be greater?`);
    });

    it('Scenario 7', async function() {
      console.log(`
            Scenario 7: 
            Borrower approves and deposit 5000 wTPC and 4999 wTPC2
            Then mints possible max amount of tUSD
            The price of the wTPC2 drops to 0.5
            The liquidation starts
            Bidder1 approves 2500 tUSDs and bids for wTPC2`);

      console.log('');
      console.log(`
            Mint 5000 wTPCs for the borrower so he/she can borrow some tUSD`);
      await this.mockToken.mint(borrower, etherToWei(5000));

      console.log(`
            Mint 4999 wTPC2s for the borrower so he/she can borrow some tUSD`);
      await this.mockToken2.mint(borrower, etherToWei(4999));

      console.log(`
            Borrower approves 5000 wTPCs and 4999 wTPC2 to TechPayMint contract`);
      await this.mockToken.approve(this.techpayMint.address, etherToWei(5000), {
        from: borrower
      });
      await this.mockToken2.approve(this.techpayMint.address, etherToWei(4999), {
        from: borrower
      });

      console.log(`
            Mint bidder1 10000 tUSDs to bid for the liquidated collateral`);
      await this.techpayTUSD.mint(bidder1, etherToWei(10000), { from: owner });

      console.log(`
            Borrower deposits all his/her 5000 wTPCs and 4999 wTPC2s`);
      await this.techpayMint.mustDeposit(
        this.mockToken.address,
        etherToWei(5000),
        { from: borrower }
      );
      await this.techpayMint.mustDeposit(
        this.mockToken2.address,
        etherToWei(4999),
        { from: borrower }
      );

      console.log(`
            *Now the borrower should have 0 wTPC and 0 wTPC2`);
      let balance = await this.mockToken.balanceOf(borrower);
      expect(balance).to.be.bignumber.equal('0');

      balance = await this.mockToken2.balanceOf(borrower);
      expect(balance).to.be.bignumber.equal('0');

      console.log(`
            Mint the maximum amount of tUSD for the borrower`);
      await this.techpayMint.mustMintMax(this.techpayTUSD.address, 32000, {
        from: borrower
      });
      console.log(`
            *Now borrower should have tUSD between 0 and 3333`);
      let amount = await this.techpayTUSD.balanceOf(borrower);
      expect(amount).to.be.bignumber.greaterThan('0');
      expect(weiToEther(amount) * 1).to.be.lessThanOrEqual(3333);
      console.log(
        `
            The actual amount of tUSD minted: `,
        weiToEther(amount)
      );

      console.log(`
            Let's set the price of wTPC2 to 0.5 USD`);
      await this.mockPriceOracleProxy.setPrice(
        this.mockToken2.address,
        etherToWei(0.5)
      );

      console.log(`
            An admin starts the liquidation`);
      let result = await this.techpayLiquidationManager.startLiquidation(
        borrower,
        { from: admin }
      );

      console.log(`
            *Event AuctionStarted should be emitted with correct values: nonce = 1, user = borrower`);
      expectEvent(result, 'AuctionStarted', {
        nonce: new BN('1'),
        user: borrower
      });

      console.log(`
            Bidder1 approves TechPayLiquidationManager to spend 7500 tUSD to buy the collateral`);
      await this.techpayTUSD.approve(
        this.techpayLiquidationManager.address,
        etherToWei(7500),
        { from: bidder1 }
      );

      console.log(`
            Bidder1 bids  the wTPC2 collateral`);
      await this.techpayLiquidationManager.bidAuction(1, new BN('100000000'), {
        from: bidder1
      });

      console.log(`
            *Bidder1's tUSD balance should be less than 10000`);
      balance = await this.techpayTUSD.balanceOf(bidder1);
      expect(weiToEther(balance) * 1).to.be.lessThan(10000);

      console.log(`
            The actual balance of bidder1's tUSD now: ${weiToEther(balance)}`);

      console.log(`
            The amount of tUSD that bidder1 has spent is 10000 minus ${weiToEther(
              balance
            )}`);
      let balance2 = 10000 - weiToEther(balance);

      console.log(`
            The actual amount of tUSD that bidder1 has spent is ${balance2}`);

      console.log(`
            Check the amount of tUSD that techpayFeeVault has`);
      balance = await this.techpayTUSD.balanceOf(techpayFeeVault);

      console.log(`
            The actual balance of techpayFeeVault's tUSD now: ${weiToEther(
              balance
            )}`);

      console.log(`
            *The two amounts should be the same`);
      expect(balance2.toFixed(3)).to.be.equal(
        (weiToEther(balance) * 1).toFixed(3)
      );

      console.log(`
            Check the amount of wTPC that bidder1 receives`);
      balance = await this.mockToken.balanceOf(bidder1);

      console.log(`
            The amount of wTPC that bidder1 receives: ${weiToEther(balance)}`);

      console.log(`
            Check the amount of wTPC that borrower is refunded`);
      balance2 = await this.mockToken.balanceOf(borrower);

      console.log(`
            The amount of wTPC that borrower is refunded: ${weiToEther(
              balance
            )}`);

      console.log(`
            *The amount of bidder1's wTPC and borrower's should be 5000`);
      expect(weiToEther(balance) * 1 + weiToEther(balance2) * 1).to.be.equal(
        5000
      );

      console.log(`
            Check the amount of wTPC2 that bidder1 receives`);
      balance = await this.mockToken2.balanceOf(bidder1);

      console.log(`
            The amount of wTPC2 that bidder1 receives: ${weiToEther(balance)}`);

      console.log(`
            Check the amount of wTPC2 that borrower is refunded`);
      balance2 = await this.mockToken2.balanceOf(borrower);

      console.log(`
            The amount of wTPC2 that borrower is refunded: ${weiToEther(
              balance
            )}`);

      console.log(`
            *The amount of bidder1's wTPC2 and borrower's should be 4999`);
      expect(weiToEther(balance) * 1 + weiToEther(balance2) * 1).to.be.equal(
        4999
      );
    });
  });
});
