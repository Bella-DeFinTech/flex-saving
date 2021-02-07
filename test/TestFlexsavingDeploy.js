const deploy = require("./lib/Deploy.js");

const timeInHour = 60 * 60 * 1000
jest.setTimeout(8 * timeInHour);

describe('Test BellaFlexsaving Deploy', () => {
    it('can deploy all token vault and strategy', async () => {
        // 2021-02-08 20:00:00
        await deploy(saddle, '0x10f919f874dB00239a1f891d96279Ff999514B82', {}, [], 1612785600)
        console.log("deployed success!");
    });

})