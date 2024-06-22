import { BigNumberish } from "ethers";
import { ethers, network } from "hardhat";
import { deployContract, deployUseCreate2, saveAny, wait1Tx } from "./hutils";
import { parseEther } from "ethers/lib/utils";

const VRFConfig: {
  [k: string]: { coor: string; subId: BigNumberish; keyHash: string };
} = {
  sepolia: {
    coor: "0x9DdfaCa8183c41ad55329BdeeD9F6A8d53168B1B",
    subId: "88287894418893955350156106731922667574706298581066323091458404590883695184525",
    keyHash: "0x787d74caea10b2b357790d5b5247c2f63d1d91572a9846f780606e4d953677ae",
  },
  arbitrum_sepolia: {
    coor: "0x50d47e4142598E3411aA864e08a44284e471AC6f",
    subId: 36,
    keyHash: "0x027f94ff1465b3525f9fc03e9ff7d6d2c0953482246dd6ae07570c45d6631414",
  },
  arb: {
    coor: "0x41034678D6C633D8a95c75e1138A360a28bA15d1",
    subId: 126,
    keyHash: "0x72d2b016bb5b62912afea355ebf33b91319f828738b111b723b78696b9847b63",
  },
};

const MemberConfig: { [k: string]: string } = {
  sepolia: "0x7a9b890aEC794B8EFfdCd6b743A6A3AF950e99F9",
  arb_sepolia: "0x7a9b890aEC794B8EFfdCd6b743A6A3AF950e99F9",
  arbitrum_sepolia: "0x7a9b890aEC794B8EFfdCd6b743A6A3AF950e99F9",
};

async function main() {
  const owner = (await ethers.getSigners())[0];
  if (!owner) throw "No signers";

  // Market
  const marketAddress = await deployUseCreate2("SmeMarket", "0x0000000000000000000000000000000000000000d4b6fcc21169b803f25d2337");
  const market = await ethers.getContractAt("SmeMarket", marketAddress);

  // VRFConsumer
  if (!VRFConfig[network.name]) throw "Network not support!";
  const config = VRFConfig[network.name];
  const vrfAddress = await deployUseCreate2("VRFConsumerV2", "0x0000000000000000000000000000000000000000d4b6fcc21169b803f25d2337", [
    "uint64",
    "address",
    "bytes32",
    config.subId,
    config.coor,
    config.keyHash,
  ]);
  const vrf = await ethers.getContractAt("VRFConsumerV2", vrfAddress);
  const roleMarket = await vrf.MARKET();
  console.log("roleMarket");
  console.log(roleMarket);
  if (!(await vrf.hasRole(roleMarket, marketAddress))) {
    await vrf.connect(owner).grantRole(roleMarket, marketAddress, { gasLimit: 2000000 }).then(wait1Tx);
  }

  // SmeGasManager
  const smeGasManagerAddress = await deployContract("SmeGasManager", [parseEther("0.0001").toString()]);

  // setMember;
  if (MemberConfig[network.name]) {
    await market.addMember(MemberConfig[network.name], { gasLimit: 2000000 }).then(wait1Tx);
    console.info("added members");
  }

  // updateVRF
  const oldVrf = await market.vrfOwner();
  if (oldVrf !== vrfAddress) await market.updateVRFAddress(vrfAddress).then(wait1Tx);
  console.info("updated vrf");
}
main();
