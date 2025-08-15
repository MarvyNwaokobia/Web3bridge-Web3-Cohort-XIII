// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Test.sol";
import "forge-std/console.sol";
import "../src/UniswapPermitSwap.sol";

contract MockERC20Permit {
    string public name;
    string public symbol;
    uint8 public decimals;
    uint256 public totalSupply;

    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;
    mapping(address => uint256) public nonces;

    bytes32 public DOMAIN_SEPARATOR;

    bytes32 public constant PERMIT_TYPEHASH = 
        keccak256("Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)");

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    constructor(string memory _name, string memory _symbol, uint8 _decimals) {
        name = _name;
        symbol = _symbol;
        decimals = _decimals;
        
        DOMAIN_SEPARATOR = keccak256(
            abi.encode(
                keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
                keccak256(bytes(_name)),
                keccak256(bytes("1")),
                block.chainid,
                address(this)
            )
        );
    }

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
        totalSupply += amount;
        emit Transfer(address(0), to, amount);
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        require(balanceOf[msg.sender] >= amount, "Insufficient balance");
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        emit Transfer(msg.sender, to, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        require(balanceOf[from] >= amount, "Insufficient balance");
        require(allowance[from][msg.sender] >= amount, "Insufficient allowance");
        
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        allowance[from][msg.sender] -= amount;
        
        emit Transfer(from, to, amount);
        return true;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function permit(
        address owner,
        address spender,
        uint256 value,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external {
        require(block.timestamp <= deadline, "Permit expired");
        
        bytes32 digest = keccak256(
            abi.encodePacked(
                "\x19\x01",
                DOMAIN_SEPARATOR,
                keccak256(abi.encode(PERMIT_TYPEHASH, owner, spender, value, nonces[owner]++, deadline))
            )
        );
        
        address signer = ecrecover(digest, v, r, s);
        require(signer == owner, "Invalid signature");
        
        allowance[owner][spender] = value;
        emit Approval(owner, spender, value);
    }
}

contract MockUniswapRouter {
    mapping(address => mapping(address => uint256)) public exchangeRates;
    
    function setExchangeRate(address tokenA, address tokenB, uint256 rate) external {
        exchangeRates[tokenA][tokenB] = rate;
    }

    function swapExactTokensForTokens(
        uint amountIn,
        uint amountOutMin,
        address[] calldata path,
        address to,
        uint deadline
    ) external returns (uint[] memory amounts) {
        require(path.length == 2, "Only direct swaps supported");
        require(block.timestamp <= deadline, "Deadline exceeded");
        
        address tokenIn = path[0];
        address tokenOut = path[1];
        
        uint256 amountOut = (amountIn * exchangeRates[tokenIn][tokenOut]) / 1e18;
        require(amountOut >= amountOutMin, "Insufficient output amount");
        
        MockERC20Permit(tokenIn).transferFrom(msg.sender, address(this), amountIn);
        MockERC20Permit(tokenOut).transfer(to, amountOut);
        
        amounts = new uint[](2);
        amounts[0] = amountIn;
        amounts[1] = amountOut;
    }

    function getAmountsOut(uint amountIn, address[] calldata path)
        external view returns (uint[] memory amounts) {
        require(path.length == 2, "Only direct swaps supported");
        
        address tokenIn = path[0];
        address tokenOut = path[1];
        
        amounts = new uint[](2);
        amounts[0] = amountIn;
        amounts[1] = (amountIn * exchangeRates[tokenIn][tokenOut]) / 1e18;
    }
}

contract UniswapPermitSwapTest is Test {
    UniswapPermitSwap public permitSwap;
    MockUniswapRouter public mockRouter;
    MockERC20Permit public tokenA;
    MockERC20Permit public tokenB;
    
    uint256 constant PRIVATE_KEY_1 = 0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef;
    uint256 constant PRIVATE_KEY_2 = 0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890;
    
    address user1;
    address user2;
    address relayer;

    event SwapExecuted(
        address indexed owner,
        address indexed tokenIn,
        address indexed tokenOut,
        uint256 amountIn,
        uint256 amountOut
    );

    function setUp() public {
        // Deploy mock contracts
        mockRouter = new MockUniswapRouter();
        permitSwap = new UniswapPermitSwap(address(mockRouter));
        
        // Deploy mock tokens
        tokenA = new MockERC20Permit("Token A", "TKNA", 18);
        tokenB = new MockERC20Permit("Token B", "TKNB", 18);
        
        // Set up users
        user1 = vm.addr(PRIVATE_KEY_1);
        user2 = vm.addr(PRIVATE_KEY_2);
        relayer = makeAddr("relayer");
        
        // Set exchange rate: 1 tokenA = 2 tokenB
        mockRouter.setExchangeRate(address(tokenA), address(tokenB), 2e18);
        
        // Mint tokens
        tokenA.mint(user1, 1000e18);
        tokenA.mint(user2, 1000e18);
        tokenB.mint(address(mockRouter), 10000e18); // For swaps
        
        vm.label(user1, "User1");
        vm.label(user2, "User2");
        vm.label(relayer, "Relayer");
        vm.label(address(permitSwap), "PermitSwap");
        vm.label(address(mockRouter), "MockRouter");
    }

    function testDomainSeparator() public view {
        bytes32 expected = keccak256(
            abi.encode(
                keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
                keccak256(bytes("UniswapPermitSwap")),
                keccak256(bytes("1")),
                block.chainid,
                address(permitSwap)
            )
        );
        
        assertEq(permitSwap.DOMAIN_SEPARATOR(), expected);
    }

    function testGetSwapPermitHash() public view {
        UniswapPermitSwap.SwapPermit memory permit = UniswapPermitSwap.SwapPermit({
            owner: user1,
            tokenIn: address(tokenA),
            tokenOut: address(tokenB),
            amountIn: 100e18,
            amountOutMin: 180e18,
            deadline: block.timestamp + 3600,
            nonce: 0
        });

        bytes32 hash = permitSwap.getSwapPermitHash(permit);
        assertTrue(hash != bytes32(0));
        
        // Hash should be deterministic
        bytes32 hash2 = permitSwap.getSwapPermitHash(permit);
        assertEq(hash, hash2);
    }

    function testSuccessfulSwapWithPermit() public {
        uint256 amountIn = 100e18;
        uint256 amountOutMin = 180e18; // Expecting ~200e18, so 180e18 is safe
        uint256 deadline = block.timestamp + 3600;

        // Create swap permit
        UniswapPermitSwap.SwapPermit memory swapPermit = UniswapPermitSwap.SwapPermit({
            owner: user1,
            tokenIn: address(tokenA),
            tokenOut: address(tokenB),
            amountIn: amountIn,
            amountOutMin: amountOutMin,
            deadline: deadline,
            nonce: 0
        });

        // Sign swap permit
        bytes32 swapDigest = permitSwap.getSwapPermitHash(swapPermit);
        (uint8 swapV, bytes32 swapR, bytes32 swapS) = vm.sign(PRIVATE_KEY_1, swapDigest);

        // Sign token permit
        bytes32 tokenDigest = keccak256(
            abi.encodePacked(
                "\x19\x01",
                tokenA.DOMAIN_SEPARATOR(),
                keccak256(abi.encode(
                    tokenA.PERMIT_TYPEHASH(),
                    user1,
                    address(permitSwap),
                    amountIn,
                    0, // nonce
                    deadline
                ))
            )
        );
        (uint8 tokenV, bytes32 tokenR, bytes32 tokenS) = vm.sign(PRIVATE_KEY_1, tokenDigest);

        // Record balances before
        uint256 user1TokenABefore = tokenA.balanceOf(user1);
        uint256 user1TokenBBefore = tokenB.balanceOf(user1);

        // Execute swap
        vm.expectEmit(true, true, true, true);
        emit SwapExecuted(user1, address(tokenA), address(tokenB), amountIn, amountIn * 2);
        
        vm.prank(relayer);
        permitSwap.executeSwapWithPermit(
            swapPermit,
            swapV, swapR, swapS,
            tokenV, tokenR, tokenS
        );

        // Verify balances
        assertEq(tokenA.balanceOf(user1), user1TokenABefore - amountIn);
        assertEq(tokenB.balanceOf(user1), user1TokenBBefore + (amountIn * 2));
        
        // Verify nonce incremented
        assertEq(permitSwap.nonces(user1), 1);
    }

    function testFailExpiredDeadline() public {
        uint256 deadline = block.timestamp - 1; // Past deadline
        
        UniswapPermitSwap.SwapPermit memory swapPermit = UniswapPermitSwap.SwapPermit({
            owner: user1,
            tokenIn: address(tokenA),
            tokenOut: address(tokenB),
            amountIn: 100e18,
            amountOutMin: 180e18,
            deadline: deadline,
            nonce: 0
        });

        bytes32 swapDigest = permitSwap.getSwapPermitHash(swapPermit);
        (uint8 swapV, bytes32 swapR, bytes32 swapS) = vm.sign(PRIVATE_KEY_1, swapDigest);

        vm.prank(relayer);
        vm.expectRevert("Expired deadline");
        permitSwap.executeSwapWithPermit(
            swapPermit,
            swapV, swapR, swapS,
            27, bytes32(0), bytes32(0) // Dummy token permit
        );
    }

    function testFailInvalidNonce() public {
        uint256 deadline = block.timestamp + 3600;
        
        UniswapPermitSwap.SwapPermit memory swapPermit = UniswapPermitSwap.SwapPermit({
            owner: user1,
            tokenIn: address(tokenA),
            tokenOut: address(tokenB),
            amountIn: 100e18,
            amountOutMin: 180e18,
            deadline: deadline,
            nonce: 999 // Wrong nonce
        });

        bytes32 swapDigest = permitSwap.getSwapPermitHash(swapPermit);
        (uint8 swapV, bytes32 swapR, bytes32 swapS) = vm.sign(PRIVATE_KEY_1, swapDigest);

        vm.prank(relayer);
        vm.expectRevert("Invalid nonce");
        permitSwap.executeSwapWithPermit(
            swapPermit,
            swapV, swapR, swapS,
            27, bytes32(0), bytes32(0) // Dummy token permit
        );
    }

    function testFailInvalidSignature() public {
        uint256 deadline = block.timestamp + 3600;
        
        UniswapPermitSwap.SwapPermit memory swapPermit = UniswapPermitSwap.SwapPermit({
            owner: user1,
            tokenIn: address(tokenA),
            tokenOut: address(tokenB),
            amountIn: 100e18,
            amountOutMin: 180e18,
            deadline: deadline,
            nonce: 0
        });

        // Sign with wrong private key
        bytes32 swapDigest = permitSwap.getSwapPermitHash(swapPermit);
        (uint8 swapV, bytes32 swapR, bytes32 swapS) = vm.sign(PRIVATE_KEY_2, swapDigest);

        vm.prank(relayer);
        vm.expectRevert("Invalid swap signature");
        permitSwap.executeSwapWithPermit(
            swapPermit,
            swapV, swapR, swapS,
            27, bytes32(0), bytes32(0)
        );
    }

    function testGetExpectedAmountOut() public view {
        uint256 amountIn = 100e18;
        uint256 expected = permitSwap.getExpectedAmountOut(
            address(tokenA),
            address(tokenB),
            amountIn
        );
        
        assertEq(expected, amountIn * 2); 
    }    
}