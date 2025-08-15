// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;
import {TicketToken} from "./TicketToken.sol";
import {TicketNft} from "./TicketNft.sol";

contract EventTicketing {
    TicketToken public ticketToken;
    TicketNft public ticketNft;
    address public owner;

    modifier onlyOwner() {
        require(msg.sender == owner, "UNAUTHORIZED ACCESS");
        _;
    }

    constructor(uint256 initialSupply) {
        owner = msg.sender;
        ticketToken = new TicketToken(initialSupply);
        ticketNft = new TicketNft();
    }

    struct TicketDetails {
        address ticket_token;
        address ticket_nft;
        uint256 ticket_price;
        uint256 ticket_supply;
        uint256 ticket_sold;
        uint256 ticket_nft_supply;
        uint256 ticket_nft_sold;
    }

    mapping(uint256 => TicketDetails) public tickets;
    uint256 public ticketCount;

    event TicketCreated(
        uint256 indexed ticketId,
        address ticketToken,
        address ticketNft,
        uint256 ticketPrice,
        uint256 ticketSupply,
        uint256 ticketNftSupply
    );

    function createTicket(
        uint256 ticketPrice,
        uint256 ticketSupply,
        uint256 ticketNftSupply
    ) external onlyOwner {
        require(ticketSupply > 0, "Ticket supply must be greater than zero");
        require(ticketNftSupply > 0, "NFT supply must be greater than zero");

        TicketDetails memory newTicket = TicketDetails({
            ticket_token: address(ticketToken),
            ticket_nft: address(ticketNft),
            ticket_price: ticketPrice,
            ticket_supply: ticketSupply,

            ticket_sold: 0,
            ticket_nft_supply: ticketNftSupply,
            ticket_nft_sold: 0
        });

        tickets[ticketCount] = newTicket;
        emit TicketCreated(
            ticketCount,
            address(ticketToken),
            address(ticketNft),
            ticketPrice,
            ticketSupply,
            ticketNftSupply
        );

        ticketCount++;
    }

    function buyTicket(uint256 ticketId, uint256 amount) external payable {
        TicketDetails storage ticket = tickets[ticketId];
        require(
            ticket.ticket_sold + amount <= ticket.ticket_supply,
            "Not enough tickets available"
        );
        require(
            msg.value >= ticket.ticket_price * amount,
            "Insufficient payment"
        );

        ticket.ticket_sold += amount;

        ticketNft.transferFrom(
            address(this),
            msg.sender,
            ticket.ticket_nft_sold + 1
        );

        ticketToken.mint(msg.sender, amount);
        ticket.ticket_nft_sold += 1;
        ticket.ticket_nft_supply -= 1;
        ticket.ticket_supply -= amount;
    }
}