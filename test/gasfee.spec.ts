import { expect } from "chai";
import { ethers, network } from "hardhat";
import { SmeGasManager } from "../typechain-types";
import { randomHex } from "./utils/encoding";
import { faucet } from "./utils/faucet";
const { parseEther } = ethers.utils;

describe("Gas manager tests", function () {
  const { provider } = ethers;
  const admin = new ethers.Wallet(randomHex(32), provider);
  const maker = new ethers.Wallet(randomHex(32), provider);
  const taker = new ethers.Wallet(randomHex(32), provider);
  let gasManager: SmeGasManager;
  before(async () => {
    for (const wallet of [admin, maker, taker]) {
      await faucet(wallet.address, provider);
    }
    gasManager = await (await ethers.getContractFactory("SmeGasManager")).connect(admin).deploy(parseEther("0.00006"));
  });

  after(async () => {
    await network.provider.request({ method: "hardhat_reset" });
  });

  it("Request match work", async () => {
    const gasPrice = await gasManager.gasFee();
    const hashes = [randomHex(), randomHex()];
    await expect(gasManager.connect(maker).requestMatchOrder(hashes, { value: gasPrice }))
      .to.changeEtherBalances([maker, gasManager.address], [-gasPrice.toString(), gasPrice])
      .emit(gasManager, "RequestedMatch")
      .withArgs(hashes);
  });

  it("Request match work of value > gasFee", async () => {
    const gasPrice = await gasManager.gasFee();
    const hashes = [randomHex(), randomHex()];
    const morethan = parseEther("0.001").add(gasPrice);
    await expect(gasManager.connect(maker).requestMatchOrder(hashes, { value: morethan }))
      .to.changeEtherBalances([maker, gasManager.address], [-gasPrice, gasPrice])
      .to.emit(gasManager, "RequestedMatch")
      .withArgs(hashes);
  });

  it("Request revert of value < gasFee", async () => {
    const gasPrice = await gasManager.gasFee();
    const hashes = [randomHex(), randomHex()];
    await expect(gasManager.connect(maker).requestMatchOrder(hashes, { value: gasPrice.sub(1000) })).to.be.rejectedWith(
      "",
      "Should error of value < gasFee"
    );
  });

  it("Set gasfee work", async () => {
    await expect(gasManager.connect(admin).setGasPrice(parseEther("0.0001")))
      .to.emit(gasManager, "GasFeeChange")
      .withArgs(parseEther("0.0001"));
    const newPrice = await gasManager.gasFee();
    expect(newPrice).to.deep.eq(parseEther("0.0001"));
  });

  it("Withdraw gas work", async () => {
    await gasManager.connect(maker).requestMatchOrder([randomHex()], { value: await gasManager.gasFee() });
    const balance = await gasManager.provider.getBalance(gasManager.address);
    await expect(gasManager.connect(admin).withdrawGas(admin.address, balance)).to.changeEtherBalances(
      [gasManager.address, admin.address],
      [-balance.toString(), balance]
    );
  });
});
