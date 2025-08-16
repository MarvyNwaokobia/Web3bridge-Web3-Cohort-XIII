const { buildModule } = require("@nomicfoundation/hardhat-ignition/modules");

module.exports = buildModule("TimeNFTModule", (m) => {
  const timeNFT = m.contract("TimeNFT", []);
  
  const deployer = m.getAccount(0);
  m.call(timeNFT, "mint", [deployer], {
    id: "mint_initial_nft"
  });

  return { timeNFT };
});