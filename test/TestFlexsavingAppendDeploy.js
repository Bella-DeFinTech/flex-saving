const deploy = require("./lib/Deploy.js");
const appendDeploy = require("./lib/FSAppendDeploy.js");
const timeInHour = 60 * 60 * 1000
jest.setTimeout(8 * timeInHour);

describe('Test BellaFlexsaving Deploy', () => {
    const [
        deployer, governance
    ] = saddle.wallet_accounts

    it('can deploy all token vault and strategy', async () => {
        let deployAddress = await deploy(saddle, deployer, {}, [], 1612785600)
        await appendDeploy(saddle, deployer, governance, [], deployAddress.controller, deployAddress.whitelist)
        console.log("deployed success!");
    });

})