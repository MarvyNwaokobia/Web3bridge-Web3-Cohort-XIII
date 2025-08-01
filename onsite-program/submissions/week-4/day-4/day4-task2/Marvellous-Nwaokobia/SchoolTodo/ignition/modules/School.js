import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const SchoolModule = buildModule("SchoolModule", (m) => {
  const school = m.contract("School");

  return { school };
});

export default SchoolModule;

