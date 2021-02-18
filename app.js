
const express = require('express')
const app = express()
const config = require('./config');
const port = config.port;

const { ethers } = require('ethers');

const provider = new ethers.providers.JsonRpcProvider(config.network);
const pk = config.privateKey;

const wallet = new ethers.Wallet(pk, provider);

const farmAbi = config.farmAbi;
const farmAddress = config.farmAddress;
const farmContract = new ethers.Contract(farmAddress, farmAbi, provider);

const millisecondToCheck = config.millisecondToCheck;
const amountOfPool = config.numberOfPool;
const harvestNumber = config.harvestNumber;

const tokenAddress = config.tokenAddress;
const tokenAbi = config.tokenAbi;

app.listen(port, () => {
    console.log(`Auto-Reinvest on BSC app listening at http://localhost:${port}`)

    console.log(`Recheck every : ${millisecondToCheck / 60000} mins`);

    checkToReinvest(amountOfPool, wallet);

    setInterval(async () => {
        await checkToReinvest(amountOfPool, wallet);
    }, millisecondToCheck);
})

const getBalance = async (address) => {
    const balance = await provider.getBalance(address);
    return balance;
}

const getPendingRewards = async (poolNumber, address) => {
    const balance = await farmContract.pendingCake(poolNumber, address);
    return balance;
}

const toReadableNumber = (number) => ethers.utils.formatEther(number);

const harvestReward = async (poolNumber, signer) => {
    const contractWithSigner = farmContract.connect(signer);
    const options = getTransactionOptions();
    const transaction = await contractWithSigner.deposit(poolNumber, 0, options);
    await provider.waitForTransaction(transaction.hash);
    const response = await provider.getTransaction(transaction.hash);
    console.log(`Harvest Tx hash : ${response.hash}`);
}

const checkToReinvest = async (amountOfPool, wallet) => {
    let reinvestBalance = 0;
    reinvestBalance = await getTokenBalance(tokenAddress, tokenAbi, wallet.address);

    console.log(`---------------------------------------------------------------`);
    console.log(`Current native token amount in wallet : ${toReadableNumber(await getBalance(wallet.address))}`);
    console.log(`Current token amount in wallet : ${toReadableNumber(reinvestBalance)}`);
    console.log(`Current staking amount : ${toReadableNumber(await getStakingBalance(0, wallet.address))}`);

    if (toReadableNumber(reinvestBalance) > harvestNumber) {
        await enterStaking(reinvestBalance, wallet);
    }

    let pendingRewards = 0
    // SKIP 0 POOL
    for (let i = 1; i <= amountOfPool; i++) {
        const reward = await getPendingRewards(i, wallet.address);

        console.log(`Pending reward in Pool ${i} : ${toReadableNumber(reward)}`);
        if (reward <= 0) continue;

        pendingRewards += parseFloat(toReadableNumber(reward));
    }

    console.log(`All pending rewards : ${pendingRewards}`);
    console.log(`Will reinvest when pending rewards ${pendingRewards} > ${harvestNumber} `);
    console.log(`---------------------------------------------------------------`);

    if (pendingRewards > harvestNumber) {
        reinvestBalance = 0;
        for (let i = 1; i <= amountOfPool; i++) {
            const reward = await getPendingRewards(i, wallet.address);
            if (reward <= 0) continue;
            await harvestReward(i, wallet);
            const balance = await getTokenBalance(tokenAddress, tokenAbi, wallet.address)
            reinvestBalance += balance;
        }

        console.log(`Reinvest Token amount : ${reinvestBalance}`);

        await enterStaking(reinvestBalance, wallet);

        console.log(`Current staking amount : ${toReadableNumber(await getStakingBalance(0, wallet.address))}`);
    }
}

const enterStaking = async (amount, signer) => {
    const contractWithSigner = farmContract.connect(signer);
    const options = getTransactionOptions();
    const transaction = await contractWithSigner.enterStaking(amount, options);
    await provider.waitForTransaction(transaction.hash);
    const response = await provider.getTransaction(transaction.hash);
    console.log(`Reinvest Tx hash : ${response.hash}`);
}

const getStakingBalance = async (poolNumber, address) => {
    const balance = await farmContract.userInfo(poolNumber, address);
    return balance.amount;
}

const getTokenBalance = async (tokenAddress, abi, address) => {
    const contract = new ethers.Contract(tokenAddress, abi, provider);
    const balance = await contract.balanceOf(address);
    return balance;
}

const getTransactionOptions = () => {
    return { gasLimit: 450000 };
}