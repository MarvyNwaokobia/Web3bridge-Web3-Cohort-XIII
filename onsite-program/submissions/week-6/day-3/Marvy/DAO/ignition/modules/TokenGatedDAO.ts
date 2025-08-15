import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const TokenGatedDAOModule = buildModule("TokenGatedDAOModule", (m) => {
  const rolesRegistry = m.contract("RolesRegistry", [
    "DAO Governance NFT",
    "DAONFT",
  ]);

  const tokenGatedDAO = m.contract("TokenGatedDAO", [rolesRegistry]);

  return {
    rolesRegistry,
    tokenGatedDAO,
  };
});

export default TokenGatedDAOModule;