import { BigNumberish } from "ethers";
import { ethers, network } from "hardhat";
import { deployContract, deployUseCreate2, saveAny } from "./hutils";
import { parseEther } from "ethers/lib/utils";

const VRFConfig: {
  [k: string]: { coor: string; subId: BigNumberish; keyHash: string };
} = {
  sepolia: {
    coor: "0x8103B0A8A00be2DDC778e6e7eaa21791Cd364625",
    subId: 7066,
    keyHash: "0x474e34a077df58807dbe9c96d3c009b23b3c6d0cce433e59bbf5b34f823bc56c",
  },
  arb_sepolia: {
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
  sepolia: "0x7ddBFF9D74D0A2F33Dfb13cEC538B334f2011462",
  arb_sepolia: "0x0da3C82d0785ad289Be2Cb6cE7382a879E72d18b",
};

async function main() {
  const owner = (await ethers.getSigners())[0];
  if (!owner) throw "No signers";
  // ConduitController
  const conduitControllerAddress = await deployUseCreate2(
    "LocalConduitController",
    "0x0000000000000000000000000000000000000000d4b6fcc21169b803f25d1111"
  );
  // Seaport
  const seaportAddress = await deployUseCreate2("Seaport", "0x0000000000000000000000000000000000000000d4b6fcc21169b803f25d5559", [
    "address",
    conduitControllerAddress,
  ]);
  const seaport = await ethers.getContractAt("Seaport", seaportAddress);

  // VRFConsumer
  if (!VRFConfig[network.name]) throw "Network not support!";
  const config = VRFConfig[network.name];
  const vrfAddress = await deployUseCreate2("VRFConsumerV2", "0x0000000000000000000000000000000000000000d4b6fcc21169b803f25d2222", [
    "uint64",
    "address",
    "bytes32",
    config.subId,
    config.coor,
    config.keyHash,
  ]);

  // SmeGasManager
  const smeGasManagerAddress = await deployContract("SmeGasManager", [parseEther("0.0001").toString()]);

  // createConduit
  const lcc = await ethers.getContractAt("LocalConduitController", conduitControllerAddress);
  const conduitKey = `${owner.address}aaaaaaaaaaaaaaaaaaaaaaaa`;
  saveAny({ ConduitKey: conduitKey });
  let conduit = await lcc.getConduit(conduitKey);
  if (!conduit.exists) {
    const tx = await lcc.createConduit(conduitKey, owner.address, {
      gasLimit: 2000000,
    });
    await tx.wait(1);
    conduit = await lcc.getConduit(conduitKey);
    console.info("created conduit:", conduit.conduit);
  } else {
    console.info("already created conduit:", conduit.conduit);
  }
  saveAny({ Conduit: conduit });

  // updateChannel
  let chennels = await lcc.getChannels(conduit.conduit);
  if (!chennels.find((item) => item === seaportAddress)) {
    await lcc.updateChannel(conduit.conduit, seaportAddress, true).then((tx) => tx.wait(1));
    chennels = await lcc.getChannels(conduit.conduit);
  }
  console.info("updated channel:", chennels);

  // setMember;
  if (MemberConfig[network.name]) {
    await seaport.addMember(MemberConfig[network.name], { gasLimit: 2000000 }).then((tx) => tx.wait(1));
    console.info("added members");
  }

  // updateVRF
  const oldVrf = await seaport.vrfOwner();
  if (oldVrf !== vrfAddress) await seaport.updateVRFAddress(vrfAddress).then((tx) => tx.wait(1));
  console.info("updated vrf");
}
main();
