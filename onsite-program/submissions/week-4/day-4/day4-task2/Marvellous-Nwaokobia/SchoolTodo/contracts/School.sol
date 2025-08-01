// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

contract School {
    error STUDENT_NOT_FOUND();
    error INVALID_ID();

    enum Status { ACTIVE, DEFERRED, RUSTICATED }

    struct StudentDetails {
        uint256 id;
        string name;
        string course;
        uint256 age;
        Status status;
        bool exists;
    }

    mapping(address => mapping(uint256 => StudentDetails)) public students;
    mapping(address => uint256) private nextStudentId;

    event StudentAdded(address indexed user, uint256 id, string name, string course, uint256 age, Status status);
    event StudentUpdated(address indexed user, uint256 id, string name, string course, uint256 age, Status status);
    event StudentDeleted(address indexed user, uint256 id);

    function registerStudent(string memory _name, string memory _course, uint256 _age) public {
        require(bytes(_name).length > 0, "Name cannot be empty");
        require(bytes(_course).length > 0, "Course cannot be empty");
        require(_age > 0, "Age must be greater than 0");

        uint256 id = nextStudentId[msg.sender]++;
        students[msg.sender][id] = StudentDetails({
            id: id,
            name: _name,
            course: _course,
            age: _age,
            status: Status.ACTIVE,
            exists: true
        });

        emit StudentAdded(msg.sender, id, _name, _course, _age, Status.ACTIVE);
    }

    function updateStudent(uint256 _id, string memory _name, string memory _course, uint256 _age) public {
        require(students[msg.sender][_id].exists, "Student does not exist");
        require(bytes(_name).length > 0, "Name cannot be empty");
        require(bytes(_course).length > 0, "Course cannot be empty");
        require(_age > 0, "Age must be greater than 0");

        students[msg.sender][_id].name = _name;
        students[msg.sender][_id].course = _course;
        students[msg.sender][_id].age = _age;
        emit StudentUpdated(msg.sender, _id, _name, _course, _age, students[msg.sender][_id].status);
    }

    function updateStudentStatus(uint256 _id, Status _status) public {
        require(students[msg.sender][_id].exists, "Student does not exist");

        students[msg.sender][_id].status = _status;
        emit StudentUpdated(msg.sender, _id, students[msg.sender][_id].name, students[msg.sender][_id].course, students[msg.sender][_id].age, _status);
    }

    function deleteStudent(uint256 _id) public {
        require(students[msg.sender][_id].exists, "Student does not exist");

        students[msg.sender][_id].exists = false;
        emit StudentDeleted(msg.sender, _id);
    }

    function getStudentById(uint256 _id) public view returns (StudentDetails memory) {
        require(students[msg.sender][_id].exists, "Student does not exist");
        return students[msg.sender][_id];
    }
}