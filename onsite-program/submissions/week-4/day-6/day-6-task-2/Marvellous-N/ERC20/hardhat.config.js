require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: "0.8.28",
  networks: {
    holesky: {
      url: "https://ethereum-holesky-rpc.publicnode.com",
      accounts: [process.env.WALLET_KEY],
    }
  }
};
