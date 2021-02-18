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
}

module.exports = config