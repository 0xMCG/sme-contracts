import { readFileSync, writeFileSync } from "fs";
import { ethers, network } from "hardhat";

export type DeployedVerifyJson = { [k: string]: any };
export function getJson(): DeployedVerifyJson {
  const json = readFileSync("./json/" + network.name + ".json", "utf-8");
  const dto = JSON.parse(json || "{}") as any;
  return dto;
}

export function writeJson(dto: DeployedVerifyJson) {
  writeFileSync("./json/" + network.name + ".json", JSON.stringify(dto, undefined, 2));
}

export function saveAny(dto: DeployedVerifyJson) {
  const old = getJson() || {};
  const nDto = { ...old, ...dto };
  writeJson(nDto);
}

export async function deployContract(name: string, args: any[]) {
  const old = getJson()[name];
  const Factory = await ethers.getContractFactory(name);
  if (!old?.address) {
    const Contract = await Factory.deploy(...args);
    await Contract.deployed();
    saveAny({ [name]: { address: Contract.address } });
    console.info("deployed:", name, Contract.address);
    return Contract.address;
  } else {
    console.info("allredy deployed:", name, old.address);
    return old.address as string;
  }
}

export async function deployUseCreate2(name: string, salt: string, typeargs: any[] = []) {
  const AddCreate2 = "0x0000000000FFe8B47B3e2130213B802212439497";
  const immutableCreate2 = await ethers.getContractAt("ImmutableCreate2FactoryInterface", AddCreate2);
  let initCode = "";
  const factory = await ethers.getContractFactory(name);
  if (typeargs.length) {
    const encodeArgs = ethers.utils.defaultAbiCoder.encode(typeargs.slice(0, typeargs.length / 2), typeargs.slice(typeargs.length / 2));
    initCode = ethers.utils.solidityPack(["bytes", "bytes"], [factory.bytecode, encodeArgs]);
  } else {
    initCode = factory.bytecode;
  }
  if (!initCode) throw "Error";
  const address = ethers.utils.getCreate2Address(AddCreate2, salt, ethers.utils.keccak256(ethers.utils.hexlify(initCode)));
  const deployed = await immutableCreate2.hasBeenDeployed(address);
  if (deployed) {
    console.info("already-deployd:", name, address);
  } else {
    const tx = await immutableCreate2.safeCreate2(salt, initCode);
    await tx.wait(1);
    console.info("deplyed:", name, address);
  }
  saveAny({ [name]: { address, salt } });
  return address;
}
