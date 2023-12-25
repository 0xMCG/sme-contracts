import { ethers } from "hardhat";
import { getJson } from "./hutils";

async function main() {
  // setMember
  const json = getJson();

  const seaport = await ethers.getContractAt("Seaport", json["Seaport"].address);
  await seaport.addMember("0x7ddBFF9D74D0A2F33Dfb13cEC538B334f2011462").then((tx) => tx.wait(1));

  console.info("added members");
}
main();
