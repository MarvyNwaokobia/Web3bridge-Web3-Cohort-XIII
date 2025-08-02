// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface ISchoolManage {
    function registerTeacher(address _teacherAddress, string memory _name, uint256 _salary) external;
    function updateTeacher(address _teacherAddress, string memory _name, uint256 _salary) external;
    function updateTeacherStatus(address _teacherAddress, uint8 _status) external;
    function paySalary(address _teacherAddress) external payable;
}

contract SchoolManage is ISchoolManage {

    error TeacherNotFound();
    error InvalidTeacherAddress();
    error InvalidSalary();
    error InvalidStatus();
    error NotOwner();
    error NotEmployed();
    error InsufficientBalance();
    error PaymentFailed();


    enum Status { Employed, Unemployed, Probation }


    struct TeacherDetails {
        string name;
        uint salary; 
        Status status;
        bool exists;
    }


    mapping(address => TeacherDetails) public teachers;


    address public owner;

    
    event TeacherRegistered(address indexed teacherAddress, string name, uint256 salary, Status status);
    event TeacherUpdated(address indexed teacherAddress, string name, uint256 salary, Status status);
    event TeacherStatusUpdated(address indexed teacherAddress, Status status);
    event SalaryPaid(address indexed teacherAddress, uint256 amount);

    
    constructor() {
        owner = msg.sender;
    }

    
    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    
    function registerTeacher(address _teacherAddress, string memory _name, uint256 _salary) external override onlyOwner {
        if (_teacherAddress == address(0)) revert InvalidTeacherAddress();
        if (bytes(_name).length == 0) revert InvalidTeacherAddress();
        if (_salary == 0) revert InvalidSalary();
        if (teachers[_teacherAddress].exists) revert TeacherNotFound();

        teachers[_teacherAddress] = TeacherDetails({
            name: _name,
            salary: _salary,
            status: Status.Employed,
            exists: true
        });

        emit TeacherRegistered(_teacherAddress, _name, _salary, Status.Employed);
    }


    function updateTeacher(address _teacherAddress, string memory _name, uint256 _salary) external override onlyOwner {
        if (_teacherAddress == address(0)) revert InvalidTeacherAddress();
        if (!teachers[_teacherAddress].exists) revert TeacherNotFound();
        if (bytes(_name).length == 0) revert InvalidTeacherAddress();
        if (_salary == 0) revert InvalidSalary();

        teachers[_teacherAddress].name = _name;
        teachers[_teacherAddress].salary = _salary;

        emit TeacherUpdated(_teacherAddress, _name, _salary, teachers[_teacherAddress].status);
    }


    function updateTeacherStatus(address _teacherAddress, uint8 _status) external override onlyOwner {
        if (_teacherAddress == address(0)) revert InvalidTeacherAddress();
        if (!teachers[_teacherAddress].exists) revert TeacherNotFound();
        if (_status > uint8(Status.Probation)) revert InvalidStatus();

        teachers[_teacherAddress].status = Status(_status);

        emit TeacherStatusUpdated(_teacherAddress, Status(_status));
    }


    function paySalary(address _teacherAddress) external override onlyOwner payable {
        if (_teacherAddress == address(0)) revert InvalidTeacherAddress();
        if (!teachers[_teacherAddress].exists) revert TeacherNotFound();
        if (teachers[_teacherAddress].status != Status.Employed) revert NotEmployed();
        if (address(this).balance < teachers[_teacherAddress].salary) revert InsufficientBalance();

        (bool success, ) = _teacherAddress.call{value: teachers[_teacherAddress].salary}("");
        if (!success) revert PaymentFailed();

        emit SalaryPaid(_teacherAddress, teachers[_teacherAddress].salary);
    }


    function deposit() external payable {

    }

    function getTeacherDetails(address _teacherAddress) external view returns (string memory name, uint256 salary, Status status, bool exists) {
        if (_teacherAddress == address(0)) revert InvalidTeacherAddress();
        if (!teachers[_teacherAddress].exists) revert TeacherNotFound();

        TeacherDetails memory teacher = teachers[_teacherAddress];
        return (teacher.name, teacher.salary, teacher.status, teacher.exists);
    }
}