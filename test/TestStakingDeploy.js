const deploy = require("./lib/StakingDeploy.js");

const timeInHour = 60 * 60 * 1000
jest.setTimeout(8 * timeInHour);

const testVaultAddressObj = {
    bUsdt: "0xD1E00Ce58A12e77E736A6417fb5FE6E0f08697AB",
    bUsdc: "0xD1E00Ce58A12e77E736A6417fb5FE6E0f08697AB",
    bWbtc: "0xD1E00Ce58A12e77E736A6417fb5FE6E0f08697AB",
    bArpa: "0xD1E00Ce58A12e77E736A6417fb5FE6E0f08697AB",
    bDai: "0xD1E00Ce58A12e77E736A6417fb5FE6E0f08697AB",
    bBusd: "0xD1E00Ce58A12e77E736A6417fb5FE6E0f08697AB",
    bHbtc: "0xD1E00Ce58A12e77E736A6417fb5FE6E0f08697AB"
}

describe('Test BellaStaking Deploy', () => {
    const deployerAddress = accounts[0]
    const governaceAddress = accounts[1]

    it('can deploy staking pool and add pools', async () => {

        await deploy(saddle, deployerAddress, governaceAddress, testVaultAddressObj)
        console.log("deployed success!");
    });

})