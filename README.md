
# SME contracts

The SME contracts is a market protocol based on Seaport for safely and efficiently buying and selling NFTs.


## System Architecture Diagram

![System Architecture](img/system-diagram.png)

## Install

To install dependencies and compile contracts:

```bash
git clone --recurse-submodules https://github.com/0xMCG/sme-contracts && cd sme-contracts
yarn install
yarn build
```

## Usage

To run hardhat tests written in javascript:

1.Rebuild all contracts and run tests
```bash
yarn test
```

2.Rebuild changed contracts and run tests
```bash
yarn test:quick
```
## License

[MIT](LICENSE) Copyright 2023 Ozone Networks, Inc.
