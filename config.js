require('dotenv').config()

const config = {
    network: process.env.NETWORK,
    port: process.env.PORT,
    privateKey: process.env.PRIVATE_KEY,
    keystore: process.env.KEYSTORE,
    password: process.env.PASSWORD,
    farmAbi: process.env.FARM_ABI,
    farmAddress: process.env.FARM_ADDRESS,
    millisecondToCheck: process.env.MILLISECOND_TO_CHECK,
    numberOfPool: process.env.NUMBER_OF_POOL,
    harvestNumber: process.env.HARVEST_NUMBER,
    tokenAbi: process.env.TOKEN_ABI,
    tokenAddress: process.env.TOKEN_ADDRESS,
    swapAbi: process.env.SWAP_ABI,
    swapAddress: process.env.SWAP_ADDRESS,
    pairTokenAddress: process.env.PAIR_TOKEN_ADDRESS,
    lpTokenAddress: process.env.LP_ADDRESS,
    lpTokenAbi: process.env.LP_ABI,
    pendingRewardFnName: process.env.PENDING_REWARD_NAME,
    slippagePercent: process.env.SLIPPAGE_PERCENT,
    reinvestPool: process.env.REINVEST_POOL,
}

module.exports = config