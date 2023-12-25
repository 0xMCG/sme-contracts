import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers, network } from "hardhat";

import { getItemETH, randomHex, toAddress } from "./utils/encoding";
import { decodeEvents } from "./utils/events";
import { faucet } from "./utils/faucet";
import { seaportFixture } from "./utils/fixtures";
import { VERSION } from "./utils/helpers";

import type { Contract, Wallet } from "ethers";
import type { ConsiderationInterface, TestERC721, TestZone } from "../typechain-types";
import type { SeaportFixtures } from "./utils/fixtures";

const { parseEther } = ethers.utils;

describe(`Zone - PausableZone (Seaport v${VERSION})`, function () {
  const { provider } = ethers;
  const owner = new ethers.Wallet(randomHex(32), provider);

  let marketplaceContract: ConsiderationInterface;
  let stubZone: TestZone;
  let testERC721: TestERC721;

  let checkExpectedEvents: SeaportFixtures["checkExpectedEvents"];
  let createOrder: SeaportFixtures["createOrder"];
  let getTestItem721: SeaportFixtures["getTestItem721"];
  let getTestItem721WithCriteria: SeaportFixtures["getTestItem721WithCriteria"];
  let mintAndApprove721: SeaportFixtures["mintAndApprove721"];
  let withBalanceChecks: SeaportFixtures["withBalanceChecks"];

  after(async () => {
    await network.provider.request({
      method: "hardhat_reset",
    });
  });

  before(async () => {
    await faucet(owner.address, provider);

    ({
      checkExpectedEvents,
      createOrder,
      getTestItem721,
      getTestItem721WithCriteria,
      marketplaceContract,
      mintAndApprove721,
      stubZone,
      testERC721,
      withBalanceChecks,
    } = await seaportFixture(owner));
  });

  let buyer: Wallet;
  let seller: Wallet;

  async function setupFixture() {
    // Setup basic buyer/seller wallets with ETH
    const seller = new ethers.Wallet(randomHex(32), provider);
    const buyer = new ethers.Wallet(randomHex(32), provider);

    for (const wallet of [seller, buyer]) {
      await faucet(wallet.address, provider);
    }

    return { seller, buyer };
  }

  beforeEach(async () => {
    ({ seller, buyer } = await loadFixture(setupFixture));
  });

  /** Create zone and get zone address */
  async function createZone(pausableZoneController: Contract, salt?: string) {
    const tx = await pausableZoneController.createZone(salt ?? randomHex());

    const zoneContract = await ethers.getContractFactory("PausableZone", owner);

    const events = await decodeEvents(tx, [
      { eventName: "ZoneCreated", contract: pausableZoneController },
      { eventName: "Unpaused", contract: zoneContract as any },
    ]);
    expect(events.length).to.be.equal(2);

    const [unpauseEvent, zoneCreatedEvent] = events;
    expect(unpauseEvent.eventName).to.equal("Unpaused");
    expect(zoneCreatedEvent.eventName).to.equal("ZoneCreated");

    return zoneCreatedEvent.data.zone as string;
  }

  it("Only the deployer owner can create a zone", async () => {
    const pausableZoneControllerFactory = await ethers.getContractFactory("PausableZoneController", owner);

    const pausableZoneController = await pausableZoneControllerFactory.deploy(owner.address);

    // deploy pausable zone from non-deployer owner
    const salt = randomHex();
    await expect(pausableZoneController.connect(seller).createZone(salt)).to.be.revertedWithCustomError(
      pausableZoneController,
      "CallerIsNotOwner"
    );

    // deploy pausable zone from owner
    await createZone(pausableZoneController);
  });

  it("Assign pauser and self destruct the zone", async () => {
    const pausableZoneControllerFactory = await ethers.getContractFactory("PausableZoneController", owner);
    const pausableZoneController = await pausableZoneControllerFactory.deploy(owner.address);

    const zoneAddr = await createZone(pausableZoneController);

    // Attach to Pausable Zone
    const zoneContract = await ethers.getContractFactory("PausableZone", owner);

    // Attach to zone
    const zone = await zoneContract.attach(zoneAddr);

    // Try to nuke the zone through the deployer before being assigned pauser
    await expect(pausableZoneController.connect(buyer).pause(zoneAddr)).to.be.reverted;

    // Try to nuke the zone directly before being assigned pauser
    await expect(zone.connect(buyer).pause(zoneAddr)).to.be.reverted;

    await expect(pausableZoneController.connect(buyer).assignPauser(seller.address)).to.be.revertedWithCustomError(
      pausableZoneController,
      "CallerIsNotOwner"
    );

    await expect(pausableZoneController.connect(owner).assignPauser(toAddress(0))).to.be.revertedWithCustomError(
      pausableZoneController,
      "PauserCanNotBeSetAsZero"
    );

    // owner assigns the pauser of the zone
    await pausableZoneController.connect(owner).assignPauser(buyer.address);

    // Check pauser owner
    expect(await pausableZoneController.pauser()).to.equal(buyer.address);

    // Now as pauser, nuke the zone
    const tx = await pausableZoneController.connect(buyer).pause(zoneAddr);

    // Check paused event was emitted
    const pauseEvents = await decodeEvents(tx, [{ eventName: "Paused", contract: zoneContract as any }]);
    expect(pauseEvents.length).to.equal(1);
  });

  it("Revert on deploying a zone with the same salt", async () => {
    const pausableZoneControllerFactory = await ethers.getContractFactory("PausableZoneController", owner);
    const pausableZoneController = await pausableZoneControllerFactory.deploy(owner.address);

    const salt = randomHex();

    // Create zone with salt
    await pausableZoneController.createZone(salt);

    // Create zone with same salt
    await expect(pausableZoneController.createZone(salt)).to.be.revertedWithCustomError(pausableZoneController, "ZoneAlreadyExists");
  });

  it("Reverts if non-owner tries to self destruct the zone", async () => {
    const pausableZoneControllerFactory = await ethers.getContractFactory("PausableZoneController", owner);
    const pausableZoneController = await pausableZoneControllerFactory.deploy(owner.address);

    const zoneAddr = await createZone(pausableZoneController);

    // non owner tries to use pausable deployer to nuke the zone, reverts
    await expect(pausableZoneController.connect(buyer).pause(zoneAddr)).to.be.reverted;
  });

  it("Zone can cancel restricted orders", async () => {
    const pausableZoneControllerFactory = await ethers.getContractFactory("PausableZoneController", owner);
    const pausableZoneController = await pausableZoneControllerFactory.deploy(owner.address);

    // deploy PausableZone
    const zoneAddr = await createZone(pausableZoneController);

    const nftId = await mintAndApprove721(seller, marketplaceContract.address);

    const offer = [getTestItem721(nftId)];

    const consideration = [
      getItemETH(parseEther("10"), parseEther("10"), seller.address),
      getItemETH(parseEther("1"), parseEther("1"), owner.address),
    ];

    const { orderComponents } = await createOrder(
      seller,
      zoneAddr,
      offer,
      consideration,
      2 // FULL_RESTRICTED, zone can execute or cancel
    );

    await expect(
      pausableZoneController.connect(buyer).cancelOrders(zoneAddr, marketplaceContract.address, [orderComponents])
    ).to.be.revertedWithCustomError(pausableZoneController, "CallerIsNotOwner");

    await pausableZoneController.cancelOrders(zoneAddr, marketplaceContract.address, [orderComponents]);
  });

  it("Operator of zone can cancel restricted orders", async () => {
    const pausableZoneControllerFactory = await ethers.getContractFactory("PausableZoneController", owner);
    const pausableZoneController = await pausableZoneControllerFactory.deploy(owner.address);

    // deploy PausableZone
    const zoneAddr = await createZone(pausableZoneController);

    // Attach to PausableZone zone
    const zoneContract = await ethers.getContractFactory("PausableZone", owner);

    // Attach to zone
    const zone = await zoneContract.attach(zoneAddr);

    const nftId = await mintAndApprove721(seller, marketplaceContract.address);

    const offer = [getTestItem721(nftId)];

    const consideration = [
      getItemETH(parseEther("10"), parseEther("10"), seller.address),
      getItemETH(parseEther("1"), parseEther("1"), owner.address),
    ];

    const { orderComponents } = await createOrder(
      seller,
      zoneAddr,
      offer,
      consideration,
      2 // FULL_RESTRICTED, zone can execute or cancel
    );

    // Non operator address should not be allowed to operate the zone
    await expect(zone.connect(seller).cancelOrders(marketplaceContract.address, [orderComponents])).to.be.reverted;

    // Approve operator
    await pausableZoneController.connect(owner).assignOperator(zoneAddr, seller.address);

    // Now allowed to operate the zone
    await zone.connect(seller).cancelOrders(marketplaceContract.address, [orderComponents]);

    // Cannot assign operator to zero address
    await expect(pausableZoneController.connect(owner).assignOperator(zoneAddr, toAddress(0))).to.be.revertedWithCustomError(
      pausableZoneController,
      "PauserCanNotBeSetAsZero"
    );
  });

  it("Reverts trying to assign operator as non-deployer", async () => {
    const pausableZoneControllerFactory = await ethers.getContractFactory("PausableZoneController", owner);
    const pausableZoneController = await pausableZoneControllerFactory.deploy(owner.address);

    // deploy PausableZone
    const zoneAddr = await createZone(pausableZoneController);

    // Attach to pausable zone
    const zoneContract = await ethers.getContractFactory("PausableZone", owner);

    // Attach to zone
    const zone = await zoneContract.attach(zoneAddr);

    // Try to approve operator without permission
    await expect(pausableZoneController.connect(seller).assignOperator(zoneAddr, seller.address)).to.be.revertedWithCustomError(
      pausableZoneController,
      "CallerIsNotOwner"
    );

    // Try to approve operator directly without permission
    await expect(zone.connect(seller).assignOperator(seller.address)).to.be.reverted;
  });

  it("Reverts if non-Zone tries to cancel restricted orders", async () => {
    const pausableZoneControllerFactory = await ethers.getContractFactory("PausableZoneController", owner);
    const pausableZoneController = await pausableZoneControllerFactory.deploy(owner.address);

    await createZone(pausableZoneController);

    const nftId = await mintAndApprove721(seller, marketplaceContract.address);

    const offer = [getTestItem721(nftId)];

    const consideration = [
      getItemETH(parseEther("10"), parseEther("10"), seller.address),
      getItemETH(parseEther("1"), parseEther("1"), owner.address),
    ];

    const { orderComponents } = await createOrder(
      seller,
      stubZone,
      offer,
      consideration,
      2 // FULL_RESTRICTED
    );

    await expect(marketplaceContract.connect(buyer).cancel([orderComponents])).to.be.reverted;
  });

  it("Reverts if non-owner tries to use the zone to cancel restricted orders", async () => {
    const pausableZoneControllerFactory = await ethers.getContractFactory("PausableZoneController", owner);
    const pausableZoneController = await pausableZoneControllerFactory.deploy(owner.address);

    const zoneAddr = await createZone(pausableZoneController);

    const nftId = await mintAndApprove721(seller, marketplaceContract.address);

    const offer = [getTestItem721(nftId)];

    const consideration = [
      getItemETH(parseEther("10"), parseEther("10"), seller.address),
      getItemETH(parseEther("1"), parseEther("1"), owner.address),
    ];

    const { orderComponents } = await createOrder(
      seller,
      stubZone,
      offer,
      consideration,
      2 // FULL_RESTRICTED
    );

    // buyer calls zone owner to cancel an order through the zone
    await expect(pausableZoneController.connect(buyer).cancelOrders(zoneAddr, marketplaceContract.address, [orderComponents])).to.be
      .reverted;
  });

  it("Lets the Zone Deployer owner transfer ownership via a two-stage process", async () => {
    const pausableZoneControllerFactory = await ethers.getContractFactory("PausableZoneController", owner);
    const pausableZoneController = await pausableZoneControllerFactory.deploy(owner.address);

    await createZone(pausableZoneController);

    await expect(pausableZoneController.connect(buyer).transferOwnership(buyer.address)).to.be.revertedWithCustomError(
      pausableZoneController,
      "CallerIsNotOwner"
    );

    await expect(pausableZoneController.connect(owner).transferOwnership(toAddress(0))).to.be.revertedWithCustomError(
      pausableZoneController,
      "OwnerCanNotBeSetAsZero"
    );

    await expect(pausableZoneController.connect(seller).cancelOwnershipTransfer()).to.be.revertedWithCustomError(
      pausableZoneController,
      "CallerIsNotOwner"
    );

    await expect(pausableZoneController.connect(buyer).acceptOwnership()).to.be.revertedWithCustomError(
      pausableZoneController,
      "CallerIsNotPotentialOwner"
    );

    // just get any random address as the next potential owner.
    await pausableZoneController.connect(owner).transferOwnership(buyer.address);

    // Check potential owner
    expect(await pausableZoneController.potentialOwner()).to.equal(buyer.address);

    await pausableZoneController.connect(owner).cancelOwnershipTransfer();
    await pausableZoneController.connect(owner).transferOwnership(buyer.address);
    await pausableZoneController.connect(buyer).acceptOwnership();

    expect(await pausableZoneController.owner()).to.equal(buyer.address);
  });
});
