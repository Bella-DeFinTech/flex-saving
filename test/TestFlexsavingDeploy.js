const deploy = require("./lib/Deploy.js");

const timeInHour = 60 * 60 * 1000
jest.setTimeout(8 * timeInHour);

describe('Test BellaFlexsaving Deploy', () => {
    it('can deploy all token vault and strategy', async () => {
        await deploy(saddle, accounts[0], accounts)
        console.log("deployed success!");
    });

})