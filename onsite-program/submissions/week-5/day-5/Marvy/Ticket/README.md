## Foundry

**Foundry is a blazing fast, portable and modular toolkit for Ethereum application development written in Rust.**

Foundry consists of:

-   **Forge**: Ethereum testing framework (like Truffle, Hardhat and DappTools).
-   **Cast**: Swiss army knife for interacting with EVM smart contracts, sending transactions and getting chain data.
-   **Anvil**: Local Ethereum node, akin to Ganache, Hardhat Network.
-   **Chisel**: Fast, utilitarian, and verbose solidity REPL.

## Documentation

https://book.getfoundry.sh/

## Usage

### Build

```shell
$ forge build
```

### Test

```shell
$ forge test
```

### Format

```shell
$ forge fmt
```

### Gas Snapshots

```shell
$ forge snapshot
```

### Anvil

```shell
$ anvil
```

### Deploy

```shell
$ forge script script/Counter.s.sol:CounterScript --rpc-url <your_rpc_url> --private-key <your_private_key>
```

### Cast

```shell
$ cast <subcommand>
```

### Help

```shell
$ forge --help
$ anvil --help
$ cast --help
```


Contract Address: 0xa9F415A0ee1A2C10219cC21E6fA997AC848906A9


EventTicketing deployed at: 0xa9F415A0ee1A2C10219cC21E6fA997AC848906A9
  TicketToken deployed at: 0x4Ab25553037644E39ac5571Bc5AB0bF112E03e2d
  TicketNft deployed at: 0xF0199764E45101724FC650BB212aE5F97BAC7344
  Owner: 0xF228786bD2ed120b4b73b430Be38A09456995724