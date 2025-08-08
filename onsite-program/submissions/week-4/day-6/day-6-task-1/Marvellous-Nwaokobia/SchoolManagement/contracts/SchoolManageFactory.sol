// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "./SchoolManage.sol";

contract SchoolManageFactory {
    
    SchoolManage[] public schools;

    function createSchool() public {
        SchoolManage newSchool = new SchoolManage();
        schools.push(newSchool);
    }
}