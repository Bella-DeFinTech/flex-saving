pragma solidity 0.5.15;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "../libraries/Ownable.sol";

/**
 * @title BellaLocker
 * @dev lock bella for a fixed amount of time, and get bella interest
 * @notice bella rewards will be locked in advance
 */
contract BellaLocker is Ownable, ReentrancyGuard {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    // unlock amount after lock period = effectiveAmountNumerator/effectiveAmountDenominator
    struct SavingPool {
        uint256 savedAmount; 
        uint256 period; // unit in day
        uint256 effectiveAmountNumerator;
        uint256 effectiveAmountDenominator;
        uint256 maxSaving;
    }

    SavingPool[] public savingPools;

    uint256 startTime = now;

    IERC20 public bel;

    struct UserSaving {
        uint256 amount;
        uint256 unlockTime;
    }

    // user addr -> pool id -> UserSaving[]
    mapping (address => mapping (uint256=>UserSaving[])) public userSavings;

    modifier validPid(uint256 _pid) {
        require(_pid < savingPools.length, "invalid pool id");
        _;
    }

    constructor(address governence, address _bel) Ownable(governence) public {
        bel = IERC20(_bel);
    }

    /**
     * @dev add a new saving pool
     * @param _period after which user's locked bella is unlocked
     * @param _effectiveAmountNumerator _effectiveAmountNumerator/_effectiveAmountDenominator determines the interest
     * @param _effectiveAmountDenominator _effectiveAmountNumerator/_effectiveAmountDenominator determines the interest
     * @param _maxSaving max amount of saving provided by this pool
     */    
    function addSavingPool(
        uint256 _period,
        uint256 _effectiveAmountNumerator,
        uint256 _effectiveAmountDenominator,
        uint256 _maxSaving        
    ) external onlyOwner {
        require(_effectiveAmountNumerator > _effectiveAmountDenominator, "need to have some interest!");
        require(_effectiveAmountNumerator/_effectiveAmountDenominator >= 1, "need to have some interest!");
        require(_effectiveAmountNumerator/_effectiveAmountDenominator < 10, "interest too high!");

        bel.safeTransferFrom(msg.sender, address(this), 
            _maxSaving.mul(_effectiveAmountNumerator.sub(_effectiveAmountDenominator)).div(_effectiveAmountDenominator));

        SavingPool memory pool = SavingPool({
            savedAmount: 0,
            period: _period.mul(1 days),
            effectiveAmountNumerator: _effectiveAmountNumerator,
            effectiveAmountDenominator: _effectiveAmountDenominator,
            maxSaving: _maxSaving
        });
        savingPools.push(pool);
    }

    /**
     * @dev lock bella
     * @param amount The amount of bella to lock
     * @param pid id of the pool
     */
    function lock(uint256 amount, uint256 pid) external validPid(pid) nonReentrant {

        SavingPool storage pool = savingPools[pid];

        pool.savedAmount = pool.savedAmount.add(amount);
        require(pool.savedAmount <= pool.maxSaving, "No more saving avaiable");
        bel.safeTransferFrom(msg.sender, address(this), amount);

        uint256 effectiveAmount = amount.mul(pool.effectiveAmountNumerator).div(pool.effectiveAmountDenominator);
        uint256 unlockTime = pool.period.add(now);
        userSavings[msg.sender][pid].push(
            UserSaving({amount: effectiveAmount, unlockTime: unlockTime})
        );
    }
 
    /**
     * @dev withdraw all unlocked bella in a given saving pool
     * @param pid id of the pool
     */
    function withdraw(uint256 pid) external validPid(pid) nonReentrant {
        uint256 sum = 0;
        UserSaving[] storage savings = userSavings[msg.sender][pid];
        for (uint256 i=0; i < savings.length; i++) {
            if (savings[i].amount !=0 && savings[i].unlockTime <= now) {
                sum = sum.add(savings[i].amount);
                delete savings[i];
            }
        }

        if (sum != 0)
            bel.safeTransfer(msg.sender, sum);

        // clean array if len > 15 and have more than 4 zeros
        if (savings.length > 15) {
            uint256 zeros = 0;
            for (uint256 i=0; i < savings.length; i++) {
                if (savings[i].amount == 0) {
                    zeros++;
                }
            }
            if (zeros < 5)
                return;

            uint256 i = 0;
            while (i < savings.length) {
                if (savings[i].amount == 0) {
                    savings[i].amount = savings[savings.length-1].amount;
                    savings[i].unlockTime = savings[savings.length-1].unlockTime;
                    savings.pop();
                } else {
                    i++;
                }
            }         
        }
    }

     /**
     * @dev view function to get user's locked bella for a given saving type (including bonus)
     */
    function getUserLockedBelByType(address user, uint256 pid) external view validPid(pid) returns (uint256) {
        uint256 sum = 0;
        UserSaving[] storage savings = userSavings[user][pid];
        for (uint256 i=0; i < savings.length; i++) {
            if (savings[i].unlockTime > now) {
                sum = sum.add(savings[i].amount);
            }
        }
        return sum;
    }

     /**
     * @dev view function to get user's unlocked bella for a given saving type (including bonus)
     */
    function getUserUnlockedBelByType(address user, uint256 pid) public view validPid(pid) returns (uint256) {
        uint256 sum = 0;
        UserSaving[] storage savings = userSavings[user][pid];
        for (uint256 i=0; i < savings.length; i++) {
            if (savings[i].unlockTime <= now) {
                sum = sum.add(savings[i].amount);
            }
        }
        return sum;
    }

     /**
     * @dev view function to get user's total unlocked bella (including bonus)
     */
    function getUserTotalUnlockedBel(address user) external view returns (uint256) {
        uint256 sum = 0;
        for (uint256 i=0; i < savingPools.length; i++) {
            sum = sum.add(getUserUnlockedBelByType(user, i));
        }
        return sum;
    }

     /**
     * @dev view function to get current remaining lockable bella for a given saving type
     */
    function getCurrTypeAmountRemain(uint256 pid) external view validPid(pid) returns (uint256) {
        SavingPool memory pool = savingPools[pid];
        return pool.maxSaving - pool.savedAmount;
    }

     /**
     * @dev after 1.5y, rest of bella can be withdrawed
     * @param amount amount to withdraw
     */
    function withdrawDust(uint256 amount) external onlyOwner {
        require(now >= startTime.add(540 days), "not ready yet");
        bel.safeTransfer(msg.sender, amount);
    }
}