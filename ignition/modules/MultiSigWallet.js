const { buildModule } = require("@nomicfoundation/hardhat-ignition/modules");

const MultiSigWalletModule = buildModule("MultiSigWalletModule", (m) => {
  const defaultOwners = [
    "0xF228786bD2ed120b4b73b430Be38A09456995724", 
    "0xC1ebAA544Ca7EAE25A537018a6379994560C6C10",  
    "0x5B38Da6a701c568545dCfcB03FcB875f56beddC4", 
  ];

  const owners = m.getParameter("owners", defaultOwners);
  const wallet = m.contract("MultiSigWallet", [owners]);
  return { wallet };
});

module.exports = MultiSigWalletModule;