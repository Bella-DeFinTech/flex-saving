const deploy = require("./lib/StakingDeploy.js");

jest.setTimeout(30 * 60 * 1000);

describe('Test BellaStaking Deploy', () => {
    it('can deploy staking pool and add pools', async () => {
        await deploy(saddle, accounts[0], accounts)
        console.log("deployed success!");
    });

})