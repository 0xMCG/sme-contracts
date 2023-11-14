import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers, network } from "hardhat";

import { randomHex, toBN } from "./utils/encoding";
import { faucet } from "./utils/faucet";
import { seaportFixture } from "./utils/fixtures";
import { VERSION } from "./utils/helpers";

import { BigNumberish, type Wallet } from "ethers";
import { formatEther } from "ethers/lib/utils";
import type {
  ConduitControllerInterface,
  ConduitInterface,
  Conduit__factory,
  Consideration,
  ConsiderationInterface,
  TestERC1155,
  TestERC20,
  TestERC721,
} from "../typechain-types";
import type { SeaportFixtures } from "./utils/fixtures";

const { parseEther } = ethers.utils;

describe(`Mathch tests (Seaport v${VERSION})`, function () {
  const { provider } = ethers;
  const owner = new ethers.Wallet(randomHex(32), provider);

  let conduitController: ConduitControllerInterface;
  let conduitImplementation: Conduit__factory;
  let conduitKeyOne: string;
  let conduitOne: ConduitInterface;
  let marketplaceContract: ConsiderationInterface;
  let testERC1155: TestERC1155;
  let testERC1155Two: TestERC1155;
  let testERC20: TestERC20;
  let testERC721: TestERC721;

  let createMirrorBuyNowOrder: SeaportFixtures["createMirrorBuyNowOrder"];
  let createOrder: SeaportFixtures["createOrder"];
  let createTransferWithApproval: SeaportFixtures["createTransferWithApproval"];
  let deployNewConduit: SeaportFixtures["deployNewConduit"];
  let getTestItem1155: SeaportFixtures["getTestItem1155"];
  let mint1155: SeaportFixtures["mint1155"];
  let mint721: SeaportFixtures["mint721"];
  let mintAndApproveERC20: SeaportFixtures["mintAndApproveERC20"];
  let set1155ApprovalForAll: SeaportFixtures["set1155ApprovalForAll"];
  let set721ApprovalForAll: SeaportFixtures["set721ApprovalForAll"];
  let getTestItem20: SeaportFixtures["getTestItem20"];

  after(async () => {
    await network.provider.request({
      method: "hardhat_reset",
    });
  });

  before(async () => {
    await faucet(owner.address, provider);

    ({
      conduitController,
      conduitImplementation,
      conduitKeyOne,
      conduitOne,
      createMirrorBuyNowOrder,
      createOrder,
      createTransferWithApproval,
      deployNewConduit,
      getTestItem1155,
      marketplaceContract,
      mint1155,
      mint721,
      mintAndApproveERC20,
      set1155ApprovalForAll,
      set721ApprovalForAll,
      testERC1155,
      testERC1155Two,
      testERC20,
      testERC721,
      getTestItem20,
    } = await seaportFixture(owner));
  });

  let seller: Wallet;
  let buyer: Wallet;
  let member: Wallet;

  let tempConduit: ConduitInterface;

  async function setupFixture() {
    // Setup basic buyer/seller wallets with ETH
    const seller = new ethers.Wallet(randomHex(32), provider);
    const buyer = new ethers.Wallet(randomHex(32), provider);
    const member = new ethers.Wallet(randomHex(32), provider);
    await (marketplaceContract as unknown as Consideration)
      .connect(owner)
      .addMember(member.address);
    // Deploy a new conduit
    const tempConduit = await deployNewConduit(owner);

    for (const wallet of [seller, buyer, member]) {
      await faucet(wallet.address, provider);
    }

    return { seller, buyer, member, tempConduit };
  }

  beforeEach(async () => {
    ({ seller, buyer, member, tempConduit } = await loadFixture(setupFixture));
  });

  async function log20Balance(name: string, address: string) {
    console.info(`${name}:`, formatEther(await testERC20.balanceOf(address)));
  }
  async function log1155Balance(
    name: string,
    address: string,
    id: BigNumberish
  ) {
    console.info(
      `${name}:`,
      (await testERC1155.balanceOf(address, id)).toString()
    );
  }
  it("Full order match", async () => {
    // seller
    const { nftId, amount } = await mint1155(seller);
    await set1155ApprovalForAll(seller, marketplaceContract.address);
    const sellerOrder = await createOrder(
      seller,
      member,
      [getTestItem1155(nftId, 1, 1)],
      [getTestItem20(parseEther("8"), parseEther("10"), seller.address)],
      0
    );

    // buyer
    await mintAndApproveERC20(
      buyer,
      marketplaceContract.address,
      parseEther("100")
    );
    const buyerOrder = await createOrder(
      buyer,
      member,
      [getTestItem20(parseEther("7"), parseEther("9.5"))],
      [getTestItem1155(nftId, 1, 1, testERC1155.address, buyer.address)],
      0
    );
    const reqIdOrNumWords = 1;
    // backend
    await marketplaceContract
      .connect(member)
      .prepare([sellerOrder.order, buyerOrder.order], [], [], reqIdOrNumWords);

    const fufillments = [
      {
        offerComponents: [{ orderIndex: 0, itemIndex: 0 }],
        considerationComponents: [{ orderIndex: 1, itemIndex: 0 }],
      },
      {
        offerComponents: [{ orderIndex: 1, itemIndex: 0 }],
        considerationComponents: [{ orderIndex: 0, itemIndex: 0 }],
      },
    ];

    await expect(
      marketplaceContract
        .connect(member)
        .matchOrdersWithRandom(
          [sellerOrder.order, buyerOrder.order],
          fufillments,
          reqIdOrNumWords,
          [{ orderHash: sellerOrder.orderHash, numerator: 1, denominator: 2 }]
        )
    ).to.changeTokenBalances(
      testERC20,
      [seller.address, buyer.address],
      [parseEther("9"), parseEther("0.5")]
    );
    expect(
      await testERC1155
        .balanceOf(seller.address, nftId)
        .then((b) => b.toString())
    ).to.be.eq(amount.sub(1).toString());
    expect(
      await testERC1155
        .balanceOf(buyer.address, nftId)
        .then((b) => b.toString())
    ).to.be.eq("1");
  });

  it("Partial order match listing", async () => {
    // seller
    const { nftId, amount } = await mint1155(seller);
    await set1155ApprovalForAll(seller, marketplaceContract.address);
    const sellerOrder = await createOrder(
      seller,
      ethers.constants.AddressZero,
      [getTestItem1155(nftId, 2, 2)],
      [getTestItem20(parseEther("16"), parseEther("20"), seller.address)],
      1 // Partial open
    );

    // buyer
    await mintAndApproveERC20(
      buyer,
      marketplaceContract.address,
      parseEther("100")
    );
    const buyerOrder = await createOrder(
      buyer,
      ethers.constants.AddressZero,
      [getTestItem20(parseEther("7"), parseEther("9.5"))],
      [getTestItem1155(nftId, 1, 1, testERC1155.address, buyer.address)],
      0
    );

    // backend
    sellerOrder.order.numerator = 1; // partial 分子
    sellerOrder.order.denominator = 2; // partial 分母
    const reqIdOrNumWords = 2;
    await marketplaceContract
      .connect(member)
      .prepare([sellerOrder.order, buyerOrder.order], [], [], reqIdOrNumWords);

    const fufillments = [
      {
        offerComponents: [{ orderIndex: 0, itemIndex: 0 }],
        considerationComponents: [{ orderIndex: 1, itemIndex: 0 }],
      },
      {
        offerComponents: [{ orderIndex: 1, itemIndex: 0 }],
        considerationComponents: [{ orderIndex: 0, itemIndex: 0 }],
      },
    ];
    await expect(
      marketplaceContract
        .connect(member)
        .matchOrdersWithRandom(
          [sellerOrder.order, buyerOrder.order],
          fufillments,
          reqIdOrNumWords,
          [{ orderHash: sellerOrder.orderHash, numerator: 1, denominator: 2 }]
        )
    ).to.changeTokenBalances(
      testERC20,
      [seller.address, buyer.address],
      [parseEther("9"), parseEther("0.5")]
    );
    expect(
      await testERC1155
        .balanceOf(seller.address, nftId)
        .then((b) => b.toString())
    ).to.be.eq(amount.sub(2).toString());
    expect(
      await testERC1155
        .balanceOf(buyer.address, nftId)
        .then((b) => b.toString())
    ).to.be.eq("1");
  });
  it.only("Partial order match bid", async () => {
   
    const { nftId, amount } = await mint1155(buyer); 
    // seller
    await mintAndApproveERC20(
      seller,
      marketplaceContract.address,
      parseEther("100")
    );
    const sellerOrder = await createOrder(
      seller,
      ethers.constants.AddressZero,
      [getTestItem20(parseEther("16"), parseEther("20"))],
      [getTestItem1155(nftId, 2, 2, testERC1155.address, seller.address)],
      1 // Partial open
    );
    // buyer
    await set1155ApprovalForAll(buyer, marketplaceContract.address);
    const buyerOrder = await createOrder(
      buyer,
      ethers.constants.AddressZero,
      [getTestItem1155(nftId, 1, 1, testERC1155.address)],
      [getTestItem20(parseEther("8.8"), parseEther("9.2"), buyer.address)],
      0
    );
    // backend
    sellerOrder.order.numerator = 1; // partial 分子
    sellerOrder.order.denominator = 2; // partial 分母
    const reqIdOrNumWords = 2;
    await marketplaceContract
      .connect(member)
      .prepare([sellerOrder.order, buyerOrder.order], [], [], reqIdOrNumWords);

    const fufillments = [
      {
        offerComponents: [{ orderIndex: 0, itemIndex: 0 }],
        considerationComponents: [{ orderIndex: 1, itemIndex: 0 }],
      },
      {
        offerComponents: [{ orderIndex: 1, itemIndex: 0 }],
        considerationComponents: [{ orderIndex: 0, itemIndex: 0 }],
      },
    ];
    await expect(
      marketplaceContract
        .connect(member)
        .matchOrdersWithRandom(
          [sellerOrder.order, buyerOrder.order],
          fufillments,
          reqIdOrNumWords,
          [{ orderHash: buyerOrder.orderHash, numerator: 1, denominator: 2 }]
        )
    ).to.changeTokenBalances(
      testERC20,
      [buyer.address, seller.address],
      [parseEther("9"), parseEther("1")]
    );
    expect(
      await testERC1155
        .balanceOf(buyer.address, nftId)
        .then((b) => b.toString())
    ).to.be.eq(amount.sub(1).toString());
    expect(
      await testERC1155
        .balanceOf(seller.address, nftId)
        .then((b) => b.toString())
    ).to.be.eq("1");
  });

  it("Zero assets match", async () => {
    // seller
    const { nftId, amount } = await mint1155(seller);
    await set1155ApprovalForAll(seller, marketplaceContract.address);
    const Zero = toBN("0");
    const sellerOrder = await createOrder(
      seller,
      member,
      [getTestItem1155(nftId, 1, 1)],
      [getTestItem20(Zero, parseEther("10"), seller.address)],
      0
    );

    // buyer
    await mintAndApproveERC20(
      buyer,
      marketplaceContract.address,
      parseEther("100")
    );
    const buyerOrder = await createOrder(
      buyer,
      member,
      [getTestItem20(Zero, parseEther("9.5"))],
      [getTestItem1155(nftId, 1, 1, testERC1155.address, buyer.address)],
      0
    );
    const reqIdOrNumWords = 1;
    // backend
    await marketplaceContract
      .connect(member)
      .prepare([sellerOrder.order, buyerOrder.order], [], [], reqIdOrNumWords);

    const fufillments = [
      {
        offerComponents: [{ orderIndex: 0, itemIndex: 0 }],
        considerationComponents: [{ orderIndex: 1, itemIndex: 0 }],
      },
      {
        offerComponents: [{ orderIndex: 1, itemIndex: 0 }],
        considerationComponents: [{ orderIndex: 0, itemIndex: 0 }],
      },
    ];

    await expect(
      marketplaceContract
        .connect(member)
        .matchOrdersWithRandom(
          [sellerOrder.order, buyerOrder.order],
          fufillments,
          reqIdOrNumWords,
          [{ orderHash: sellerOrder.orderHash, numerator: 0, denominator: 2 }]
        )
    ).to.changeTokenBalances(
      testERC20,
      [seller.address, buyer.address],
      [Zero, parseEther('9.5')]
    );
    expect(
      await testERC1155
        .balanceOf(seller.address, nftId)
        .then((b) => b.toString())
    ).to.be.eq(amount.sub(1).toString());
    expect(
      await testERC1155
        .balanceOf(buyer.address, nftId)
        .then((b) => b.toString())
    ).to.be.eq("1");
  });
});
