import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers, network } from "hardhat";

import { randomHex, toBN } from "./utilsv2/encoding";
import { faucet } from "./utilsv2/faucet";
import { marketFixture } from "./utilsv2/fixtures";
import { VERSION } from "./utilsv2/helpers";

import { BigNumber, type Wallet } from "ethers";
import type { SmeMarket, TestERC20 } from "../typechain-types";
import type { MarketFixtures } from "./utilsv2/fixtures";

const { parseEther } = ethers.utils;

describe(`Cancel Prepared (SmeMarket v${VERSION})`, function () {
  const { provider } = ethers;
  const owner = new ethers.Wallet(randomHex(32), provider);

  let marketplaceContract: SmeMarket;
  let testERC20: TestERC20;
  let testERC20_2: TestERC20;

  let createOrder: MarketFixtures["createOrder"];
  let mintAndApproveERC20: MarketFixtures["mintAndApproveERC20"];
  let mintAndApproveERC20_2: MarketFixtures["mintAndApproveERC20_2"];
  let getTestItem20: MarketFixtures["getTestItem20"];

  after(async () => {
    await network.provider.request({
      method: "hardhat_reset",
    });
  });

  before(async () => {
    await faucet(owner.address, provider);

    ({ createOrder, marketplaceContract, mintAndApproveERC20, mintAndApproveERC20_2, testERC20, testERC20_2, getTestItem20 } =
      await marketFixture(owner));
  });

  let maker: Wallet;
  let maker2: Wallet;
  let taker: Wallet;
  let taker2: Wallet;
  let member: Wallet;
  let feeReciver: Wallet;

  async function setupFixture() {
    // Setup basic taker/maker wallets with ETH
    const maker = new ethers.Wallet(randomHex(32), provider);
    const maker2 = new ethers.Wallet(randomHex(32), provider);
    const taker = new ethers.Wallet(randomHex(32), provider);
    const taker2 = new ethers.Wallet(randomHex(32), provider);
    const member = new ethers.Wallet(randomHex(32), provider);
    const feeReciver = new ethers.Wallet(randomHex(32), provider);
    await marketplaceContract.connect(owner).addMember(member.address);
    for (const wallet of [maker, maker2, taker, taker2, member]) {
      await faucet(wallet.address, provider);
      await mintAndApproveERC20_2(testERC20, wallet, marketplaceContract.address, parseEther("100"));
      await mintAndApproveERC20_2(testERC20_2, wallet, marketplaceContract.address, parseEther("100"));
    }

    return { maker, maker2, taker, taker2, member, feeReciver };
  }
  const fufillments = [
    { offerComponents: [{ orderIndex: 0, itemIndex: 0 }], considerationComponents: [{ orderIndex: 1, itemIndex: 0 }] },
    { offerComponents: [{ orderIndex: 1, itemIndex: 0 }], considerationComponents: [{ orderIndex: 0, itemIndex: 0 }] },
  ];
  const fufillmentsFeeList = [
    ...fufillments,
    { offerComponents: [{ orderIndex: 1, itemIndex: 0 }], considerationComponents: [{ orderIndex: 0, itemIndex: 1 }] },
  ];
  const fufillmentsFeeBid = [
    ...fufillments,
    { offerComponents: [{ orderIndex: 0, itemIndex: 0 }], considerationComponents: [{ orderIndex: 1, itemIndex: 1 }] },
  ];
  beforeEach(async () => {
    ({ maker, maker2, taker, taker2, member, feeReciver } = await loadFixture(setupFixture));
  });

  it("Cancel prepare work", async () => {
    // maker
    const makerOrder = await createOrder(
      maker,
      ethers.constants.AddressZero,
      [getTestItem20(parseEther("8"), parseEther("8"), undefined, testERC20_2.address)],
      [getTestItem20(parseEther("8"), parseEther("10"), maker.address, testERC20.address)],
      0
    );
    // taker
    const takerOrder = await createOrder(
      taker,
      ethers.constants.AddressZero,
      [getTestItem20(parseEther("8"), parseEther("10"), undefined, testERC20.address)],
      [getTestItem20(parseEther("8"), parseEther("8"), taker.address, testERC20_2.address)],
      0
    );
    const reqIdOrNumWords = 1;
    // backend
    await marketplaceContract.connect(member).prepare([makerOrder.order, takerOrder.order], [], [], reqIdOrNumWords);
    await time.increase(time.duration.hours(3))
    await expect(marketplaceContract.connect(maker).cancelPrepared(reqIdOrNumWords, [makerOrder.order, takerOrder.order]))
      .changeTokenBalance(testERC20_2, maker.address, parseEther("8"))
      .changeTokenBalance(testERC20, taker.address, parseEther("10"));
  });
  it("Cancel prepare need last orders", async () => {
    // maker
    const makerOrder = await createOrder(
      maker,
      ethers.constants.AddressZero,
      [getTestItem20(parseEther("8"), parseEther("8"), undefined, testERC20_2.address)],
      [getTestItem20(parseEther("8"), parseEther("10"), maker.address, testERC20.address)],
      0
    );
    // taker
    const takerOrder = await createOrder(
      taker,
      ethers.constants.AddressZero,
      [getTestItem20(parseEther("8"), parseEther("10"), undefined, testERC20.address)],
      [getTestItem20(parseEther("8"), parseEther("8"), taker.address, testERC20_2.address)],
      0
    );
    const reqIdOrNumWords = 1;
    // backend
    await marketplaceContract.connect(member).prepare([makerOrder.order, takerOrder.order], [], [], reqIdOrNumWords);
    await time.increase(time.duration.hours(3))
    await expect(marketplaceContract.connect(maker).cancelPrepared(reqIdOrNumWords, [takerOrder.order, makerOrder.order])).revertedWith(
      "Order hash not match"
    );
  });
});
