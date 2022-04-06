// to deploy locally
// run: npx hardhat node on a terminal
// then run: npx hardhat run --network localhost scripts/deploy_all.js

async function main(network) {
  console.log('network: ', network.name);

  const [deployer] = await ethers.getSigners();
  const deployerAddress = await deployer.getAddress();
  console.log(`Deployer's address: `, deployerAddress);

  const etherToWei = (n) => {
    return new web3.utils.BN(web3.utils.toWei(n.toString(), 'ether'));
  };

  ///
  const TechPayMintAddressProvider = await ethers.getContractFactory(
    'TechPayMintAddressProvider'
  );
  const techpayMintAddressProvider = await TechPayMintAddressProvider.deploy();
  await techpayMintAddressProvider.deployed();
  await techpayMintAddressProvider.initialize(deployerAddress);
  console.log(
    'TechPayMintAddressProvider deployed at',
    techpayMintAddressProvider.address
  );
  ///

  ///
  const TechPayLiquidationManager = await ethers.getContractFactory(
    'TechPayLiquidationManager'
  );
  const techpayLiquidationManager = await TechPayLiquidationManager.deploy();
  await techpayLiquidationManager.deployed();
  console.log(
    'TechPayLiquidationManager deployed at',
    techpayLiquidationManager.address
  );
  await techpayLiquidationManager.initialize(
    deployerAddress,
    techpayMintAddressProvider.address
  );
  ///

  /* ///  TODO:  needs ProxyAdmin
  const TechPayLiquidationManager = await ethers.getContractFactory(
    'TechPayLiquidationManager'
  );
  const techpayLiquidationManagerImpl = await TechPayLiquidationManager.deploy();
  await techpayLiquidationManagerImpl.deployed();
  console.log(
    'TechPayLiquidationManager Implemaentaion deployed at',
    techpayLiquidationManagerImpl.address
  );  
  ///

  ///
  const TechPayLiquidationManagerProxy = await ethers.getContractFactory(
    'TechPayUpgradeabilityProxy'
  );
  const techpayLiquidationManagerProxy = await TechPayLiquidationManagerProxy.deploy(
    techpayLiquidationManagerImpl.address,
    deployerAddress,
    []
  );
  await techpayLiquidationManagerProxy.deployed();
  console.log(
    'TechPayLiquidationManagerProxy deployed at',
    techpayLiquidationManagerProxy.address
  );
  const techpayLiquidationManager = await ethers.getContractAt(
    'TechPayLiquidationManager',
    techpayLiquidationManagerProxy.address
  );
  await techpayLiquidationManager.initialize(
    PROXY_ADMIN_ADDRESS,
    techpayMintAddressProvider.address
  );
  /// */

  ///
  const TechPayMint = await ethers.getContractFactory('TechPayMint');
  const techpayMint = await TechPayMint.deploy();
  await techpayMint.deployed();
  console.log('TechPayMint deployed at', techpayMint.address);
  await techpayMint.initialize(
    deployerAddress,
    techpayMintAddressProvider.address
  );
  ///

  ///
  const TechPayMintTokenRegistry = await ethers.getContractFactory(
    'TechPayMintTokenRegistry'
  );
  const techpayMintTokenRegistry = await TechPayMintTokenRegistry.deploy();
  await techpayMintTokenRegistry.deployed();
  console.log(
    'TechPayMintTokenRegistry deployed at',
    techpayMintTokenRegistry.address
  );
  await techpayMintTokenRegistry.initialize(deployerAddress);
  ///

  ///
  const CollateralPool = await ethers.getContractFactory(
    'TechPayDeFiTokenStorage'
  );
  const collateralPool = await CollateralPool.deploy();
  await collateralPool.deployed();
  console.log(
    'TechPayDeFiTokenStorage (Collateral Pool) deployed at',
    collateralPool.address
  );
  await collateralPool.initialize(techpayMintAddressProvider.address, true);
  ///

  ///
  const DebtPool = await ethers.getContractFactory('TechPayDeFiTokenStorage');
  const debtPool = await DebtPool.deploy();
  await debtPool.deployed();
  console.log(
    'TechPayDeFiTokenStorage (Debt Pool) deployed at',
    debtPool.address
  );
  await debtPool.initialize(techpayMintAddressProvider.address, true);
  ///

  ///
  const TechPayTUSD = await ethers.getContractFactory('TechPayTUSD');
  const techpayTUSD = await TechPayTUSD.deploy();
  await techpayTUSD.deployed();
  console.log('TechPayTUSD deployed at', techpayTUSD.address);
  //await techpayTUSD.initialize(deployerAddress); //why not working??
  //await techpayTUSD.init(deployerAddress); // if initialize in TechPayTUSD is renamed to another name such as init, it will work
  ///

  ///
  const TechPayMintRewardDistribution = await ethers.getContractFactory(
    'TechPayMintRewardDistribution'
  );
  const techpayMintRewardDistribution = await TechPayMintRewardDistribution.deploy();
  techpayMintRewardDistribution.deployed();
  console.log(
    'TechPayMintRewardDistribution deployed at',
    techpayMintRewardDistribution.address
  );
  await techpayMintRewardDistribution.initialize(
    deployerAddress,
    techpayMintAddressProvider.address
  );
  ///

  ///
  let wTPCAddress;
  let priceOracleProxyAddress;

  if (network.name === 'localhost') {
    const MockToken = await ethers.getContractFactory('MockToken');
    const mockToken = await MockToken.deploy();
    await mockToken.deployed();
    console.log('MockToken deployed at', mockToken.address);
    wTPCAddress = mockToken.address;
    await mockToken.initialize('wTPC', 'wTPC', 18);
  }

  switch (network.name) {
    case 'mainnet':
      wTPCAddress = '0x4449d20a3dec996644c1fc453198ef6fe8497cf2';
      break;
    case 'testnet':
      wTPCAddress = '0x4449d20a3dec996644c1fc453198ef6fe8497cf2';
      break;
    default:
      break;
  }

  if (network.name === 'localhost') {
    const MockPriceOracleProxy = await ethers.getContractFactory(
      'MockPriceOracleProxy'
    );
    const mockPriceOracleProxy = await MockPriceOracleProxy.deploy();
    await mockPriceOracleProxy.deployed();
    console.log(
      'MockPriceOracleProxy deployed at',
      mockPriceOracleProxy.address
    );
    priceOracleProxyAddress = mockPriceOracleProxy.address;

    // set the initial value; 1 wTPC = 1 USD; 1 tUSD = 1 USD
    await mockPriceOracleProxy.setPrice(wTPCAddress, etherToWei(1).toString());
    await mockPriceOracleProxy.setPrice(
      techpayTUSD.address,
      etherToWei(1).toString()
    );
  }
  switch (network.name) {
    case 'mainnet':
      priceOracleProxyAddress = '0x????'; //TODO: get the correct address
      break;
    case 'testnet':
      priceOracleProxyAddress = '0x????'; //TODO: get the correct address
      break;
    default:
      break;
  }

  ///

  ///
  await techpayMintAddressProvider.setTechPayMint(techpayMint.address);
  await techpayMintAddressProvider.setCollateralPool(collateralPool.address);
  await techpayMintAddressProvider.setDebtPool(debtPool.address);
  await techpayMintAddressProvider.setTokenRegistry(
    techpayMintTokenRegistry.address
  );
  await techpayMintAddressProvider.setRewardDistribution(
    techpayMintRewardDistribution.address
  );
  await techpayMintAddressProvider.setPriceOracleProxy(priceOracleProxyAddress);
  await techpayMintAddressProvider.setTechPayLiquidationManager(
    techpayLiquidationManager.address
  );
  await techpayMintTokenRegistry.addToken(
    wTPCAddress,
    '',
    priceOracleProxyAddress,
    18,
    true,
    true,
    false
  );
  // TODO: the TechPayTUSD needs to run the initialize function first
  /* await techpayMintTokenRegistry.addToken(
    techpayTUSD.address,
    '',
    priceOracleProxyAddress,
    18,
    true,
    false,
    true
  ); */

  //await techpayTUSD.addMinter(techpayMint.address); //TODO: TechPayTUSD needs to run the initialize function first

  await techpayLiquidationManager.updateTechPayMintContractAddress(
    techpayMint.address
  );
  await techpayLiquidationManager.updateTechPayUSDAddress(techpayTUSD.address);
  let techpayFeeVault;
  switch (network.name) {
    case 'mainnet':
      techpayFeeVault = '0x????'; //TODO get the correct address
      break;
    case 'testnet':
      techpayFeeVault = '0x????'; //TODO get the correct address
      break;
    default:
      techpayFeeVault = deployerAddress;
      break;
  }
  await techpayLiquidationManager.updateTechPayFeeVault(techpayFeeVault);
  ///
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main(network)
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
