import { BigNumberish } from "ethers";
import { ethers, network } from "hardhat";
import { getJson, writeJson } from "./json";
const json = getJson();

async function deployUseCreate2(
  name: string,
  salt: string,
  typeargs: any[] = []
) {
  const AddCreate2 = "0x0000000000FFe8B47B3e2130213B802212439497";
  const immutableCreate2 = await ethers.getContractAt(
    "ImmutableCreate2FactoryInterface",
    AddCreate2
  );
  let initCode = "";
  const factory = await ethers.getContractFactory(name);
  if (typeargs.length) {
    const encodeArgs = ethers.utils.defaultAbiCoder.encode(
      typeargs.slice(0, typeargs.length / 2),
      typeargs.slice(typeargs.length / 2)
    );
    initCode = ethers.utils.solidityPack(
      ["bytes", "bytes"],
      [factory.bytecode, encodeArgs]
    );
  } else {
    initCode = factory.bytecode;
  }
  if (!initCode) throw "Error";
  const address = ethers.utils.getCreate2Address(
    AddCreate2,
    salt,
    ethers.utils.keccak256(ethers.utils.hexlify(initCode))
  );
  const deployed = await immutableCreate2.hasBeenDeployed(address);
  if (deployed) {
    console.info("already-deployd:", name, address);
  } else {
    const tx = await immutableCreate2.safeCreate2(salt, initCode);
    await tx.wait(1);
    console.info("deplyed:", name, address);
  }
  json[name] = { address, salt, initCode };
  writeJson(json);
  return address;
}

const VRFConfig: {
  [k: string]: { coor: string; subId: BigNumberish; keyHash: string };
} = {
  arb_goerli: {
    coor: "0x6D80646bEAdd07cE68cab36c27c626790bBcf17f",
    subId: 236,
    keyHash:
      "0x83d1b6e3388bed3d76426974512bb0d270e9542a765cd667242ea26c0cc0b730",
  },
  // arb: {
  //   coor: "0x41034678D6C633D8a95c75e1138A360a28bA15d1",
  //   subId: 36,
  //   keyHash:
  //     "0x08ba8f62ff6c40a58877a106147661db43bc58dabfb814793847a839aa03367f",
  // },
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
  const seaportAddress = await deployUseCreate2(
    "Seaport",
    "0x0000000000000000000000000000000000000000d4b6fcc21169b803f25d5559",
    ["address", conduitControllerAddress]
  );

  // VRFConsumer
  if (!VRFConfig[network.name]) throw "Network not support!";
  const config = VRFConfig[network.name];
  const vrfAddress = await deployUseCreate2(
    "VRFConsumerV2",
    "0x0000000000000000000000000000000000000000d4b6fcc21169b803f25d2222",
    ["uint64", "address", "bytes32", config.subId, config.coor, config.keyHash]
  );

  // createConduit
  const lcc = await ethers.getContractAt(
    "LocalConduitController",
    conduitControllerAddress
  );
  const conduitKey = `${owner.address}aaaaaaaaaaaaaaaaaaaaaaaa`;
  let conduit = await lcc.getConduit(conduitKey);
  if (!conduit.exists) {
    const tx = await lcc.createConduit(conduitKey, owner.address, {
      gasLimit: 1000000,
    });
    await tx.wait(1);
    conduit = await lcc.getConduit(conduitKey);
    console.info("created conduit:", conduit.conduit);
  } else {
    console.info("already created conduit:", conduit.conduit);
  }
  json["Conduit"] = conduit;
  writeJson(json);

  // updateChannel
  let chennels = await lcc.getChannels(conduit.conduit);
  if (!chennels.find((item) => item === seaportAddress)) {
    await lcc
      .updateChannel(conduit.conduit, seaportAddress, true)
      .then((tx) => tx.wait(1));
    chennels = await lcc.getChannels(conduit.conduit);
  }
  console.info("updated channel:", chennels);

  // addMember
  const seaport = await ethers.getContractAt("Seaport", seaportAddress);
  await seaport
    .addMember("0x28c73A60ccF8c66c14EbA8935984e616Df2926e3", {
      gasLimit: 1000000,
    })
    .then((tx) => tx.wait(1));
  console.info("added members");

  // updateVRF
  const oldVrf = await seaport.vrfOwner();
  if (oldVrf !== vrfAddress)
    await seaport.updateVRFAddress(vrfAddress).then((tx) => tx.wait(1));
  console.info("updated vrf");
}
main();
