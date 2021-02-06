const deploy = require("./lib/Deploy.js");

const timeInHour = 60 * 60 * 1000
jest.setTimeout(8 * timeInHour);

describe('Test BellaFlexsaving Deploy', () => {
    const [
        deployer
    ] = saddle.wallet_accounts

    it('can deploy all token vault and strategy', async () => {
        await deploy(saddle, deployer, accounts)
        console.log("deployed success!");
    });

})