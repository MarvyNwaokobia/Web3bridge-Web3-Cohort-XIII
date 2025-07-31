// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;


contract GarageAccess{

    enum Role {MediaTeam, Mentors, Managers, SocialMediaTeam, TechnicianSupervisor, KitchenStaff
    }

    struct Employee {
        string name;
        Role role;
        bool isEmployed;
    }

    mapping(address => Employee) public employees;

    Employee[] public allEmployees;

    event EmployeeAdded(address indexed employeeAddress, string name, Role role);
    event EmployeeUpdated(address indexed employeeAddress, string name, Role role, bool isEmployed);
    event AccessChecked(address indexed employeeAddress, bool canAccess);


    function addOrUpdateEmployee(address _employeeAddress, string memory _name, Role _role, bool _isEmployed) public {
        require(bytes(_name).length > 0, "Name cannot be empty");
        require(_employeeAddress != address(0), "Invalid address");

        bool exists = bytes(employees[_employeeAddress].name).length > 0;

        employees[_employeeAddress] = Employee({
            name: _name,
            role: _role,
            isEmployed: _isEmployed
        });

        if (!exists) {
            allEmployees.push(Employee({
                name: _name,
                role: _role,
                isEmployed: _isEmployed
            }));
            emit EmployeeAdded(_employeeAddress, _name, _role);
        } else {
            emit EmployeeUpdated(_employeeAddress, _name, _role, _isEmployed);
        }
        
    }

    function canAccessGarage(address _employeeAddress) public returns (bool) {
        Employee memory employee = employees[_employeeAddress];
        require(bytes(employee.name).length > 0, "Employee does not exist");

        bool canAccess = employee.isEmployed &&
                         (employee.role == Role.MediaTeam ||
                          employee.role == Role.Mentors ||
                          employee.role == Role.Managers);

        emit AccessChecked(_employeeAddress, canAccess);
        return canAccess;
    }

    function getAllEmployees() public view returns (Employee[] memory) {
        return allEmployees;
    }

    function getEmployee(address _employeeAddress) public view returns (string memory name, Role role, bool isEmployed) {
        Employee memory employee = employees[_employeeAddress];
        require(bytes(employee.name).length > 0, "Employee does not exist");
        return (employee.name, employee.role, employee.isEmployed);
    }

}