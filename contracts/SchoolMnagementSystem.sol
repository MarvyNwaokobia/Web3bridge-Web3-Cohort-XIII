// SPDX-License-Identifier: UNLICENSED

pragma solidity >=0.8.2 <0.9.0;

contract SchoolManagementSystem {
    enum Status { ACTIVE, DEFERRED, RUSTICATED }
    
    struct Student {
        uint256 id;
        string name;
        uint256 age;
        Status status;
        bool exists; 
    }
    
    Student[] public students;
    
    uint256 private nextId = 1;
    
    event StudentRegistered(uint256 id, string name, uint256 age, Status status);
    event StudentUpdated(uint256 id, string name, uint256 age, Status status);
    event StudentDeleted(uint256 id);
    
    modifier studentExists(uint256 _id) {
        bool found = false;
        for (uint256 i = 0; i < students.length; i++) {
            if (students[i].id == _id && students[i].exists) {
                found = true;
                break;
            }
        }
        require(found, "Student does not exist");
        _;
    }
    
    function registerStudent(string memory _name, uint256 _age) public {
        require(bytes(_name).length > 0, "Name cannot be empty");
        require(_age > 0, "Age must be greater than 0");
        
        students.push(Student({
            id: nextId,
            name: _name,
            age: _age,
            status: Status.ACTIVE,
            exists: true
        }));
        
        emit StudentRegistered(nextId, _name, _age, Status.ACTIVE);
        nextId++;
    }
    
    function updateStudent(uint256 _id, string memory _name, uint256 _age) 
        public 
        studentExists(_id) 
    {
        require(bytes(_name).length > 0, "Name cannot be empty");
        require(_age > 0, "Age must be greater than 0");
        
        for (uint256 i = 0; i < students.length; i++) {
            if (students[i].id == _id && students[i].exists) {
                students[i].name = _name;
                students[i].age = _age;
                emit StudentUpdated(_id, _name, _age, students[i].status);
                break;
            }
        }
    }
    
    function updateStudentStatus(uint256 _id, Status _status) 
        public 
        studentExists(_id) 
    {
        for (uint256 i = 0; i < students.length; i++) {
            if (students[i].id == _id && students[i].exists) {
                students[i].status = _status;
                emit StudentUpdated(_id, students[i].name, students[i].age, _status);
                break;
            }
        }
    }
    
    function deleteStudent(uint256 _id) 
        public 
        studentExists(_id) 
    {
        for (uint256 i = 0; i < students.length; i++) {
            if (students[i].id == _id && students[i].exists) {
                students[i].exists = false;
                emit StudentDeleted(_id);
                break;
            }
        }
    }
    
    function getStudent(uint256 _id) 
        public 
        view 
        studentExists(_id)
        returns (uint256, string memory, uint256, Status) 
    {
        for (uint256 i = 0; i < students.length; i++) {
            if (students[i].id == _id && students[i].exists) {
                return (
                    students[i].id,
                    students[i].name,
                    students[i].age,
                    students[i].status
                );
            }
        }
        revert("Student not found");
    }
    
    function getAllStudents() 
        public 
        view 
        returns (Student[] memory) 
    {
        uint256 activeCount = 0;
        for (uint256 i = 0; i < students.length; i++) {
            if (students[i].exists) {
                activeCount++;
            }
        }
        
        Student[] memory activeStudents = new Student[](activeCount);
        uint256 currentIndex = 0;
        
        for (uint256 i = 0; i < students.length; i++) {
            if (students[i].exists) {
                activeStudents[currentIndex] = students[i];
                currentIndex++;
            }
        }
        
        return activeStudents;
    }
    
    function getStudentCount() 
        public 
        view 
        returns (uint256) 
    {
        uint256 count = 0;
        for (uint256 i = 0; i < students.length; i++) {
            if (students[i].exists) {
                count++;
            }
        }
        return count;
    }
}