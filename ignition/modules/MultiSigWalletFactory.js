const { buildModule } = require("@nomicfoundation/hardhat-ignition/modules");

const MultiSigWalletFactoryModule = buildModule("MultiSigWalletFactoryModule", (m) => {
  const factory = m.contract("MultiSigWalletFactory");
  return { factory };
});

module.exports = MultiSigWalletFactoryModule;