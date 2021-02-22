const appendDeploy = require("./lib/FSAppendDeploy.js");
const timeInHour = 60 * 60 * 1000
jest.setTimeout(8 * timeInHour);

describe('Test BellaFlexsaving Deploy', () => {
    const [
        deployer, governance
    ] = saddle.wallet_accounts

    it('can deploy all token vault and strategy', async () => {
        let controllerAddress = '0xd8c5344E331d5f4161f03726870ce9DA8B504d2A'
        let whitelistAddress = '0x19F35Ce3C3875C120AB602386C8d6a59e88E493e'
        await appendDeploy(saddle, deployer, governance, [], controllerAddress, whitelistAddress)
        console.log("deployed success!");
    });

})