require('dotenv').config();
require('@nomiclabs/hardhat-waffle');
require('@nomiclabs/hardhat-truffle5');
require('@nomiclabs/hardhat-etherscan');
require('@nomiclabs/hardhat-ethers');
require('hardhat-gas-reporter');
require('solidity-coverage');
require('@nomiclabs/hardhat-solhint');
require('hardhat-contract-sizer');
require('@openzeppelin/hardhat-upgrades');
require('@openzeppelin/test-helpers');
require('@nomiclabs/hardhat-web3');

const PRIVATE_KEY = process.env.PRIVATE_KEY;

module.exports = {
  solidity: {
    version: '0.5.5',
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      }
    }
  },
  gasReporter: {
    currency: 'USD',
    enabled: false,
    gasPrice: 50
  },
  networks: {
    mainnet: {
      url: `https://api.techpay.io`,
      chainId: 2569
      //accounts: [`0x${PRIVATE_KEY}`]
    },
    testnet: {
      url: `https://api.test.techpay.io`,
      chainId: 2389,
      accounts: [`0x${PRIVATE_KEY}`]
    },
    ropsten: {
      url: `https://ropsten.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161`,
      chainId: 3
      //accounts: [`0x${PRIVATE_KEY}`]
    },
    coverage: {
      url: 'http://localhost:8555'
    },

    localhost: {
      url: `http://127.0.0.1:8545`
    }
  },
  etherscan: {
    apiKey: '46DD6NK19R2AZQQIJIY1FXR85HKM2XSNBE'
  }
};
