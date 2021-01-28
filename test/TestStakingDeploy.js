const deploy = require("./lib/StakingDeploy.js");

jest.setTimeout(30 * 60 * 1000);

const testVaultAddressObj = {
    bUsdt: "0xdac17f958d2ee523a2206206994597c13d831ec7",
    bUsdc: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
    bWbtc: "0x2260fac5e5542a773aa44fbcfedf7c193bc2c599",
    bArpa: "0xba50933c268f567bdc86e1ac131be072c6b0b71a",
    bDai: "0x6b175474e89094c44da98b954eedeac495271d0f",
    bBusd: "0x4fabb145d64652a948d72533023f6e7a623c7c53",
    bHbtc: "0x0316EB71485b0Ab14103307bf65a021042c6d380"
}

describe('Test BellaStaking Deploy', () => {
    const deployerAddress = accounts[0]
    const governaceAddress = accounts[1]

    it('can deploy staking pool and add pools', async () => {

        await deploy(saddle, deployerAddress, governaceAddress, testVaultAddressObj)
        console.log("deployed success!");
    });

})