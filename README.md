# Auto-Reinvest

A Node.js application for automatically harvesting and reinvesting rewards from DeFi farming pools on Binance Smart Chain (BSC).

## Overview

This application monitors your staked positions in farming pools, automatically harvests rewards when they reach a specified threshold, and reinvests them for compound returns. It works with various DeFi platforms on BSC, with examples configured for ApeSwap and PancakeSwap.

## Features

- Monitor pending rewards across multiple farming pools
- Automatically harvest rewards when they exceed a threshold
- Swap tokens using decentralized exchanges
- Add liquidity to liquidity pools
- Reinvest in specified farming pools
- Configurable settings via environment variables

## Prerequisites

- Node.js (v12 or higher)
- A BSC wallet with private key access
- Some BNB for transaction fees
- Tokens staked in farming pools

## Installation

1. Clone this repository:

   ```
   git clone <repository-url>
   cd auto-reinvest
   ```

2. Install dependencies:

   ```
   npm install
   ```

3. Copy the example environment file and configure it for your needs:

   ```
   cp example.env .env
   ```

4. Edit `.env` file with your specific settings (see Configuration section below)

## Configuration

Configure the application by editing the `.env` file:

### Network and Wallet Settings

```
NETWORK = 'https://bsc-dataseed1.binance.org/' # MAINNET
PORT = 3000
PRIVATE_KEY = 'YOUR_PRIVATE_KEY'  # Keep this secure!
MILLISECOND_TO_CHECK = 60000  # How often to check rewards (in milliseconds)
```

### Pool Settings

```
NUMBER_OF_POOL = 5  # Number of pools to monitor
HARVEST_NUMBER = 10  # Minimum reward amount to trigger harvest
REINVEST_POOL = 1  # Pool ID to reinvest into
```

### Farm Settings

```
FARM_ADDRESS = '0x5c8D727b265DBAfaba67E050f2f739cAeEB4A6F9'
FARM_ABI = './abi/farmAbi'
FARM_TOKEN_ADDRESS = '0x603c7f932ed1fc6575303d8fb018fdcbb0f39a95'
FARM_TOKEN_ABI = './abi/tokenAbi'
PENDING_REWARD_NAME = 'pendingCake'  # Function name to check pending rewards
```

### Token Settings

```
FIRST_REINVEST_TOKEN_ADDRESS = '0x096901973AC5b4dd14728fAE04597b90B2a47da9'
FIRST_REINVEST_TOKEN_ABI = './abi/tokenAbi'
SECOUND_REINVEST_TOKEN_ADDRESS = '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c'
```

### Swap Settings

```
SWAP_ADDRESS = '0xC0788A3aD43d79aa53B09c2EaCc313A787d1d607'  # DEX router address
SWAP_ABI = './abi/swapAbi'
SLIPPAGE_PERCENT = 5  # Slippage tolerance for swaps
SWAP_CUT_OFF_PERCENT = 8  # Percentage to allocate for swapping
```

### LP Token Settings

```
LP_ADDRESS = '0xF65C1C0478eFDe3c19b49EcBE7ACc57BB6B1D713'
LP_ABI = './abi/lpAbi'
```

## Running the Application

Start the application with:

```
node app.js
```

The application will:

1. Check your wallet balance and staking positions
2. Monitor pending rewards
3. Harvest and reinvest when rewards exceed the threshold
4. Log all activities to the console
5. Repeat the process based on the MILLISECOND_TO_CHECK interval

## How It Works

1. **Initialization**:
   - Loads configuration from environment variables
   - Connects to the blockchain network
   - Sets up contract interfaces

2. **Checking Rewards**:
   - Periodically checks pending rewards across configured pools
   - Monitors token balance in your wallet

3. **Harvesting**:
   - When pending rewards exceed the threshold, triggers harvest function
   - Calls deposit(poolId, 0) to claim rewards without adding more tokens

4. **Reinvesting**:
   - Swaps a portion of harvested tokens for BNB
   - Adds liquidity to create LP tokens
   - Stakes the LP tokens in the specified farm pool

## Customization

You can modify the application to work with different DEXs or farming platforms by:

1. Updating the ABIs in the abi directory
2. Adjusting the addresses and function names in the .env file
3. Modifying the swap and reinvest logic in app.js if needed

## Security Notes

- Never share your private key or .env file
- Consider using a dedicated wallet for this automation
- Monitor the application regularly to ensure it's working as expected
- Test with small amounts before deploying with significant funds
