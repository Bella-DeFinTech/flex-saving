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
    const [
        deployer
    ] = saddle.wallet_accounts
    // const deployerAddress = '0xb5919ECf5c3422F0C2806976Dc75B3C473498613'
    const governaceAddress = '0x0fFE3AB40D89C2CCf9881A28465ab7Fe332fcA9a'

    it('can deploy staking pool and add pools', async () => {

        await deploy(saddle, deployer, governaceAddress, testVaultAddressObj, 1612785600)
        console.log("deployed success!");
    });

})