
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

app.get('/', (req, res) => {
    res.send('Hello World!')
})

app.listen(port, () => {
    console.log(`Reinvest On BSC app listening at http://localhost:${port}`)

    checkToReinvest(amountOfPool);

    setInterval(async () => {
        await checkToReinvest(amountOfPool);
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
    console.log(`response : ${JSON.stringify(response, null, 4)}`);
}

const checkToReinvest = async (amountOfPool) => {
    let reinvestBalance = 0;
    reinvestBalance = await getTokenBalance(tokenAddress, tokenAbi, wallet.address);
    console.log(`Current Token amount in Wallet : ${toReadableNumber(reinvestBalance)}`);

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

    console.log(`All Pending rewards : ${pendingRewards}`);

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
    }
}

const enterStaking = async (amount, signer) => {
    const contractWithSigner = farmContract.connect(signer);
    const options = getTransactionOptions();
    const transaction = await contractWithSigner.enterStaking(amount, options);
    await provider.waitForTransaction(transaction.hash);
    const response = await provider.getTransaction(transaction.hash);
    console.log(`response : ${JSON.stringify(response, null, 4)}`);
}

const getTokenBalance = async (tokenAddress, abi, address) => {
    const contract = new ethers.Contract(tokenAddress, abi, provider);
    const balance = await contract.balanceOf(address);
    return balance;
}

const getTransactionOptions = () => {
    return { gasLimit: 450000 };
}