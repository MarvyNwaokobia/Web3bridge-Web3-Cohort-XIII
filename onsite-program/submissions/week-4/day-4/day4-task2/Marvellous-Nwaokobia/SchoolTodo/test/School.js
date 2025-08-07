const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("School Contract", function () {
  let school;
  let owner;
  let user1;
  let user2;

  const STUDENT_NAME = "Alice Johnson";
  const STUDENT_COURSE = "Computer Science";
  const STUDENT_AGE = 20;
  
  const UPDATED_NAME = "Alice Smith";
  const UPDATED_COURSE = "Software Engineering";
  const UPDATED_AGE = 21;

  const Status = {
    ACTIVE: 0,
    DEFERRED: 1,
    RUSTICATED: 2
  };

  beforeEach(async function () {
    [owner, user1, user2] = await ethers.getSigners();

    const School = await ethers.getContractFactory("School");
    school = await School.deploy();
    await school.waitForDeployment();
  });

  describe("Student Registration", function () {
    it("Should register a student successfully", async function () {
      await expect(
        school.connect(user1).registerStudent(STUDENT_NAME, STUDENT_COURSE, STUDENT_AGE)
      ).to.emit(school, "StudentAdded")
        .withArgs(user1.address, 0, STUDENT_NAME, STUDENT_COURSE, STUDENT_AGE, Status.ACTIVE);

      const student = await school.connect(user1).getStudentById(0);
      expect(student.id).to.equal(0);
      expect(student.name).to.equal(STUDENT_NAME);
      expect(student.course).to.equal(STUDENT_COURSE);
      expect(student.age).to.equal(STUDENT_AGE);
      expect(student.status).to.equal(Status.ACTIVE);
      expect(student.exists).to.be.true;
    });

    it("Should auto-increment student IDs", async function () {
      await school.connect(user1).registerStudent("Student 1", "Course 1", 18);
      
      await expect(
        school.connect(user1).registerStudent("Student 2", "Course 2", 19)
      ).to.emit(school, "StudentAdded")
        .withArgs(user1.address, 1, "Student 2", "Course 2", 19, Status.ACTIVE);

      const student1 = await school.connect(user1).getStudentById(0);
      const student2 = await school.connect(user1).getStudentById(1);
      
      expect(student1.name).to.equal("Student 1");
      expect(student2.name).to.equal("Student 2");
      expect(student1.id).to.equal(0);
      expect(student2.id).to.equal(1);
    });

    it("Should allow different users to register students independently", async function () {
      await school.connect(user1).registerStudent("User1 Student", "Course A", 20);
      await school.connect(user2).registerStudent("User2 Student", "Course B", 22);

      const user1Student = await school.connect(user1).getStudentById(0);
      const user2Student = await school.connect(user2).getStudentById(0);

      expect(user1Student.name).to.equal("User1 Student");
      expect(user2Student.name).to.equal("User2 Student");
      expect(user1Student.id).to.equal(0);
      expect(user2Student.id).to.equal(0);
    });

    it("Should fail with empty name", async function () {
      await expect(
        school.registerStudent("", STUDENT_COURSE, STUDENT_AGE)
      ).to.be.revertedWith("Name cannot be empty");
    });

    it("Should fail with empty course", async function () {
      await expect(
        school.registerStudent(STUDENT_NAME, "", STUDENT_AGE)
      ).to.be.revertedWith("Course cannot be empty");
    });

    it("Should fail with zero age", async function () {
      await expect(
        school.registerStudent(STUDENT_NAME, STUDENT_COURSE, 0)
      ).to.be.revertedWith("Age must be greater than 0");
    });
  });

  describe("Student Updates", function () {
    beforeEach(async function () {
      await school.connect(user1).registerStudent(STUDENT_NAME, STUDENT_COURSE, STUDENT_AGE);
    });

    it("Should update student details successfully", async function () {
      await expect(
        school.connect(user1).updateStudent(0, UPDATED_NAME, UPDATED_COURSE, UPDATED_AGE)
      ).to.emit(school, "StudentUpdated")
        .withArgs(user1.address, 0, UPDATED_NAME, UPDATED_COURSE, UPDATED_AGE, Status.ACTIVE);

      const student = await school.connect(user1).getStudentById(0);
      expect(student.name).to.equal(UPDATED_NAME);
      expect(student.course).to.equal(UPDATED_COURSE);
      expect(student.age).to.equal(UPDATED_AGE);
      expect(student.status).to.equal(Status.ACTIVE);
    });

    it("Should update student status successfully", async function () {
      await expect(
        school.connect(user1).updateStudentStatus(0, Status.DEFERRED)
      ).to.emit(school, "StudentUpdated")
        .withArgs(user1.address, 0, STUDENT_NAME, STUDENT_COURSE, STUDENT_AGE, Status.DEFERRED);

      const student = await school.connect(user1).getStudentById(0);
      expect(student.status).to.equal(Status.DEFERRED);
      expect(student.name).to.equal(STUDENT_NAME); 
    });

    it("Should update to all status types", async function () {
      await school.connect(user1).updateStudentStatus(0, Status.RUSTICATED);
      let student = await school.connect(user1).getStudentById(0);
      expect(student.status).to.equal(Status.RUSTICATED);

      await school.connect(user1).updateStudentStatus(0, Status.ACTIVE);
      student = await school.connect(user1).getStudentById(0);
      expect(student.status).to.equal(Status.ACTIVE);
    });

    it("Should fail when updating non-existent student", async function () {
      await expect(
        school.connect(user1).updateStudent(999, UPDATED_NAME, UPDATED_COURSE, UPDATED_AGE)
      ).to.be.revertedWith("Student does not exist");

      await expect(
        school.connect(user1).updateStudentStatus(999, Status.DEFERRED)
      ).to.be.revertedWith("Student does not exist");
    });

    it("Should fail with invalid update parameters", async function () {
      await expect(
        school.connect(user1).updateStudent(0, "", UPDATED_COURSE, UPDATED_AGE)
      ).to.be.revertedWith("Name cannot be empty");

      await expect(
        school.connect(user1).updateStudent(0, UPDATED_NAME, "", UPDATED_AGE)
      ).to.be.revertedWith("Course cannot be empty");

      await expect(
        school.connect(user1).updateStudent(0, UPDATED_NAME, UPDATED_COURSE, 0)
      ).to.be.revertedWith("Age must be greater than 0");
    });

    it("Should not allow users to update other users' students", async function () {
      await expect(
        school.connect(user2).updateStudent(0, UPDATED_NAME, UPDATED_COURSE, UPDATED_AGE)
      ).to.be.revertedWith("Student does not exist");

      await expect(
        school.connect(user2).updateStudentStatus(0, Status.DEFERRED)
      ).to.be.revertedWith("Student does not exist");
    });
  });

  describe("Student Deletion", function () {
    beforeEach(async function () {
      await school.connect(user1).registerStudent(STUDENT_NAME, STUDENT_COURSE, STUDENT_AGE);
    });

    it("Should delete student successfully", async function () {
      await expect(
        school.connect(user1).deleteStudent(0)
      ).to.emit(school, "StudentDeleted")
        .withArgs(user1.address, 0);

      await expect(
        school.connect(user1).getStudentById(0)
      ).to.be.revertedWith("Student does not exist");
    });

    it("Should fail when deleting non-existent student", async function () {
      await expect(
        school.connect(user1).deleteStudent(999)
      ).to.be.revertedWith("Student does not exist");
    });

    it("Should not allow users to delete other users' students", async function () {
      await expect(
        school.connect(user2).deleteStudent(0)
      ).to.be.revertedWith("Student does not exist");
    });

    it("Should fail operations on deleted student", async function () {
      await school.connect(user1).deleteStudent(0);

      await expect(
        school.connect(user1).updateStudent(0, UPDATED_NAME, UPDATED_COURSE, UPDATED_AGE)
      ).to.be.revertedWith("Student does not exist");

      await expect(
        school.connect(user1).updateStudentStatus(0, Status.DEFERRED)
      ).to.be.revertedWith("Student does not exist");

      await expect(
        school.connect(user1).getStudentById(0)
      ).to.be.revertedWith("Student does not exist");
    });
  });

  describe("Student Queries", function () {
    beforeEach(async function () {
      await school.connect(user1).registerStudent(STUDENT_NAME, STUDENT_COURSE, STUDENT_AGE);
    });

    it("Should return correct student details", async function () {
      const student = await school.connect(user1).getStudentById(0);
      
      expect(student.id).to.equal(0);
      expect(student.name).to.equal(STUDENT_NAME);
      expect(student.course).to.equal(STUDENT_COURSE);
      expect(student.age).to.equal(STUDENT_AGE);
      expect(student.status).to.equal(Status.ACTIVE);
      expect(student.exists).to.be.true;
    });

    it("Should fail when querying non-existent student", async function () {
      await expect(
        school.connect(user1).getStudentById(999)
      ).to.be.revertedWith("Student does not exist");
    });

    it("Should not allow users to query other users' students", async function () {
      await expect(
        school.connect(user2).getStudentById(0)
      ).to.be.revertedWith("Student does not exist");
    });
  });
});