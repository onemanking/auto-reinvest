
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
const pendingRewardFnName = config.pendingRewardFnName;

const millisecondToCheck = config.millisecondToCheck;
const amountOfPool = config.numberOfPool;
const harvestNumber = config.harvestNumber;
const reinvestPool = config.reinvestPool;

const tokenAddress = config.tokenAddress;
const tokenAbi = config.tokenAbi;

const swapAddress = config.swapAddress;
const swapAbi = config.swapAbi;
const swapContract = new ethers.Contract(swapAddress, swapAbi, provider);
const slippagePercent = config.slippagePercent;

const pairTokenAddress = config.pairTokenAddress;

const lpTokenAddress = config.lpTokenAddress;
const lpTokenAbi = config.lpTokenAbi;

let tokenName = '';

app.listen(port, async () => {
    console.log(`Auto-Reinvest on BSC app listening at http://localhost:${port}`)

    console.log(`Recheck every : ${millisecondToCheck / 60000} mins`);

    tokenName = await getTokenName(tokenAddress, tokenAbi);

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

const toReadableNumber = (number) => ethers.utils.formatEther(number);

const harvestReward = async (poolNumber, signer) => {
    const contractWithSigner = farmContract.connect(signer);
    const options = getTransactionOptions();
    const transaction = await contractWithSigner.deposit(poolNumber, 0, options);

    await logTransaction(`Harvest Tx hash`, transaction)
}

const deposit = async (poolNumber, amount, signer) => {
    const contractWithSigner = farmContract.connect(signer);
    const options = getTransactionOptions();
    const transaction = await contractWithSigner.deposit(poolNumber, amount, options);

    await logTransaction(`Deposit Tx hash`, transaction)
}

const checkToReinvest = async (amountOfPool, reinvestPool, wallet) => {
    let harvestBalance = 0;
    harvestBalance = await getTokenBalance(tokenAddress, tokenAbi, wallet.address);

    console.log(`---------------------------------------------------------------`);
    console.log(`******${tokenName}******`);
    console.log(`Current native token amount in wallet : ${toReadableNumber(await getBalance(wallet.address))}`);
    console.log(`Current ${tokenName} token amount in wallet : ${toReadableNumber(harvestBalance)}`);

    for (let i = 0; i <= amountOfPool; i++) {
        console.log(`Current staking amount in Pool ${i} : ${toReadableNumber(await getStakingBalance(i, wallet.address))}`);
    }

    if (toReadableNumber(harvestBalance) > harvestNumber) {
        console.log(`Found token reward ${toReadableNumber(harvestBalance)} left in wallet, start reinvest`);
        await reinvest(getSwapBalance(harvestBalance), reinvestPool, wallet);
    }

    let pendingRewards = 0
    // SKIP 0 POOL
    for (let i = 1; i <= amountOfPool; i++) {
        const reward = await getPendingRewards(i, wallet.address, pendingRewardFnName);

        console.log(`Pending reward in Pool ${i} : ${toReadableNumber(reward)}`);
        if (reward <= 0) continue;

        pendingRewards += parseFloat(toReadableNumber(reward));
    }

    console.log(`All pending rewards : ${pendingRewards}`);
    console.log(`Will reinvest in Pool ${reinvestPool} when pending rewards ${pendingRewards} > ${harvestNumber} `);
    console.log(`---------------------------------------------------------------`);

    if (pendingRewards > harvestNumber) {
        console.log(`Start harvest`);

        harvestBalance = 0;
        for (let i = 1; i <= amountOfPool; i++) {
            const reward = await getPendingRewards(i, wallet.address, pendingRewardFnName);
            if (reward <= 0) continue;
            await harvestReward(i, wallet);
            const balance = await getTokenBalance(tokenAddress, tokenAbi, wallet.address)
            harvestBalance += parseInt(balance.toString());
        }

        console.log(`Harvest Token amount : ${harvestBalance}`);

        await reinvest(getSwapBalance(harvestBalance), reinvestPool, wallet);

        console.log(`Current staking amount : ${toReadableNumber(await getStakingBalance(1, wallet.address))}`);
    }
}

const reinvest = async (swapBalance, poolNumber, wallet) => {
    console.log(`Start reinvest in Pool ${poolNumber}`);

    const deadline = getDeadlineTime();
    await swapToken(swapBalance, getSlippagePercentage(slippagePercent), [tokenAddress, pairTokenAddress], deadline, wallet);
    const reinvestBalance = await getTokenBalance(tokenAddress, tokenAbi, wallet.address);
    await addLiquidityETH(tokenAddress, reinvestBalance, getSlippagePercentage(slippagePercent), wallet);
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
    const transaction = await contractWithSigner.swapExactTokensForETH(getAmountRes[0], amountOutMin, paths, signer.address, deadline, options);

    await logTransaction(`Swap Tx hash`, transaction);
}

const addLiquidityETH = async (tokenAddress, amountIn, slippagePercentage, signer) => {
    const contractWithSigner = swapContract.connect(signer);
    const amountTokenMin = amountIn * slippagePercentage;
    const getAmountOutRes = await getAmountOut(amountIn, [tokenAddress, pairTokenAddress]);
    const amountETHMin = getAmountOutRes[1];
    const deadline = getDeadlineTime();
    const options = { gasLimit: 450000, value: amountETHMin };
    const transaction = await contractWithSigner.addLiquidityETH(tokenAddress, amountIn.toString(), amountTokenMin.toString(), amountETHMin, signer.address, deadline, options);

    await logTransaction(`Add liquidity Tx hash`, transaction);
}

const getSlippagePercentage = (slippage) => (100 - slippage) / 100;


const enterStaking = async (amount, signer) => {
    const contractWithSigner = farmContract.connect(signer);
    const options = getTransactionOptions();
    const transaction = await contractWithSigner.enterStaking(amount, options);

    await logTransaction(`Reinvest Tx hash`, transaction);
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

const logTransaction = async (logText, transaction) => {
    await provider.waitForTransaction(transaction.hash);
    const response = await provider.getTransaction(transaction.hash);
    console.log(`${logText} : ${response.hash}`);
}

const getSwapBalance = (harvestBalance) => {
    const divBalance = (harvestBalance / 2);
    const percentage = 8 / 100;
    const swapBalance = divBalance + (divBalance * (percentage));
    return swapBalance;
}