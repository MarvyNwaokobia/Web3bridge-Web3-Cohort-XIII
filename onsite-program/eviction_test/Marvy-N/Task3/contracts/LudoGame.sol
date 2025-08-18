// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";


contract LudoGame is ReentrancyGuard, Ownable {
    IERC20 public immutable ludoToken;
    
    uint256 public constant STAKE_AMOUNT = 1 * 10**18;
    
    uint256 public constant MAX_PLAYERS = 4;
    
    uint256 public constant WINNING_SCORE = 100;
    
    uint256 public constant PRIZE_POOL = 4 * 10**18;

    enum Color { RED, GREEN, BLUE, YELLOW }

    struct Player {
        address playerAddress;
        string name;
        Color color;
        uint256 score;
        bool isActive;
    }

    struct GameState {
        uint256 playerCount;
        bool gameActive;
        address winner;
        uint256 gameId;
    }

    GameState public gameState;
    
    Player[MAX_PLAYERS] public players;
    
    mapping(Color => bool) public colorTaken;
    
    mapping(address => bool) public isRegistered;

    event PlayerRegistered(address indexed player, string name, Color color);
    event DiceRolled(address indexed player, uint256 roll);
    event Moved(address indexed player, uint256 newScore);
    event WinnerDeclared(address indexed winner, uint256 prize);
    event GameReset(uint256 newGameId);

    
    constructor(address _ludoToken, address initialOwner) Ownable(initialOwner) {
        require(_ludoToken != address(0), "Invalid token address");
        ludoToken = IERC20(_ludoToken);
        gameState.gameId = 1;
    }

    
    function registerPlayer(string calldata _name, Color _color) external nonReentrant {
        require(!gameState.gameActive, "Game already in progress");
        require(gameState.playerCount < MAX_PLAYERS, "Maximum players reached");
        require(!isRegistered[msg.sender], "Player already registered");
        require(!colorTaken[_color], "Color already taken");
        require(bytes(_name).length > 0, "Name cannot be empty");
        require(bytes(_name).length <= 32, "Name too long");
        
        require(
            ludoToken.transferFrom(msg.sender, address(this), STAKE_AMOUNT),
            "Failed to transfer stake"
        );

        players[gameState.playerCount] = Player({
            playerAddress: msg.sender,
            name: _name,
            color: _color,
            score: 0,
            isActive: true
        });

        colorTaken[_color] = true;
        isRegistered[msg.sender] = true;
        gameState.playerCount++;

        emit PlayerRegistered(msg.sender, _name, _color);

        if (gameState.playerCount == MAX_PLAYERS) {
            gameState.gameActive = true;
        }
    }

    function rollDiceAndMove() external nonReentrant {
        require(gameState.gameActive, "Game not active");
        require(isRegistered[msg.sender], "Player not registered");
        require(gameState.winner == address(0), "Game already finished");

        uint256 playerIndex = _findPlayerIndex(msg.sender);
        require(players[playerIndex].isActive, "Player not active");

        uint256 diceRoll = _generateDiceRoll();
        
        emit DiceRolled(msg.sender, diceRoll);

        players[playerIndex].score += diceRoll;
        
        emit Moved(msg.sender, players[playerIndex].score);

        if (players[playerIndex].score >= WINNING_SCORE) {
            _declareWinner(msg.sender);
        }
    }

    function getGameInfo() external view returns (
        GameState memory currentGameState,
        Player[MAX_PLAYERS] memory currentPlayers
    ) {
        return (gameState, players);
    }

    function getPlayer(address playerAddress) external view returns (Player memory) {
        require(isRegistered[playerAddress], "Player not registered");
        uint256 playerIndex = _findPlayerIndex(playerAddress);
        return players[playerIndex];
    }

    function resetGame() external onlyOwner {
        require(gameState.winner != address(0), "No winner declared yet");
        
        for (uint256 i = 0; i < gameState.playerCount; i++) {
            colorTaken[players[i].color] = false;
            isRegistered[players[i].playerAddress] = false;
            delete players[i];
        }

        gameState.playerCount = 0;
        gameState.gameActive = false;
        gameState.winner = address(0);
        gameState.gameId++;

        emit GameReset(gameState.gameId);
    }

    function _declareWinner(address winner) internal {
        gameState.winner = winner;
        gameState.gameActive = false;

        require(
            ludoToken.transfer(winner, PRIZE_POOL),
            "Failed to transfer prize"
        );

        emit WinnerDeclared(winner, PRIZE_POOL);
    }

    function _findPlayerIndex(address playerAddress) internal view returns (uint256) {
        for (uint256 i = 0; i < gameState.playerCount; i++) {
            if (players[i].playerAddress == playerAddress) {
                return i;
            }
        }
        revert("Player not found");
    }

    function _generateDiceRoll() internal view returns (uint256) {
        uint256 randomHash = uint256(
            keccak256(
                abi.encodePacked(
                    block.timestamp,
                    block.prevrandao, 
                    msg.sender,
                    gameState.gameId,
                    gameState.playerCount
                )
            )
        );
        
        return (randomHash % 6) + 1;
    }

    function emergencyWithdraw(uint256 amount) external onlyOwner {
        require(
            ludoToken.transfer(owner(), amount),
            "Failed to withdraw tokens"
        );
    }
}
