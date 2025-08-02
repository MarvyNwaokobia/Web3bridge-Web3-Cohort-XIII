import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const SchoolManageModule = buildModule("SchoolManageModule", (m) => {
  const school = m.contract("SchoolManage");

  return { school };
});

export default SchoolManageModule;
