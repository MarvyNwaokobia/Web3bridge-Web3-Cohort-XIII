// This setup uses Hardhat Ignition to manage smart contract deployments.
// Learn more about it at https://hardhat.org/ignition

import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const TestTokenModule = buildModule("TestTokenModule", (m) => {
  const tokenName = m.getParameter("tokenName", "Test Token");
  const tokenSymbol = m.getParameter("tokenSymbol", "TEST");

  const testToken = m.contract("TestToken", [tokenName, tokenSymbol]);

  return { testToken };
});

export default TestTokenModule;
