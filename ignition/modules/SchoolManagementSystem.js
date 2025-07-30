import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const SchoolManagementSystemModule = buildModule("SchoolManagementSystemModule", (m) => {
  const school = m.contract("SchoolManagementSystem");

  return { school };
});

export default SchoolManagementSystemModule;
