const deploy = require("./lib/Deploy.js");

jest.setTimeout(300000);

describe('Test BellaFlexsaving Deploy', () => {
    it('can deploy', async () => {
        await deploy(saddle, accounts[0], accounts)
        console.log("deployed success!");
    });

})