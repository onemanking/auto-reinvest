
const express = require('express')
const app = express()
const config = require('./config');
const port = config.port;
const fs = require('fs');

const { ethers } = require('ethers');

const provider = new ethers.providers.JsonRpcProvider(config.network);
const pk = config.privateKey;

const wallet = new ethers.Wallet(pk, provider);

const farmAbi = JSON.parse(fs.readFileSync(config.farmAbi, 'utf8'));
const farmAddress = config.farmAddress;
const farmContract = new ethers.Contract(farmAddress, farmAbi, provider);
const pendingRewardFnName = config.pendingRewardFnName;

const millisecondToCheck = config.millisecondToCheck;
const amountOfPool = config.numberOfPool;
const harvestNumber = config.harvestNumber;
const reinvestPool = config.reinvestPool;

const farmTokenAddress = config.farmTokenAddress;
const farmTokenAbi = JSON.parse(fs.readFileSync(config.farmTokenAbi, 'utf8'));;

const swapAddress = config.swapAddress;
const swapAbi = JSON.parse(fs.readFileSync(config.swapAbi, 'utf8'));
const swapContract = new ethers.Contract(swapAddress, swapAbi, provider);
const slippagePercent = config.slippagePercent;
const swapCutOffPercent = config.swapCutOffPercent;

const firstReinvestTokenAddress = config.firstReinvestTokenAddress;
const firstReinvestTokenAbi = JSON.parse(fs.readFileSync(config.firstReinvestTokenAbi, 'utf8'));;
const secoundReinvestTokenAddress = config.secoundReinvestTokenAddress;

const lpTokenAddress = config.lpTokenAddress;
const lpTokenAbi = JSON.parse(fs.readFileSync(config.lpTokenAbi, 'utf8'));

let tokenName = '';

app.listen(port, async () => {
    console.log(`Auto-Reinvest on BSC app listening at http://localhost:${port}`)

    console.log(`Recheck every : ${millisecondToCheck / 60000} mins`);

    tokenName = await getTokenName(farmTokenAddress, farmTokenAbi);

    checkToReinvest(amountOfPool, reinvestPool, wallet);

    setInterval(async () => {
        await checkToReinvest(amountOfPool, reinvestPool, wallet);
    }, millisecondToCheck);
})

const getBalance = async (address) => {
    const balance = await provider.getBalance(address);
    return balance;
}

const getPendingRewards = async (poolNumber, address, fnName) => {
    const balance = await farmContract[fnName](poolNumber, address);
    return balance;
}

const toReadableNumber = (number) => ethers.utils.formatEther(number.toString());

const harvestReward = async (poolNumber, signer) => {
    const contractWithSigner = farmContract.connect(signer);
    const options = getTransactionOptions();
    const transaction = await contractWithSigner.deposit(poolNumber, 0, options);

    const receipt = await getTransactionReceipt(transaction);
    if (receipt.status !== 1) {
        console.log("Transaction failed!!! re-do it");
        await harvestReward(poolNumber, signer)
    }

    const harvestBalance = await getTokenBalance(farmTokenAddress, farmTokenAbi, wallet.address);
    console.log(`Harvested Reward : ${toReadableNumber(harvestBalance)} `);
}

const deposit = async (poolNumber, amount, signer) => {
    const contractWithSigner = farmContract.connect(signer);
    const options = getTransactionOptions();
    const transaction = await contractWithSigner.deposit(poolNumber, amount, options);

    const receipt = await getTransactionReceipt(transaction);
    if (receipt.status !== 1) {
        console.log("Transaction failed!!! re-do it");
        await deposit(poolNumber, amount, signer);
    }

    console.log(`Deposit amount: ${toReadableNumber(amount)} `);
}

const checkToReinvest = async (amountOfPool, reinvestPool, wallet) => {
    let harvestBalance = 0;
    harvestBalance = await getTokenBalance(farmTokenAddress, farmTokenAbi, wallet.address);

    console.log(`---------------------------------------------------------------`);
    console.log(`******${tokenName}******`);
    console.log(`Current native token amount in wallet : ${toReadableNumber(await getBalance(wallet.address))}`);
    console.log(`Current ${tokenName} token amount in wallet : ${toReadableNumber(harvestBalance)}`);

    for (let i = 0; i <= amountOfPool; i++) {
        const currentStaking = await getStakingBalance(i, wallet.address)
        if (currentStaking <= 0) continue;
        console.log(`Current staking amount in Pool ${i} : ${toReadableNumber(currentStaking)}`);
    }

    if (toReadableNumber(harvestBalance) > harvestNumber) {
        console.log(`Found token reward ${toReadableNumber(harvestBalance)} left in wallet, start reinvest`);
        await reinvest(getSwapBalance(harvestBalance, swapCutOffPercent), reinvestPool, wallet);
    }

    let pendingRewards = 0
    // SKIP 0 POOL
    for (let i = 1; i <= amountOfPool; i++) {
        const reward = await getPendingRewards(i, wallet.address, pendingRewardFnName);

        if (reward <= 0) continue;
        console.log(`Pending reward in Pool ${i} : ${toReadableNumber(reward)}`);

        pendingRewards += parseFloat(toReadableNumber(reward));
    }

    console.log(`All pending rewards : ${pendingRewards}`);
    console.log(`Will reinvest in Pool ${reinvestPool} when pending rewards ${pendingRewards} > ${harvestNumber} `);
    console.log(`---------------------------------------------------------------`);

    if (pendingRewards > harvestNumber) {
        await harvestAllReward(amountOfPool, wallet);

        harvestBalance = await getTokenBalance(farmTokenAddress, farmTokenAbi, wallet.address)

        console.log(`Harvest Token amount : ${toReadableNumber(harvestBalance)}`);

        await reinvest(harvestBalance, reinvestPool, wallet);

        console.log(`Current staking amount : ${toReadableNumber(await getStakingBalance(reinvestPool, wallet.address))}`);
    }
}

const harvestAllReward = async (amountOfPool, wallet) => {
    console.log(`Start harvest`);
    for (let i = 1; i <= amountOfPool; i++) {
        const reward = await getPendingRewards(i, wallet.address, pendingRewardFnName);
        if (reward <= 0) continue;
        await harvestReward(i, wallet);
    }
}

const reinvest = async (harvestBalance, poolNumber, wallet) => {
    console.log(`Start reinvest in Pool ${poolNumber} with ${tokenName}`);

    const deadline = getDeadlineTime();
    const swapBalance = getSwapBalance(harvestBalance, swapCutOffPercent);
    await swapToken(swapBalance, getSlippagePercentage(slippagePercent), [farmTokenAddress, secoundReinvestTokenAddress], deadline, wallet);
    const reinvestBalance = await getTokenBalance(farmTokenAddress, farmTokenAbi, wallet.address);
    await addLiquidityETH(farmTokenAddress, reinvestBalance, getSlippagePercentage(slippagePercent), wallet);
    const lpBalance = await getTokenBalance(lpTokenAddress, lpTokenAbi, wallet.address);
    await deposit(poolNumber, lpBalance.toString(), wallet);
}

const getAmountOut = async (amountIn, paths) => {
    const amountOutMin = await swapContract.getAmountsOut(amountIn.toString(), paths);
    return amountOutMin;
}

const swapToken = async (amountIn, slippagePercentage, paths, deadline, signer) => {
    const getAmountRes = await getAmountOut(amountIn.toString(), paths);
    const amountOutMin = getAmountRes[1] - (getAmountRes[1] * slippagePercentage);
    const contractWithSigner = swapContract.connect(signer);
    const options = getTransactionOptions();
    const transaction = await contractWithSigner.swapExactTokensForETH(getAmountRes[0], amountOutMin.toString(), paths, signer.address, deadline, options);
    const receipt = await getTransactionReceipt(transaction);

    if (receipt.status !== 1) {
        console.log("Transaction failed!!! re-do it");
        await swapToken(amountIn, slippagePercentage, paths, deadline, signer);
    }

    console.log(`Swap ${tokenName} : ${toReadableNumber(amountIn)} for ${toReadableNumber(amountOutMin)} native token`);
}

const addLiquidityETH = async (tokenAddress, amountIn, slippagePercentage, signer) => {
    const contractWithSigner = swapContract.connect(signer);
    const amountTokenMin = amountIn * slippagePercentage;
    const getAmountOutRes = await getAmountOut(amountIn, [tokenAddress, secoundReinvestTokenAddress]);
    const amountETHMin = getAmountOutRes[1];
    const deadline = getDeadlineTime();
    const options = { gasLimit: 450000, value: amountETHMin };
    const transaction = await contractWithSigner.addLiquidityETH(tokenAddress, amountIn.toString(), amountTokenMin.toString(), amountETHMin, signer.address, deadline, options);

    const receipt = await getTransactionReceipt(transaction);
    if (receipt.status !== 1) {
        console.log("Transaction failed!!! re-do it");
        await addLiquidityETH(tokenAddress, amountIn, slippagePercentage, signer);
    }

    console.log(`Add liquidity : [${tokenName} : ${toReadableNumber(amountIn)}, Native : ${toReadableNumber(amountETHMin)}]`);
}

const getSlippagePercentage = (slippage) => (100 - slippage) / 100;


const enterStaking = async (amount, signer) => {
    const contractWithSigner = farmContract.connect(signer);
    const options = getTransactionOptions();
    const transaction = await contractWithSigner.enterStaking(amount, options);

    const receipt = await getTransactionReceipt(transaction);
    if (receipt.status !== 1) {
        console.log("Transaction failed!!! re-do it");
        await enterStaking(amount, signer);
    }
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

const getToken0FromLP = async (lpAddress, abi) => {
    const contract = new ethers.Contract(lpAddress, abi, provider);
    return await contract.token0();
}

const getToken1FromLP = async (lpAddress, abi) => {
    const contract = new ethers.Contract(lpAddress, abi, provider);
    return await contract.token1();
}

const getTokenName = async (tokenAddress, abi) => {
    const contract = new ethers.Contract(tokenAddress, abi, provider);
    return await contract.name();
}

const getTransactionOptions = () => {
    return { gasLimit: 450000 };
}

const getDeadlineTime = () => {
    const date = new Date();
    date.setHours(date.getHours() + 1);
    return date.getTime();
}

const getSwapBalance = (allBalance, cutOffPercent) => {
    console.log(`Balance : ${toReadableNumber(allBalance)}`)
    const divBalance = (allBalance / 2);
    console.log(`DivBalance : ${toReadableNumber(divBalance)}`)
    const percentage = cutOffPercent / 100;
    console.log(`Cut off Percentage : ${cutOffPercent}%`)
    const cutOffBalance = divBalance * percentage;
    console.log(`Cut off Balance : ${toReadableNumber(cutOffBalance)}`)
    const swapBalance = divBalance + cutOffBalance;
    console.log(`SwapBalance : ${toReadableNumber(swapBalance)}`)
    return swapBalance;
}

const getTransactionReceipt = async (transaction) => {
    await provider.waitForTransaction(transaction.hash);
    return await provider.getTransactionReceipt(transaction.hash);
}