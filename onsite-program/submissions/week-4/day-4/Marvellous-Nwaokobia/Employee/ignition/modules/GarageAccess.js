// This setup uses Hardhat Ignition to manage smart contract deployments.
// Learn more about it at https://hardhat.org/ignition


import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const GarageAccessModule = buildModule("GarageAcessModule", (m) => {
  const access = m.contract("GarageAccess");

  return { access };
});

export default GarageAccessModule;

