const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("SchoolManage", function () {
  let schoolManage;
  let owner;
  let teacher1;
  let teacher2;
  let nonOwner;

  const TEACHER_NAME = "John Doe";
  const TEACHER_SALARY = ethers.parseEther("1.0"); // 1 ETH
  const UPDATED_NAME = "Jane Smith";
  const UPDATED_SALARY = ethers.parseEther("1.5"); // 1.5 ETH

  beforeEach(async function () {
    [owner, teacher1, teacher2, nonOwner] = await ethers.getSigners();

    const SchoolManage = await ethers.getContractFactory("SchoolManage");
    schoolManage = await SchoolManage.deploy();
    await schoolManage.waitForDeployment();
  });

  describe("Deployment", function () {
    it("Should set the correct owner", async function () {
      expect(await schoolManage.owner()).to.equal(owner.address);
    });
  });

  describe("Teacher Registration", function () {
    it("Should register a teacher successfully", async function () {
      await expect(
        schoolManage.registerTeacher(teacher1.address, TEACHER_NAME, TEACHER_SALARY)
      )
        .to.emit(schoolManage, "TeacherRegistered")
        .withArgs(teacher1.address, TEACHER_NAME, TEACHER_SALARY, 0); // Status.Employed = 0

      const teacherDetails = await schoolManage.getTeacherDetails(teacher1.address);
      expect(teacherDetails.name).to.equal(TEACHER_NAME);
      expect(teacherDetails.salary).to.equal(TEACHER_SALARY);
      expect(teacherDetails.status).to.equal(0); // Status.Employed
      expect(teacherDetails.exists).to.equal(true);
    });

    it("Should revert if non-owner tries to register teacher", async function () {
      await expect(
        schoolManage.connect(nonOwner).registerTeacher(teacher1.address, TEACHER_NAME, TEACHER_SALARY)
      ).to.be.revertedWithCustomError(schoolManage, "NotOwner");
    });

    it("Should revert with invalid teacher address (zero address)", async function () {
      await expect(
        schoolManage.registerTeacher(ethers.ZeroAddress, TEACHER_NAME, TEACHER_SALARY)
      ).to.be.revertedWithCustomError(schoolManage, "InvalidTeacherAddress");
    });

    it("Should revert with empty name", async function () {
      await expect(
        schoolManage.registerTeacher(teacher1.address, "", TEACHER_SALARY)
      ).to.be.revertedWithCustomError(schoolManage, "InvalidTeacherAddress");
    });

    it("Should revert with zero salary", async function () {
      await expect(
        schoolManage.registerTeacher(teacher1.address, TEACHER_NAME, 0)
      ).to.be.revertedWithCustomError(schoolManage, "InvalidSalary");
    });

    it("Should revert when trying to register existing teacher", async function () {
      await schoolManage.registerTeacher(teacher1.address, TEACHER_NAME, TEACHER_SALARY);
      
      await expect(
        schoolManage.registerTeacher(teacher1.address, "Another Name", TEACHER_SALARY)
      ).to.be.revertedWithCustomError(schoolManage, "TeacherNotFound");
    });
  });

  describe("Teacher Updates", function () {
    beforeEach(async function () {
      await schoolManage.registerTeacher(teacher1.address, TEACHER_NAME, TEACHER_SALARY);
    });

    it("Should update teacher details successfully", async function () {
      await expect(
        schoolManage.updateTeacher(teacher1.address, UPDATED_NAME, UPDATED_SALARY)
      )
        .to.emit(schoolManage, "TeacherUpdated")
        .withArgs(teacher1.address, UPDATED_NAME, UPDATED_SALARY, 0); // Status.Employed

      const teacherDetails = await schoolManage.getTeacherDetails(teacher1.address);
      expect(teacherDetails.name).to.equal(UPDATED_NAME);
      expect(teacherDetails.salary).to.equal(UPDATED_SALARY);
    });

    it("Should revert if non-owner tries to update teacher", async function () {
      await expect(
        schoolManage.connect(nonOwner).updateTeacher(teacher1.address, UPDATED_NAME, UPDATED_SALARY)
      ).to.be.revertedWithCustomError(schoolManage, "NotOwner");
    });

    it("Should revert with invalid teacher address", async function () {
      await expect(
        schoolManage.updateTeacher(ethers.ZeroAddress, UPDATED_NAME, UPDATED_SALARY)
      ).to.be.revertedWithCustomError(schoolManage, "InvalidTeacherAddress");
    });

    it("Should revert when updating non-existent teacher", async function () {
      await expect(
        schoolManage.updateTeacher(teacher2.address, UPDATED_NAME, UPDATED_SALARY)
      ).to.be.revertedWithCustomError(schoolManage, "TeacherNotFound");
    });

    it("Should revert with empty name", async function () {
      await expect(
        schoolManage.updateTeacher(teacher1.address, "", UPDATED_SALARY)
      ).to.be.revertedWithCustomError(schoolManage, "InvalidTeacherAddress");
    });

    it("Should revert with zero salary", async function () {
      await expect(
        schoolManage.updateTeacher(teacher1.address, UPDATED_NAME, 0)
      ).to.be.revertedWithCustomError(schoolManage, "InvalidSalary");
    });
  });

  describe("Teacher Status Updates", function () {
    beforeEach(async function () {
      await schoolManage.registerTeacher(teacher1.address, TEACHER_NAME, TEACHER_SALARY);
    });

    it("Should update teacher status to Unemployed", async function () {
      await expect(
        schoolManage.updateTeacherStatus(teacher1.address, 1) // Status.Unemployed
      )
        .to.emit(schoolManage, "TeacherStatusUpdated")
        .withArgs(teacher1.address, 1);

      const teacherDetails = await schoolManage.getTeacherDetails(teacher1.address);
      expect(teacherDetails.status).to.equal(1); // Status.Unemployed
    });

    it("Should update teacher status to Probation", async function () {
      await expect(
        schoolManage.updateTeacherStatus(teacher1.address, 2) // Status.Probation
      )
        .to.emit(schoolManage, "TeacherStatusUpdated")
        .withArgs(teacher1.address, 2);

      const teacherDetails = await schoolManage.getTeacherDetails(teacher1.address);
      expect(teacherDetails.status).to.equal(2); // Status.Probation
    });

    it("Should revert if non-owner tries to update status", async function () {
      await expect(
        schoolManage.connect(nonOwner).updateTeacherStatus(teacher1.address, 1)
      ).to.be.revertedWithCustomError(schoolManage, "NotOwner");
    });

    it("Should revert with invalid teacher address", async function () {
      await expect(
        schoolManage.updateTeacherStatus(ethers.ZeroAddress, 1)
      ).to.be.revertedWithCustomError(schoolManage, "InvalidTeacherAddress");
    });

    it("Should revert when updating non-existent teacher status", async function () {
      await expect(
        schoolManage.updateTeacherStatus(teacher2.address, 1)
      ).to.be.revertedWithCustomError(schoolManage, "TeacherNotFound");
    });

    it("Should revert with invalid status value", async function () {
      await expect(
        schoolManage.updateTeacherStatus(teacher1.address, 3) // Invalid status
      ).to.be.revertedWithCustomError(schoolManage, "InvalidStatus");
    });
  });

  describe("Salary Payment", function () {
    beforeEach(async function () {
      await schoolManage.registerTeacher(teacher1.address, TEACHER_NAME, TEACHER_SALARY);
      // Deposit funds to the contract
      await schoolManage.deposit({ value: ethers.parseEther("5.0") });
    });

    it("Should pay salary successfully", async function () {
      const initialBalance = await ethers.provider.getBalance(teacher1.address);
      
      await expect(
        schoolManage.paySalary(teacher1.address)
      )
        .to.emit(schoolManage, "SalaryPaid")
        .withArgs(teacher1.address, TEACHER_SALARY);

      const finalBalance = await ethers.provider.getBalance(teacher1.address);
      expect(finalBalance - initialBalance).to.equal(TEACHER_SALARY);
    });

    it("Should revert if non-owner tries to pay salary", async function () {
      await expect(
        schoolManage.connect(nonOwner).paySalary(teacher1.address)
      ).to.be.revertedWithCustomError(schoolManage, "NotOwner");
    });

    it("Should revert with invalid teacher address", async function () {
      await expect(
        schoolManage.paySalary(ethers.ZeroAddress)
      ).to.be.revertedWithCustomError(schoolManage, "InvalidTeacherAddress");
    });

    it("Should revert when paying non-existent teacher", async function () {
      await expect(
        schoolManage.paySalary(teacher2.address)
      ).to.be.revertedWithCustomError(schoolManage, "TeacherNotFound");
    });

    it("Should revert when paying unemployed teacher", async function () {
      await schoolManage.updateTeacherStatus(teacher1.address, 1); // Status.Unemployed
      
      await expect(
        schoolManage.paySalary(teacher1.address)
      ).to.be.revertedWithCustomError(schoolManage, "NotEmployed");
    });

    it("Should revert when paying teacher on probation", async function () {
      await schoolManage.updateTeacherStatus(teacher1.address, 2); // Status.Probation
      
      await expect(
        schoolManage.paySalary(teacher1.address)
      ).to.be.revertedWithCustomError(schoolManage, "NotEmployed");
    });

    it("Should revert with insufficient contract balance", async function () {
      // Deploy a new contract with no funds
      const SchoolManage = await ethers.getContractFactory("SchoolManage");
      const newSchoolManage = await SchoolManage.deploy();
      await newSchoolManage.waitForDeployment();
      
      await newSchoolManage.registerTeacher(teacher1.address, TEACHER_NAME, TEACHER_SALARY);
      
      await expect(
        newSchoolManage.paySalary(teacher1.address)
      ).to.be.revertedWithCustomError(newSchoolManage, "InsufficientBalance");
    });
  });

  describe("Deposit Function", function () {
    it("Should allow deposits to the contract", async function () {
      const depositAmount = ethers.parseEther("2.0");
      const initialBalance = await ethers.provider.getBalance(schoolManage.target);
      
      await schoolManage.deposit({ value: depositAmount });
      
      const finalBalance = await ethers.provider.getBalance(schoolManage.target);
      expect(finalBalance - initialBalance).to.equal(depositAmount);
    });

    it("Should allow multiple deposits", async function () {
      const deposit1 = ethers.parseEther("1.0");
      const deposit2 = ethers.parseEther("2.0");
      
      await schoolManage.deposit({ value: deposit1 });
      await schoolManage.deposit({ value: deposit2 });
      
      const balance = await ethers.provider.getBalance(schoolManage.target);
      expect(balance).to.equal(deposit1 + deposit2);
    });
  });

  describe("Get Teacher Details", function () {
    it("Should return correct teacher details", async function () {
      await schoolManage.registerTeacher(teacher1.address, TEACHER_NAME, TEACHER_SALARY);
      
      const details = await schoolManage.getTeacherDetails(teacher1.address);
      expect(details.name).to.equal(TEACHER_NAME);
      expect(details.salary).to.equal(TEACHER_SALARY);
      expect(details.status).to.equal(0); // Status.Employed
      expect(details.exists).to.equal(true);
    });

    it("Should revert with invalid teacher address", async function () {
      await expect(
        schoolManage.getTeacherDetails(ethers.ZeroAddress)
      ).to.be.revertedWithCustomError(schoolManage, "InvalidTeacherAddress");
    });

    it("Should revert when getting non-existent teacher details", async function () {
      await expect(
        schoolManage.getTeacherDetails(teacher1.address)
      ).to.be.revertedWithCustomError(schoolManage, "TeacherNotFound");
    });
  });

  describe("Access Control", function () {
    it("Should allow only owner to perform administrative functions", async function () {
      // All these should revert when called by non-owner
      await expect(
        schoolManage.connect(nonOwner).registerTeacher(teacher1.address, TEACHER_NAME, TEACHER_SALARY)
      ).to.be.revertedWithCustomError(schoolManage, "NotOwner");

      await expect(
        schoolManage.connect(nonOwner).updateTeacher(teacher1.address, UPDATED_NAME, UPDATED_SALARY)
      ).to.be.revertedWithCustomError(schoolManage, "NotOwner");

      await expect(
        schoolManage.connect(nonOwner).updateTeacherStatus(teacher1.address, 1)
      ).to.be.revertedWithCustomError(schoolManage, "NotOwner");

      await expect(
        schoolManage.connect(nonOwner).paySalary(teacher1.address)
      ).to.be.revertedWithCustomError(schoolManage, "NotOwner");
    });

    it("Should allow anyone to deposit funds", async function () {
      const depositAmount = ethers.parseEther("1.0");
      
      // Non-owner should be able to deposit
      await expect(
        schoolManage.connect(nonOwner).deposit({ value: depositAmount })
      ).to.not.be.reverted;
    });

    it("Should allow anyone to view teacher details", async function () {
      await schoolManage.registerTeacher(teacher1.address, TEACHER_NAME, TEACHER_SALARY);
      
      // Non-owner should be able to view details
      await expect(
        schoolManage.connect(nonOwner).getTeacherDetails(teacher1.address)
      ).to.not.be.reverted;
    });
  });

  describe("Edge Cases", function () {
    it("Should handle multiple teachers correctly", async function () {
      const teacher2Name = "Alice Johnson";
      const teacher2Salary = ethers.parseEther("2.0");

      await schoolManage.registerTeacher(teacher1.address, TEACHER_NAME, TEACHER_SALARY);
      await schoolManage.registerTeacher(teacher2.address, teacher2Name, teacher2Salary);

      const teacher1Details = await schoolManage.getTeacherDetails(teacher1.address);
      const teacher2Details = await schoolManage.getTeacherDetails(teacher2.address);

      expect(teacher1Details.name).to.equal(TEACHER_NAME);
      expect(teacher1Details.salary).to.equal(TEACHER_SALARY);
      expect(teacher2Details.name).to.equal(teacher2Name);
      expect(teacher2Details.salary).to.equal(teacher2Salary);
    });

    it("Should handle status changes correctly for salary payment", async function () {
      await schoolManage.registerTeacher(teacher1.address, TEACHER_NAME, TEACHER_SALARY);
      await schoolManage.deposit({ value: ethers.parseEther("5.0") });

      // Should work when employed
      await expect(schoolManage.paySalary(teacher1.address)).to.not.be.reverted;

      // Change to unemployed and try to pay
      await schoolManage.updateTeacherStatus(teacher1.address, 1); // Unemployed
      await expect(
        schoolManage.paySalary(teacher1.address)
      ).to.be.revertedWithCustomError(schoolManage, "NotEmployed");

      // Change back to employed
      await schoolManage.updateTeacherStatus(teacher1.address, 0); // Employed
      await expect(schoolManage.paySalary(teacher1.address)).to.not.be.reverted;
    });
  });
});