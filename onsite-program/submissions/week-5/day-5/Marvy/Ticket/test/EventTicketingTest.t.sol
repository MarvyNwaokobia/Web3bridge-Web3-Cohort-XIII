
// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import {Test, console} from "forge-std/Test.sol";
import {EventTicketing} from "../src/EventTicketing.sol";
import {TicketToken} from "../src/TicketToken.sol";
import {TicketNft} from "../src/TicketNFT.sol";

contract EventTicketingTest is Test {
    EventTicketing public eventTicketing;
    TicketToken public ticketToken;
    TicketNft public ticketNft;

    address public owner;
    address public user1;
    address public user2;

    uint256 public constant INITIAL_SUPPLY = 1000000 * 10**18;
    uint256 public constant TICKET_PRICE = 0.1 ether;
    uint256 public constant TICKET_SUPPLY = (100);
    uint256 public constant NFT_SUPPLY = 50;

    function setUp() public {
        owner = makeAddr("owner");
        user1 = makeAddr("user1");
        user2 = makeAddr("user2");

        vm.prank(owner);
        eventTicketing = new EventTicketing(INITIAL_SUPPLY);

        ticketToken = eventTicketing.ticketToken();

        vm.deal(user1, 10 ether);
        vm.deal(user2, 10 ether);
    }


    function test_DeploymentState() public view {
        assertEq(eventTicketing.owner(), owner);
        assertEq(eventTicketing.ticketCount(), 0);
        assertTrue(address(eventTicketing.ticketToken()) != address(0));
        assertTrue(address(eventTicketing.ticketNft()) != address(0));
    }


    function test_CreateTicket() public {
        vm.prank(owner);
        vm.expectEmit(true, true, true, true);
        emit EventTicketing.TicketCreated(
            0,
            address(ticketToken),
            address(ticketNft),
            TICKET_PRICE,
            TICKET_SUPPLY,
            NFT_SUPPLY
        );

        eventTicketing.createTicket(TICKET_PRICE, TICKET_SUPPLY, NFT_SUPPLY);

        (
            address ticket_token,
            address ticket_nft,
            uint256 ticket_price,
            uint256 ticket_supply,
            uint256 ticket_sold,
            uint256 ticket_nft_supply,
            uint256 ticket_nft_sold
        ) = eventTicketing.tickets(0);

        assertEq(ticket_token, address(ticketToken));
        assertEq(ticket_nft, address(ticketNft));
        assertEq(ticket_price, TICKET_PRICE);
        assertEq(ticket_supply, TICKET_SUPPLY);
        assertEq(ticket_sold, 0);
        assertEq(ticket_nft_supply, NFT_SUPPLY);
        assertEq(ticket_nft_sold, 0);
        assertEq(eventTicketing.ticketCount(), 1);
    }

    function test_CreateTicketOnlyOwner() public {
        vm.prank(user1);
        vm.expectRevert("UNAUTHORIZED ACCESS");
        eventTicketing.createTicket(TICKET_PRICE, TICKET_SUPPLY, NFT_SUPPLY);
    }

    function test_CreateTicketZeroSupply() public {
        vm.prank(owner);
        vm.expectRevert("Ticket supply must be greater than zero");
        eventTicketing.createTicket(TICKET_PRICE, 0, NFT_SUPPLY);
    }

    function test_CreateTicketZeroNftSupply() public {
        vm.prank(owner);
        vm.expectRevert("NFT supply must be greater than zero");
        eventTicketing.createTicket(TICKET_PRICE, TICKET_SUPPLY, 0);
    }

    function test_CreateMultipleTickets() public {
        vm.startPrank(owner);

        eventTicketing.createTicket(TICKET_PRICE, TICKET_SUPPLY, NFT_SUPPLY);
        eventTicketing.createTicket(0.2 ether, 200, 100);
        eventTicketing.createTicket(0.05 ether, 50, 25);

        vm.stopPrank();

        assertEq(eventTicketing.ticketCount(), 3);

        (, , uint256 price2, uint256 supply2, , uint256 nftSupply2, ) = eventTicketing.tickets(1);
        assertEq(price2, 0.2 ether);
        assertEq(supply2, 200);
        assertEq(nftSupply2, 100);
    }


    function test_BuyTicket() public {
        vm.prank(owner);
        eventTicketing.createTicket(TICKET_PRICE, TICKET_SUPPLY, NFT_SUPPLY);

        uint256 ticketAmount = 5;
        uint256 totalCost = TICKET_PRICE * ticketAmount;

        vm.mockCall(
            address(ticketNft),
            abi.encodeWithSignature("transferFrom(address,address,uint256)", address(eventTicketing), user1, 1),
            abi.encode()
        );

        vm.mockCall(
            address(ticketToken),
            abi.encodeWithSignature("mint(address,uint256)", user1, ticketAmount),
            abi.encode()
        );

        uint256 initialBalance = user1.balance;

        vm.prank(user1);
        eventTicketing.buyTicket{value: totalCost}(0, ticketAmount);

        (, , , uint256 supply, uint256 sold, uint256 nftSupply, uint256 nftSold) = eventTicketing.tickets(0);
        assertEq(sold, ticketAmount);
        assertEq(supply, TICKET_SUPPLY - ticketAmount);
        assertEq(nftSold, 1);
        assertEq(nftSupply, NFT_SUPPLY - 1);

        assertEq(user1.balance, initialBalance - totalCost);
    }

    function test_BuyTicketInsufficientPayment() public {
        vm.prank(owner);
        eventTicketing.createTicket(TICKET_PRICE, TICKET_SUPPLY, NFT_SUPPLY);

        uint256 ticketAmount = 5;
        uint256 insufficientPayment = (TICKET_PRICE * ticketAmount) - 1 wei;

        vm.prank(user1);
        vm.expectRevert("Insufficient payment");
        eventTicketing.buyTicket{value: insufficientPayment}(0, ticketAmount);
    }

    function test_BuyTicketNotEnoughSupply() public {
        vm.prank(owner);
        eventTicketing.createTicket(TICKET_PRICE, 10, NFT_SUPPLY); 

        uint256 ticketAmount = 15; 
        uint256 totalCost = TICKET_PRICE * ticketAmount;

        vm.prank(user1);
        vm.expectRevert("Not enough tickets available");
        eventTicketing.buyTicket{value: totalCost}(0, ticketAmount);
    }

    function test_BuyTicketExcessPayment() public {
        vm.prank(owner);
        eventTicketing.createTicket(TICKET_PRICE, TICKET_SUPPLY, NFT_SUPPLY);

        uint256 ticketAmount = 3;
        uint256 excessPayment = (TICKET_PRICE * ticketAmount) + 1 ether; 

        vm.mockCall(
            address(ticketNft),
            abi.encodeWithSignature("transferFrom(address,address,uint256)", address(eventTicketing), user1, 1),
            abi.encode()
        );
        vm.mockCall(
            address(ticketToken),
            abi.encodeWithSignature("mint(address,uint256)", user1, ticketAmount),
            abi.encode()
        );

        uint256 initialBalance = user1.balance;

        vm.prank(user1);
        eventTicketing.buyTicket{value: excessPayment}(0, ticketAmount);

        assertEq(user1.balance, initialBalance - excessPayment);
    }

    function test_BuyMultipleTicketsSameUser() public {
        vm.prank(owner);
        eventTicketing.createTicket(TICKET_PRICE, TICKET_SUPPLY, NFT_SUPPLY);

        vm.mockCall(
            address(ticketNft),
            abi.encodeWithSignature("transferFrom(address,address,uint256)"),
            abi.encode()
        );
        vm.mockCall(
            address(ticketToken),
            abi.encodeWithSignature("mint(address,uint256)"),
            abi.encode()
        );

        vm.prank(user1);
        eventTicketing.buyTicket{value: TICKET_PRICE * 3}(0, 3);

        vm.prank(user1);
        eventTicketing.buyTicket{value: TICKET_PRICE * 2}(0, 2);

        (, , , uint256 supply, uint256 sold, , ) = eventTicketing.tickets(0);
        assertEq(sold, 5);
        assertEq(supply, TICKET_SUPPLY - 5);
    }

    function test_BuyTicketsDifferentUsers() public {
        vm.prank(owner);
        eventTicketing.createTicket(TICKET_PRICE, TICKET_SUPPLY, NFT_SUPPLY);

        vm.mockCall(
            address(ticketNft),
            abi.encodeWithSignature("transferFrom(address,address,uint256)"),
            abi.encode()
        );
        vm.mockCall(
            address(ticketToken),
            abi.encodeWithSignature("mint(address,uint256)"),
            abi.encode()
        );

        vm.prank(user1);
        eventTicketing.buyTicket{value: TICKET_PRICE * 4}(0, 4);

        vm.prank(user2);
        eventTicketing.buyTicket{value: TICKET_PRICE * 6}(0, 6);

        (, , , uint256 supply, uint256 sold, , ) = eventTicketing.tickets(0);
        assertEq(sold, 10);
        assertEq(supply, TICKET_SUPPLY - 10);
    }


    function test_BuyNonExistentTicket() public {
        uint256 nonExistentTicketId = 999;

        vm.prank(user1);
        vm.expectRevert("Not enough tickets available");
        eventTicketing.buyTicket{value: 0.1 ether}(nonExistentTicketId, 1);
    }

    function test_BuyZeroTickets() public {
        vm.prank(owner);
        eventTicketing.createTicket(TICKET_PRICE, TICKET_SUPPLY, NFT_SUPPLY);

        vm.mockCall(
            address(ticketNft),
            abi.encodeWithSignature("transferFrom(address,address,uint256)"),
            abi.encode()
        );
        vm.mockCall(
            address(ticketToken),
            abi.encodeWithSignature("mint(address,uint256)"),
            abi.encode()
        );

        vm.prank(user1);
        eventTicketing.buyTicket{value: 0}(0, 0);

        (, , , , uint256 sold, , ) = eventTicketing.tickets(0);
        assertEq(sold, 0);
    }


    function createSampleTicket() internal {
        vm.prank(owner);
        eventTicketing.createTicket(TICKET_PRICE, TICKET_SUPPLY, NFT_SUPPLY);
    }
}    
