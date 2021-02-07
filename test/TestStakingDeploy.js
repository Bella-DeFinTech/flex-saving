const deploy = require("./lib/StakingDeploy.js");

const timeInHour = 60 * 60 * 1000
jest.setTimeout(8 * timeInHour);

const testVaultAddressObj = {
    bUsdt: "",
    bUsdc: "",
    // bWbtc: "0x2260fac5e5542a773aa44fbcfedf7c193bc2c599",
    bArpa: "",
    // bDai: "0x6b175474e89094c44da98b954eedeac495271d0f",
    // bBusd: "0x4fabb145d64652a948d72533023f6e7a623c7c53",
    // bHbtc: "0x0316EB71485b0Ab14103307bf65a021042c6d380"
}

describe('Test BellaStaking Deploy', () => {
    const deployerAddress = '0x10f919f874dB00239a1f891d96279Ff999514B82'
    const governaceAddress = '0x0fFE3AB40D89C2CCf9881A28465ab7Fe332fcA9a'

    it('can deploy staking pool and add pools', async () => {
        // 2021-02-08 20:00:00
        await deploy(saddle, deployerAddress, governaceAddress, testVaultAddressObj, 1612785600)
        console.log("deployed success!");
    });

})