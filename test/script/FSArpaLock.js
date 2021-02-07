(async function () {

    const [
        deployer
    ] = saddle.wallet_accounts

    let strategyARPA = await saddle.getContractAt('StrategyArpa', '0xA3063Cf3a934068CBE8f55212577a1FfbE63095E')


    await send(strategyARPA, 'lock', ['1000000000000000000000000', 28], { from: deployer })

})()