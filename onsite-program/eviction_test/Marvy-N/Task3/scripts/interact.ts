import { ethers } from "hardhat";

const LUDO_TOKEN_ADDRESS = "YOUR_LUDO_TOKEN_ADDRESS";
const LUDO_GAME_ADDRESS = "YOUR_LUDO_GAME_ADDRESS";

async function main() {
  console.log("🎲 Starting Ludo Game Interaction Demo...\n");

  const [deployer, player1, player2, player3, player4] = await ethers.getSigners();

  console.log(" Players:");
  console.log("   Player 1 (RED):", player1.address);
  console.log("   Player 2 (GREEN):", player2.address);
  console.log("   Player 3 (BLUE):", player3.address);
  console.log("   Player 4 (YELLOW):", player4.address);
  console.log("");

  try {
    const ludoToken = await ethers.getContractAt("LudoToken", LUDO_TOKEN_ADDRESS);
    const ludoGame = await ethers.getContractAt("LudoGame", LUDO_GAME_ADDRESS);

    console.log("🔗 Connected to contracts:");
    console.log("   LudoToken:", await ludoToken.getAddress());
    console.log("   LudoGame:", await ludoGame.getAddress());
    console.log("");

    console.log("💰 Distributing tokens to players...");
    const tokenAmount = ethers.parseEther("10");
    
    for (let i = 1; i <= 4; i++) {
      const player = [player1, player2, player3, player4][i - 1];
      const transferTx = await ludoToken.transfer(player.address, tokenAmount);
      await transferTx.wait();
      console.log(`   Sent ${ethers.formatEther(tokenAmount)} LUDO to Player ${i}`);
      console.log(`    Tx hash: ${transferTx.hash}`);
    }
    console.log("");

    console.log("🔓 Players approving tokens for game contract...");
    const approveAmount = ethers.parseEther("5");
    
    for (let i = 1; i <= 4; i++) {
      const player = [player1, player2, player3, player4][i - 1];
      const approveTx = await ludoToken.connect(player).approve(await ludoGame.getAddress(), approveAmount);
      await approveTx.wait();
      console.log(`   Player ${i} approved ${ethers.formatEther(approveAmount)} LUDO`);
    }
    console.log("");

    console.log("📝 Registering players...");
    const playerNames = ["Alice", "Bob", "Charlie", "David"];
    const playerColors = [0, 1, 2, 3]; 
    const players = [player1, player2, player3, player4];

    for (let i = 0; i < 4; i++) {
      const registerTx = await ludoGame.connect(players[i]).registerPlayer(playerNames[i], playerColors[i]);
      await registerTx.wait();
      
      console.log(`   ${playerNames[i]} registered with color ${['RED', 'GREEN', 'BLUE', 'YELLOW'][playerColors[i]]}`);
      console.log(`      📋 Tx hash: ${registerTx.hash}`);
    }
    console.log("");

    const [gameState] = await ludoGame.getGameInfo();
    console.log("🎮 Game Status:");
    console.log(`   Players registered: ${gameState.playerCount}`);
    console.log(`   Game active: ${gameState.gameActive}`);
    console.log(`   Game ID: ${gameState.gameId}`);
    console.log("");

    console.log("🎯 Starting game simulation...");
    console.log("   Target score: 100");
    console.log("");

    let gameFinished = false;
    let round = 1;
    const maxRounds = 50; 

    while (!gameFinished && round <= maxRounds) {
      console.log(`🔄 Round ${round}:`);
      
      for (let i = 0; i < 4; i++) {
        try {
          const currentGameState = await ludoGame.gameState();
          if (currentGameState.winner !== ethers.ZeroAddress) {
            gameFinished = true;
            break;
          }

          const player = players[i];
          const playerName = playerNames[i];
          
          const rollTx = await ludoGame.connect(player).rollDiceAndMove();
          const receipt = await rollTx.wait();
          
          let diceRoll = 0;
          let newScore = 0;
          
          if (receipt) {
            for (const log of receipt.logs) {
              try {
                const parsedLog = ludoGame.interface.parseLog(log as any);
                if (parsedLog?.name === "DiceRolled") {
                  diceRoll = Number(parsedLog.args[1]);
                } else if (parsedLog?.name === "Moved") {
                  newScore = Number(parsedLog.args[1]);
                } else if (parsedLog?.name === "WinnerDeclared") {
                  console.log(`   ${playerName} WINS with score ${newScore}!`);
                  console.log(`      Prize: ${ethers.formatEther(parsedLog.args[1])} LUDO`);
                  console.log(`     Tx hash: ${rollTx.hash}`);
                  gameFinished = true;
                  break;
                }
              } catch (e) {
              }
            }
          }
          
          if (!gameFinished) {
            console.log(`   🎲 ${playerName} rolled ${diceRoll}, new score: ${newScore}`);
            console.log(`      📋 Tx hash: ${rollTx.hash}`);
          }
          
          await new Promise(resolve => setTimeout(resolve, 1000));
          
        } catch (error: any) {
          if (error.message.includes("Game already finished")) {
            gameFinished = true;
            break;
          } else {
            console.log(`   Error for ${playerNames[i]}: ${error.message}`);
          }
        }
      }
      
      round++;
      if (!gameFinished) {
        console.log("");
      }
    }

    if (!gameFinished) {
      console.log("⏰ Game simulation reached maximum rounds without a winner.");
    }

    console.log("");

    console.log("📊 Final Game State:");
    const [finalGameState, finalPlayers] = await ludoGame.getGameInfo();
    
    console.log(`   Winner: ${finalGameState.winner}`);
    console.log(`   Game ID: ${finalGameState.gameId}`);
    console.log("");
    
    console.log("👥 Final Player Scores:");
    for (let i = 0; i < 4; i++) {
      if (finalPlayers[i].isActive) {
        console.log(`   ${finalPlayers[i].name}: ${finalPlayers[i].score} points`);
      }
    }
    console.log("");

    console.log("🔄 Resetting game for next round...");
    const resetTx = await ludoGame.resetGame();
    await resetTx.wait();
    
    console.log("✅ Game reset successfully!");
    console.log(`📋 Reset tx hash: ${resetTx.hash}`);
    console.log("");

    console.log("🎉 Interaction demo completed successfully!");
    console.log("");
    console.log("📸 SCREENSHOT INSTRUCTIONS:");
    console.log("1. Save this console output as 'interact.png'");
    console.log("2. Visit Etherscan and screenshot key transactions:");
    console.log("   - Player registration transactions");
    console.log("   - Dice roll and move transactions");
    console.log("   - Winner declaration transaction");
    console.log("   - Game reset transaction");
    console.log("");

  } catch (error) {
    console.error("❌ Interaction failed:", error);
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Interaction script failed:", error);
    process.exit(1);
  });
