(async function () {

    const [
        deployer
    ] = saddle.wallet_accounts

    let bellaStaking = await saddle.getContractAt('BellaStaking', '0x6Cb6FF550Ea4473Ed462F8bda38aE3226C04649d')

    // console.log(await call(bellaStaking, 'bella'))

    await send(bellaStaking, 'lock', ['100000000000000000000000', 7], { from: deployer })

})()