import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const Erc20Module = buildModule("Erc20Module", (m) => {
  const initialSupply = m.getParameter("initialSupply", "1000000"); // 1,000,000 tokens
  const token = m.contract("Erc20", [initialSupply]);
  return { token };
});

export default Erc20Module;
