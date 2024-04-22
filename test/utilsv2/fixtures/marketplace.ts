import { expect } from "chai";
import { constants } from "ethers";
import { keccak256, recoverAddress } from "ethers/lib/utils";
import hre, { ethers } from "hardhat";

import { deployContract } from "../contracts";
import { getBulkOrderTree } from "../eip712/bulk-orders";
import { calculateOrderHash, convertSignatureToEIP2098, randomHex, toBN } from "../encoding";
import { VERSION } from "../helpers";

import type { Contract, Wallet } from "ethers";
import type { ImmutableCreate2FactoryInterface, SmeMarket, TestVRF } from "../../../typechain-types";
import type { ConsiderationItem, CriteriaResolver, OfferItem, OrderComponents } from "../types";

const deployConstants = require("../../../constants/constants");
// const { bulkOrderType } = require("../../../eip-712-types/bulkOrder");
const { orderType } = require("../../../eip-712-types/order");

export const marketplaceFixture = async (create2Factory: ImmutableCreate2FactoryInterface, chainId: number, owner: Wallet) => {
  // Deploy marketplace contract through efficient create2 factory
  const marketplaceContractFactory = await ethers.getContractFactory("SmeMarket");

  const marketplaceContractAddress = await create2Factory.findCreate2Address(
    deployConstants.MARKETPLACE_CONTRACT_CREATION_SALT,
    marketplaceContractFactory.bytecode
  );

  let { gasLimit } = await ethers.provider.getBlock("latest");

  if ((hre as any).__SOLIDITY_COVERAGE_RUNNING) {
    gasLimit = ethers.BigNumber.from(300_000_000);
  }

  await create2Factory.safeCreate2(deployConstants.MARKETPLACE_CONTRACT_CREATION_SALT, marketplaceContractFactory.bytecode, {
    gasLimit,
  });

  const marketplaceContract = (await ethers.getContractAt("SmeMarket", marketplaceContractAddress, owner)) as SmeMarket;

  // setTestVRF

  const market = marketplaceContract;
  const testVRF = await deployContract<TestVRF>("TestVRF", owner);
  await market.connect(owner).updateVRFAddress(testVRF.address);

  // Required for EIP712 signing
  const domainData = {
    name: "SmeMarket",
    version: VERSION,
    chainId,
    verifyingContract: marketplaceContract.address,
  };

  const getAndVerifyOrderHash = async (orderComponents: OrderComponents) => {
    const orderHash = await marketplaceContract.getOrderHash(orderComponents);
    const derivedOrderHash = calculateOrderHash(orderComponents);
    expect(orderHash).to.equal(derivedOrderHash);
    return orderHash;
  };

  // Returns signature
  const signOrder = async (orderComponents: OrderComponents, signer: Wallet | Contract, marketplace = marketplaceContract) => {
    const signature = await signer._signTypedData({ ...domainData, verifyingContract: marketplace.address }, orderType, orderComponents);

    const orderHash = await getAndVerifyOrderHash(orderComponents);

    const { domainSeparator } = await marketplace.information();
    const digest = keccak256(`0x1901${domainSeparator.slice(2)}${orderHash.slice(2)}`);
    const recoveredAddress = recoverAddress(digest, signature);

    expect(recoveredAddress).to.equal(signer.address);

    return signature;
  };

  const createOrder = async (
    offerer: Wallet | Contract,
    offer: OfferItem[],
    consideration: ConsiderationItem[],
    orderType: number,
    timeFlag?: string | null,
    signer?: Wallet,
    extraCheap = false,
    useBulkSignature = false,
    bulkSignatureIndex?: number,
    bulkSignatureHeight?: number,
    marketplace = marketplaceContract
  ) => {
    const counter = await marketplace.getCounter(offerer.address);

    const salt =  '0x8460862738';
    // const salt =  !extraCheap ? randomHex() : constants.HashZero;
    const startTime = timeFlag !== "NOT_STARTED" ? 0 : toBN("0xee00000000000000000000000000");
    const endTime = timeFlag !== "EXPIRED" ? toBN("0xff00000000000000000000000000") : 1;

    const orderParameters = {
      offerer: offerer.address,
      // zone: constants.AddressZero,
      offer,
      consideration,
      totalOriginalConsiderationItems: consideration.length,
      orderType,
      // zoneHash,
      salt,
      // conduitKey,
      startTime,
      endTime,
    };

    const orderComponents = {
      ...orderParameters,
      counter,
    };

    const orderHash = await getAndVerifyOrderHash(orderComponents);

    const { isValidated, isCancelled, totalFilled, totalSize } = await marketplace.getOrderStatus(orderHash);

    expect(isCancelled).to.equal(false);

    const orderStatus = {
      isValidated,
      isCancelled,
      totalFilled,
      totalSize,
    };

    const flatSig = await signOrder(orderComponents, signer ?? offerer, marketplace);

    const order = {
      parameters: orderParameters,
      signature: !extraCheap ? flatSig : convertSignatureToEIP2098(flatSig),
      numerator: 1, // only used for advanced orders
      denominator: 1, // only used for advanced orders
      extraData: "0x", // only used for advanced orders
    };

    // How much ether (at most) needs to be supplied when fulfilling the order
    const value = offer
      .map((x) => (x.itemType === 0 ? (x.endAmount.gt(x.startAmount) ? x.endAmount : x.startAmount) : toBN(0)))
      .reduce((a, b) => a.add(b), toBN(0))
      .add(
        consideration
          .map((x) => (x.itemType === 0 ? (x.endAmount.gt(x.startAmount) ? x.endAmount : x.startAmount) : toBN(0)))
          .reduce((a, b) => a.add(b), toBN(0))
      );

    return {
      order,
      orderHash,
      value,
      orderStatus,
      orderComponents,
      startTime,
      endTime,
    };
  };

  return {
    marketplaceContract,
    domainData,
    signOrder,
   
    createOrder,
  };
};
