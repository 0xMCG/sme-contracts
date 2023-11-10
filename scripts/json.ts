import { readFileSync, writeFileSync } from "fs";
import { network } from "hardhat";

export type DeployedVerifyJson = { [k: string]: any };
export function getJson(): DeployedVerifyJson {

  const json = readFileSync("./json/" + network.name + ".json", "utf-8");
  const dto = JSON.parse(json || '{}') as any;
  return dto;
}

export function writeJson(dto: DeployedVerifyJson) {
  writeFileSync(
    "./json/" + network.name + ".json",
    JSON.stringify(dto, undefined, 2)
  );
}
