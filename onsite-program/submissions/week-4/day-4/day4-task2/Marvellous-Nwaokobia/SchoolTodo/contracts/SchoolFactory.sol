//SPDX-License-Identifier: MIT

pragma solidity ^0.8.28;

import "./School.sol";

contract SchoolFactory {
    School[] public schools;

    function createSchool() public {
        School newSchool = new School();
        schools.push(newSchool);
    }
}