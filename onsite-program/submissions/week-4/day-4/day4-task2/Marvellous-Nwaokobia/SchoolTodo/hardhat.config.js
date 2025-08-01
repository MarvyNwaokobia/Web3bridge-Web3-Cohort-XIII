require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: "0.8.28",
  networks: {
    holesky: {
      url: "https://rpc.ankr.com/eth_holesky",
      accounts: [process.env.WALLET_KEY],
    }
  }
};