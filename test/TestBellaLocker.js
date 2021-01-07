const Utils = require("./utils/Utils.js");
const timeMachine = require("./utils/TimeMachine.js");

jest.setTimeout(300000);

describe('Test BellaLocker Normal', () => {

    const u256max = web3.utils.toWei('9999999999999999999');

    const initialBalance = web3.utils.toWei('100000')
    const day = 24 * 60 * 60;

    const poolInfos = [
        [30, 1015, 1000, web3.utils.toWei("50000")],
        [120, 1120, 1000, web3.utils.toWei("100000")]
    ];

    let bella;
    let locker;

    const [
        deployer,
        userBackground,
        user,
    ] = accounts

    console.log(deployer)
    console.log(userBackground)
    console.log(user)

    beforeAll(async (done) => {

        bella = await deploy('MockBella', [], { from: deployer });
        locker = await deploy('BellaLockerHarness',
            [deployer, bella._address], { from: deployer });
        console.log("Contract instance obtained");
        console.log("bella: " + bella._address);
        console.log("locker: " + locker._address);

        await send(bella, 'transfer', [userBackground, initialBalance], { from: deployer });
        await send(bella, 'transfer', [user, initialBalance], { from: deployer });
        console.log("Token distributed");

        await send(bella, 'approve', [locker._address,
            u256max],
            { from: deployer });
        await send(bella, 'approve', [locker._address,
            u256max],
            { from: userBackground });
        await send(bella, 'approve', [locker._address,
            u256max],
            { from: user });

        console.log("Tokens approved");
        done()
    });

    it('can add pools', async () => {
        console.log("locker: " + locker._address);
        for (let index = 0; index < poolInfos.length; index++) {
            await send(locker, 'addSavingPool', [poolInfos[index][0], poolInfos[index][1], poolInfos[index][2], poolInfos[index][3]], { from: deployer });
        }
        console.log("Pool added");
    });

    it('other user can lock', async () => {
        await send(locker, 'lock', [web3.utils.toWei("15000"), 0], { from: userBackground });
        let remain = await call(locker, 'getCurrTypeAmountRemain', [0]);
        Utils.assertBNEq(remain, web3.utils.toWei("35000"))
        console.log("Background user locked");
    });


    it('user can lock 30 days pool', async () => {
        await send(locker, 'lock', [web3.utils.toWei("12000"), 0], { from: user });
        let lockedAmount = await call(locker, 'getUserLockedBelByType', [user, 0]);
        Utils.assertApproxBNEq(lockedAmount, web3.utils.toWei("12180"), "1000000")
        let remain = await call(locker, 'getCurrTypeAmountRemain', [0]);
        Utils.assertBNEq(remain, web3.utils.toWei("23000"));
        let unlocked = await call(locker, 'getUserUnlockedBelByType', [user, 0]);
        Utils.assertBNEq(unlocked, 0);
    });

    // it('user can not lock too much', async () => {
    //     await expectRevert(
    //         locker.lock(web3.utils.toWei("40000"), 0, { from: user }),
    //         "No more saving avaiable"
    //     );
    // });

    // it('user can lock 120 days pool', async () => {
    //     await locker.lock(web3.utils.toWei("20000"), 1, { from: user });
    //     let lockedAmount = await locker.getUserLockedBelByType(user, 1);
    //     Utils.assertApproxBNEq(lockedAmount, web3.utils.toWei("22400"), "1000000")
    //     let remain = await locker.getCurrTypeAmountRemain(1);
    //     Utils.assertBNEq(remain, web3.utils.toWei("80000"));
    //     let unlocked = await locker.getUserUnlockedBelByType(user, 1);
    //     Utils.assertBNEq(unlocked, 0);

    //     let totalUnlocked = await locker.getUserTotalUnlockedBel(user);
    //     Utils.assertBNEq(totalUnlocked, 0);
    // });

    it('user can lock again 30 days pool', async () => {
        await timeMachine.advanceTimeAndBlock(10 * day);
        await send(locker, 'lock', [web3.utils.toWei("15000"), 0], { from: user });
        let lockedAmount = await call(locker, 'getUserLockedBelByType', [user, 0]);
        Utils.assertApproxBNEq(lockedAmount, web3.utils.toWei("27405"), "1000000")
        let remain = await call(locker, 'getCurrTypeAmountRemain', [0]);
        Utils.assertBNEq(remain, web3.utils.toWei("8000"));
        let unlocked = await call(locker, 'getUserUnlockedBelByType', [user, 0]);
        Utils.assertBNEq(unlocked, 0);

        let totalUnlocked = await call(locker, 'getUserTotalUnlockedBel', [user]);
        Utils.assertBNEq(totalUnlocked, 0);
    });

    it('user can withdraw after 30 days', async () => {
        await timeMachine.advanceTimeAndBlock(25 * day);
        let lockedAmount = await call(locker, 'getUserLockedBelByType', [user, 0]);
        Utils.assertApproxBNEq(lockedAmount, web3.utils.toWei("15225"), "1000000");
        let unlocked = await call(locker, 'getUserUnlockedBelByType', [user, 0]);
        Utils.assertBNEq(unlocked, web3.utils.toWei("12180"));
        let totalUnlocked = await call(locker, 'getUserTotalUnlockedBel', [user]);
        Utils.assertBNEq(totalUnlocked, web3.utils.toWei("12180"));

        let balanceBefore = await call(bella, 'balanceOf', [user]);
        await send(locker, 'withdraw', [0], { from: user });
        let balanceAfter = await call(bella, 'balanceOf', [user]);
        Utils.assertBNEq(web3.utils.toBN(balanceAfter).sub(web3.utils.toBN(balanceBefore)), web3.utils.toWei("12180"));

        unlocked = await call(locker, 'getUserUnlockedBelByType', [user, 0]);
        Utils.assertBNEq(unlocked, 0);

        totalUnlocked = await call(locker, 'getUserTotalUnlockedBel', [user]);
        Utils.assertBNEq(totalUnlocked, 0);
    });

    // it('user can withdraw 30 days and 120 days after 120 days', async () => {
    //     await Utils.timeTravel(120 * day);
    //     let lockedAmount = await locker.getUserLockedBelByType(user, 0);
    //     Utils.assertBNEq(lockedAmount, 0);
    //     let unlocked = await locker.getUserUnlockedBelByType(user, 0);
    //     Utils.assertBNEq(unlocked, web3.utils.toWei("15225"));

    //     let lockedAmount2 = await locker.getUserLockedBelByType(user, 1);
    //     Utils.assertBNEq(lockedAmount2, 0);
    //     let unlocked2 = await locker.getUserUnlockedBelByType(user, 1);
    //     Utils.assertBNEq(unlocked2, web3.utils.toWei("22400"));

    //     let totalUnlocked = await locker.getUserTotalUnlockedBel(user);
    //     Utils.assertBNEq(totalUnlocked, web3.utils.toWei("37625"));

    //     let balanceBefore = await bella.balanceOf(user);
    //     await locker.withdraw(0, { from: user });
    //     let balanceAfter = await bella.balanceOf(user);
    //     Utils.assertBNEq(balanceAfter.sub(balanceBefore), web3.utils.toWei("15225"));

    //     totalUnlocked = await locker.getUserTotalUnlockedBel(user);
    //     Utils.assertBNEq(totalUnlocked, web3.utils.toWei("22400"));

    //     balanceBefore = await bella.balanceOf(user);
    //     await locker.withdraw(1, { from: user });
    //     balanceAfter = await bella.balanceOf(user);
    //     Utils.assertBNEq(balanceAfter.sub(balanceBefore), web3.utils.toWei("22400"));

    //     unlocked = await locker.getUserUnlockedBelByType(user, 0);
    //     Utils.assertBNEq(unlocked, 0);

    //     unlocked = await locker.getUserUnlockedBelByType(user, 1);
    //     Utils.assertBNEq(unlocked, 0);

    //     totalUnlocked = await locker.getUserTotalUnlockedBel(user);
    //     Utils.assertBNEq(totalUnlocked, web3.utils.toWei("0"));
    // });

});

// describe('Test BellaLocker Array Clean up', () => {

//     const u256max = web3.utils.toWei('9999999999999999999');

//     const initialBalance = web3.utils.toWei('100000')
//     const day = 24 * 60 * 60;

//     const poolInfos = [
//         [30, 1015, 1000, web3.utils.toWei("50000")],
//         [120, 1120, 1000, web3.utils.toWei("100000")]
//     ];

//     let bella;
//     let locker;

//     const [
//         deployer,
//         userBackground,
//         user,
//     ] = accounts

//     beforeAll(async () => {

//         bella = await deploy('MockBella');
//         locker = await deploy('BellaLockerHarness',
//             [deployer, bella.address]);
//         console.log("Contract instance obtained");

//         await bella.transfer(userBackground, initialBalance, { from: deployer });
//         await bella.transfer(user, initialBalance, { from: deployer });
//         console.log("Token distributed");

//         await bella.approve(locker.address,
//             u256max,
//             { from: deployer });
//         await bella.approve(locker.address,
//             u256max,
//             { from: userBackground });
//         await bella.approve(locker.address,
//             u256max,
//             { from: user });

//         console.log("Tokens approved");

//         for (let index = 0; index < poolInfos.length; index++) {
//             await locker.addSavingPool(poolInfos[index][0], poolInfos[index][1], poolInfos[index][2], poolInfos[index][3], { from: deployer });
//         }
//         console.log("Pool added");

//     });

//     it('user lock a lot', async () => {
//         for (let i = 0; i < 10; i++) {
//             await locker.lock(web3.utils.toWei("1000"), 0, { from: user });
//         }

//         let userSavingsLength = await locker.userSavingsLength(user, 0);
//         Utils.assertBNEq(userSavingsLength, 10)

//         await Utils.timeTravel(20 * day);

//         for (let i = 0; i < 10; i++) {
//             await locker.lock(web3.utils.toWei("1000"), 0, { from: user });
//         }

//         userSavingsLength = await locker.userSavingsLength(user, 0);
//         Utils.assertBNEq(userSavingsLength, 20)

//     });

//     it('user can withdraw after 30 days 1', async () => {

//         await Utils.timeTravel(20 * day);
//         let lockedAmount = await locker.getUserLockedBelByType(user, 0);
//         Utils.assertApproxBNEq(lockedAmount, web3.utils.toWei("10150"), "1000000");
//         let unlocked = await locker.getUserUnlockedBelByType(user, 0);
//         Utils.assertBNEq(unlocked, web3.utils.toWei("10150"));


//         let balanceBefore = await bella.balanceOf(user);
//         await locker.withdraw(0, { from: user });
//         let balanceAfter = await bella.balanceOf(user);
//         Utils.assertBNEq(balanceAfter.sub(balanceBefore), web3.utils.toWei("10150"));

//         unlocked = await locker.getUserUnlockedBelByType(user, 0);
//         Utils.assertBNEq(unlocked, 0);

//         let userSavingsLength = await locker.userSavingsLength(user, 0);
//         Utils.assertBNEq(userSavingsLength, 10)

//     });

//     it('user can withdraw after 30 days 2', async () => {

//         await Utils.timeTravel(20 * day);
//         let lockedAmount = await locker.getUserLockedBelByType(user, 0);
//         Utils.assertBNEq(lockedAmount, 0);
//         let unlocked = await locker.getUserUnlockedBelByType(user, 0);
//         Utils.assertBNEq(unlocked, web3.utils.toWei("10150"));


//         let balanceBefore = await bella.balanceOf(user);
//         await locker.withdraw(0, { from: user });
//         let balanceAfter = await bella.balanceOf(user);
//         Utils.assertBNEq(balanceAfter.sub(balanceBefore), web3.utils.toWei("10150"));

//         unlocked = await locker.getUserUnlockedBelByType(user, 0);
//         Utils.assertBNEq(unlocked, 0);

//     });



// });