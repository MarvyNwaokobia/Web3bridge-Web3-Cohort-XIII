// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import {Script, console} from "forge-std/Script.sol";
import {EventTicketing} from "../src/EventTicketing.sol";

contract DeployEventTicketing is Script {
    function setUp() public {}

    function run() public {
        vm.startBroadcast();

        uint256 initialSupply = 1000000 * 10**18; 

        EventTicketing eventTicketing = new EventTicketing(initialSupply);

        console.log("EventTicketing deployed at:", address(eventTicketing));
        console.log("TicketToken deployed at:", address(eventTicketing.ticketToken()));
        console.log("TicketNft deployed at:", address(eventTicketing.ticketNft()));
        console.log("Owner:", eventTicketing.owner());

        vm.stopBroadcast();
    }
}