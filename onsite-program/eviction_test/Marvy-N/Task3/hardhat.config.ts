import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import * as dotenv from "dotenv";

dotenv.config();

const config: HardhatUserConfig = {
  solidity: "0.8.28",
  networks: {
    lisk_sepolia: {
      url: "https://rpc.sepolia-api.lisk.com",
      accounts: process.env.WALLET_KEY ? [process.env.WALLET_KEY] : [],
    },
  },
};

export default config;
