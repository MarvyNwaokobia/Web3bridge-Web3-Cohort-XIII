
import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("PiggyBankFactoryModule", (m) => {
  const piggyBankFactory = m.contract("PiggyBankFactory");

  return { piggyBankFactory };
});