// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "./lib/ConsiderationStructs.sol";
import "./lib/ConsiderationEnums.sol";
import "./lib/ConsiderationErrors.sol";
import "./lib/PointerLibraries.sol";
import "./lib/ConsiderationConstants.sol";
import { ConsiderationBase } from "./lib/ConsiderationBase.sol";

interface IVRFInterface {
    function requestRandomWords(uint32) external returns (uint256 requestId);
}

/**
 * @title SmeMarket
 * @custom:version 1.0
 * @notice SmeMarket is a generalized ERC20/ERC721/ERC1155
 *         marketplace with lightweight methods for common routes as well as
 *         more flexible methods for composing advanced orders or groups of
 *         orders. Each order contains an arbitrary number of items that may be
 *         spent (the "offer") along with an arbitrary number of items that must
 *         be received back by the indicated recipients (the "consideration").
 */
contract SmeMarket is Ownable, ReentrancyGuard, ConsiderationBase {
    event MatchSuccessOrNot(uint256 requestId, bool isSuccess);
    event PreparedOrder(uint256 requestId, bytes32[] hashes);
    string constant NAME = "SmeMarket";
    address private _vrf_controller;

    uint256 public cancelPreparedTime = 3 hours;

    mapping(uint256 => bytes32[]) private originalOrderHashes;

    mapping(address => bool) private members;

    constructor() ConsiderationBase() {
        _transferOwnership(tx.origin);
        _vrf_controller = address(0xC619D985a88e341B618C23a543B8Efe2c55D1b37);
    }

    function setCancelPreparedTime(uint256 time) external onlyOwner {
        cancelPreparedTime = time;
    }

    /**
     * @dev Internal pure function to retrieve the name of this contract as a
     *      string that will be used to derive the name hash in the constructor.
     *
     * @return The name of this contract as a string.
     */
    function _nameString() internal pure override returns (string memory) {
        return NAME;
    }

    /**
     * @dev In the order preparation stage, transfer the offers in the order to this contract and request random numbers.
     *
     * @custom:param orders The orders to prepare.
     * @param premiumOrdersIndex preminum order index list.
     * @param recipients preminum order receipients.
     *
     * @return The name of this contract as a string.
     */
    function prepare(
        AdvancedOrder[] calldata,
        uint256[] calldata premiumOrdersIndex,
        address[] calldata recipients,
        uint32 numWords
    ) external payable onlyMembers nonReentrant returns (uint256) {
        bytes32[] memory orderHashes = prepareOrdersWithRandom(
            _toAdvancedOrdersReturnType(_decodeAdvancedOrders)(CalldataStart.pptr()),
            premiumOrdersIndex,
            recipients
        );
        uint256 requestId = IVRFInterface(_vrf_controller).requestRandomWords(numWords);
        originalOrderHashes[requestId] = orderHashes;
        emit PreparedOrder(requestId, orderHashes);
        return requestId;
    }

    function cancelPrepared(uint256 requestId, AdvancedOrder[] calldata orders) external {
        bytes32[] memory existingOrderHahes = originalOrderHashes[requestId];
        uint256 orderSize = orders.length;
        require(existingOrderHahes.length > 0, "requestId not find");
        require(existingOrderHahes.length == orders.length, "orders size error");
        unchecked {
            for (uint i = 0; i < orderSize; ++i) {
                AdvancedOrder memory order = orders[i];
                bytes32 storeHash = existingOrderHahes[i];
                bytes32 hash = _assertConsiderationLengthAndGetOrderHash(order.parameters);
                require(storeHash == hash, "Order hash not match");
                (uint120 numerator, uint120 denominator, uint256 time) = _getLastMatchStatus(hash);
                require(time > 0 && (block.timestamp - time) > cancelPreparedTime, "Wait cancel prepared time");
                if (order.parameters.consideration.length > 0) {
                    OfferItem[] memory offers = order.parameters.offer;
                    address payable recipent = payable(order.parameters.offerer);
                    for (uint j = 0; j < offers.length; ++j) {
                        OfferItem memory item = offers[j];
                        item.endAmount = _getFraction(numerator, denominator, item.endAmount);
                        _transferFromPool(_offerToReceived(item, recipent, true), address(this));
                    }
                    _restoreOriginalStatus(hash);
                    _clearLastMatchStatus(hash);
                }
            }
            delete originalOrderHashes[requestId];
        }
    }

    /**
     * @notice Match an arbitrary number of orders, each with an arbitrary
     *         number of items for offer and consideration along with a set of
     *         fulfillments allocating offer components to consideration
     *         components. Any unspent offer item amounts or native tokens will be transferred to the
     *         caller.
     *
     */
    function matchOrdersWithRandom(
        AdvancedOrder[] calldata,
        Fulfillment[] calldata,
        uint256 requestId,
        OrderProbility[] calldata orderProbility
    ) external payable onlyMembers nonReentrant {
        bytes32[] memory existingOrderHahes = originalOrderHashes[requestId];
        bool returnBack = _matchAdvancedOrdersWithRandom(
            _toAdvancedOrdersReturnType(_decodeAdvancedOrders)(CalldataStart.pptr()),
            _toFulfillmentsReturnType(_decodeFulfillments)(CalldataStart.pptr(Offset_matchOrders_fulfillments)),
            existingOrderHahes,
            orderProbility
        );
        // change this if need partial fulfillment
        uint256 totalLength = existingOrderHahes.length;
        for (uint256 i = 0; i < totalLength; ++i) {
            if (returnBack) {
                _restoreOriginalStatus(existingOrderHahes[i]);
            }
            _clearLastMatchStatus(existingOrderHahes[i]);
        }
        delete originalOrderHashes[requestId];
        emit MatchSuccessOrNot(requestId, !returnBack);
    }

    /**
     * @notice Cancel an arbitrary number of orders. Note that only the offerer
     *         or the zone of a given order may cancel it. Callers should ensure
     *         that the intended order was cancelled by calling `getOrderStatus`
     *         and confirming that `isCancelled` returns `true`.
     *
     */
    function cancel(OrderComponents[] calldata orders) external nonReentrant returns (bool cancelled) {
        // Cancel the orders.
        cancelled = _cancel(orders);
    }

    /**
     * @notice Retrieve the order hash for a given order.
     *
     */
    function getOrderHash(OrderComponents calldata) external view returns (bytes32 orderHash) {
        CalldataPointer orderPointer = CalldataStart.pptr();

        // Derive order hash by supplying order parameters along with counter.
        orderHash = _deriveOrderHash(
            _toOrderParametersReturnType(_decodeOrderComponentsAsOrderParameters)(orderPointer),
            // Read order counter
            orderPointer.offset(OrderParameters_counter_offset).readUint256()
        );
    }

    /**
     * @notice Retrieve the status of a given order by hash, including whether
     *         the order has been cancelled or validated and the fraction of the
     *         order that has been filled. Since the _orderStatus[orderHash]
     *         does not get set for contract orders, getOrderStatus will always
     *         return (false, false, 0, 0) for those hashes. Note that this
     *         function is susceptible to view reentrancy and so should be used
     *         with care when calling from other contracts.
     */
    function getOrderStatus(
        bytes32 orderHash
    ) external view returns (bool isValidated, bool isCancelled, uint256 totalFilled, uint256 totalSize) {
        // Retrieve the order status using the order hash.
        return _getOrderStatus(orderHash);
    }

    /**
     * @notice Retrieve the current counter for a given offerer.
     */
    function getCounter(address offerer) external view returns (uint256 counter) {
        // Return the counter for the supplied offerer.
        counter = _getCounter(offerer);
    }

    /**
     * @notice Retrieve configuration information for this contract.
     *
     */
    function information() external view returns (string memory version, bytes32 domainSeparator) {
        // Return the information for this contract.
        return _information();
    }

    /**
     * @notice Retrieve the name of this contract.
     *
     * @return contractName The name of this contract.
     */
    function name() external pure returns (string memory /* contractName */) {
        // Return the name of the contract.
        return _nameString();
    }

    modifier onlyMembers() {
        require(members[msg.sender], Error_OnlyMembersCallMatch);
        _;
    }

    function vrfOwner() public view returns (address) {
        return _vrf_controller;
    }

    function updateVRFAddress(address vrfController) public onlyOwner {
        _vrf_controller = vrfController;
    }

    function addMember(address addr) public onlyOwner {
        members[addr] = true;
    }

    function removeMember(address addr) public onlyOwner {
        delete members[addr];
    }

    function onERC1155Received(
        address operator,
        address from,
        uint256 id,
        uint256 value,
        bytes calldata data
    ) external pure returns (bytes4) {
        return this.onERC1155Received.selector;
    }

    /**
     * @notice Verify the order and transfer assets to this contract.
     *
     * @param advancedOrders The orders for maker and taker and preminum order.
     * @param premiumOrderIndexes Specify which order is the priminum order.
     * @param recipients Specify the asset recipient of the priminum order.
     *
     * @return orderHashes order hashes
     */
    function prepareOrdersWithRandom(
        AdvancedOrder[] memory advancedOrders,
        uint256[] memory premiumOrderIndexes,
        address[] memory recipients
    ) internal returns (bytes32[] memory orderHashes) {
        // Declare variables for later use.
        AdvancedOrder memory advancedOrder;
        uint256 terminalMemoryOffset;
        uint256 totalOrders;
        uint256 totalPreminum;
        uint256[] memory _premiumOrderRecipentSort;
        unchecked {
            // Read length of orders array and place on the stack.
            totalOrders = advancedOrders.length;
            totalPreminum = premiumOrderIndexes.length;
            orderHashes = new bytes32[](totalOrders);
            terminalMemoryOffset = (totalOrders + 1) << OneWordShift;
        }

        // Skip overflow checks as all for loops are indexed starting at zero.
        unchecked {
            if (totalPreminum > 0) {
                require(totalPreminum == recipients.length, Error_InvalidPreminumRecipent);
                _premiumOrderRecipentSort = new uint256[](totalOrders);
                for (uint256 i = 0; i < totalPreminum; ++i) {
                    uint256 orderIndex = premiumOrderIndexes[i];
                    require(advancedOrders[orderIndex].parameters.consideration.length == 0, Error_InvalidPreminum);
                    _premiumOrderRecipentSort[orderIndex] = (i + 1);
                }
            }
            // Declare inner variables.
            OfferItem[] memory offer;
            // orderIndex
            uint256 oi = 0;
            // Iterate over each order.
            for (uint256 i = OneWord; i < terminalMemoryOffset; i += OneWord) {
                // Retrieve order using assembly to bypass out-of-range check.
                assembly {
                    advancedOrder := mload(add(advancedOrders, i))
                }
                // Validate it, update status, and determine fraction to fill.
                (bytes32 orderHash, uint120 numerator, uint120 denominator) = _validateOrderAndUpdateStatus(
                    advancedOrder,
                    true
                );
                if (numerator == 0) {
                    advancedOrder.numerator = 0;
                    continue;
                }

                // Otherwise, track the order hash in question.
                assembly {
                    mstore(add(orderHashes, i), orderHash)
                }

                _storeLastMatchStatus(orderHash, numerator, denominator);

                // Retrieve array of offer items for the order in question.
                offer = advancedOrder.parameters.offer;

                // Read length of offer array and place on the stack.
                uint256 totalOfferItems = offer.length;
                bool offerIsLucky = false;
                // Iterate over each offer item on the order.

                // recipient
                address payable recipent = (totalPreminum > 0 && _premiumOrderRecipentSort[oi] > 0)
                    ? payable(recipients[_premiumOrderRecipentSort[oi] - 1])
                    : payable(address(this));

                for (uint256 j = 0; j < totalOfferItems; ++j) {
                    // Retrieve the offer item.
                    OfferItem memory offerItem = offer[j];
                    require(offerItem.endAmount >= offerItem.startAmount, Error_AmountRange);
                    require(offerItem.itemType <= ItemType.ERC1155, Error_OfferCriteria);
                    if (offerItem.startAmount != offerItem.endAmount) {
                        offerIsLucky = true;
                    }

                    offerItem.startAmount = _getFraction(numerator, denominator, offerItem.endAmount);
                    // Lock offer item to the contract and store for partial info
                    _transfer(_offerToReceived(offerItem, recipent, false), advancedOrder.parameters.offerer);
                }
                ConsiderationItem[] memory considerations = advancedOrder.parameters.consideration;
                bool considerationIsLucky = false;
                for (uint256 k = 0; k < considerations.length; ++k) {
                    ConsiderationItem memory consideration = considerations[k];
                    require(consideration.endAmount >= consideration.startAmount, Error_AmountRange);
                    if (consideration.startAmount != consideration.endAmount) {
                        considerationIsLucky = true;
                    }
                }
                require(!(offerIsLucky && considerationIsLucky), Error_SimultaneousRandom);
                ++oi;
            }
        }
    }

    /**
     * @dev Internal function to fulfill an arbitrary number of orders, either
     *      full or partial, after validating, adjusting amounts, and applying
     *      criteria resolvers.
     *
     * @param advancedOrders  The orders to match, including a fraction to
     *                        attempt to fill for each order.
     * @param fulfillments    An array of elements allocating offer components
     *                        to consideration components. Note that the final
     *                        amount of each consideration component must be
     *                        zero for a match operation to be considered valid.
     *
     * @return returnBack
     */
    function _fulfillAdvancedOrdersWithRandom(
        AdvancedOrder[] memory advancedOrders,
        Fulfillment[] memory fulfillments
    ) internal returns (bool returnBack) {
        // Retrieve fulfillments array length and place on the stack.
        uint256 totalFulfillments = fulfillments.length;

        // Skip overflow checks as all for loops are indexed starting at zero.
        unchecked {
            // Iterate over each fulfillment.
            // if not returnBack need to offer back amount;
            for (uint256 i = 0; i < totalFulfillments; ++i) {
                /// Retrieve the fulfillment in question.
                Fulfillment memory fulfillment = fulfillments[i];
                require(
                    fulfillment.offerComponents.length == 1 && fulfillment.considerationComponents.length == 1,
                    Error_FufillmentData
                );
                FulfillmentComponent memory offerFc = fulfillment.offerComponents[0];
                FulfillmentComponent memory considerationFc = fulfillment.considerationComponents[0];
                OfferItem memory offer = advancedOrders[offerFc.orderIndex].parameters.offer[offerFc.itemIndex];
                ConsiderationItem memory consideration = advancedOrders[considerationFc.orderIndex]
                    .parameters
                    .consideration[considerationFc.itemIndex];
                // apply erc721 criteria
                if (consideration.itemType == ItemType.ERC721_WITH_CRITERIA) {
                    // consideration.itemType = ItemType.ERC721;
                    // consideration.identifierOrCriteria = offer.identifierOrCriteria;
                    if (
                        offer.itemType != ItemType.ERC721 || (uint160(offer.token) ^ uint160(consideration.token)) != 0
                    ) {
                        _revertMismatchedFulfillmentOfferAndConsiderationComponents(i);
                    }
                } else {
                    if (
                        ((uint8(offer.itemType) ^ uint8(consideration.itemType)) |
                            (uint160(offer.token) ^ uint160(consideration.token)) |
                            (offer.identifierOrCriteria ^ consideration.identifierOrCriteria)) != 0
                    ) {
                        _revertMismatchedFulfillmentOfferAndConsiderationComponents(i);
                    }
                }
                // fulfill consideration ()
                if (consideration.endAmount != 0) {
                    if (offer.endAmount < consideration.endAmount) {
                        consideration.endAmount = consideration.endAmount - offer.endAmount;
                        offer.endAmount = 0;
                    } else {
                        offer.endAmount = offer.endAmount - consideration.endAmount;
                        consideration.endAmount = 0;
                    }
                }
            }
            uint256 totalOders = advancedOrders.length;
            // check need back
            for (uint i = 0; i < totalOders; ++i) {
                ConsiderationItem[] memory cList = advancedOrders[i].parameters.consideration;
                for (uint j = 0; j < cList.length; j++) {
                    if (cList[j].endAmount != 0) {
                        returnBack = true;
                    }
                }
            }

            if (returnBack) {
                for (uint i = 0; i < totalOders; ++i) {
                    // back offer
                    OfferItem[] memory cList = advancedOrders[i].parameters.offer;
                    address recipent = advancedOrders[i].parameters.offerer;
                    for (uint j = 0; j < cList.length; ++j) {
                        _transferFromPool(_offerToReceived(cList[j], payable(recipent), false), address(this));
                    }
                }
            } else {
                for (uint i = 0; i < totalFulfillments; ++i) {
                    Fulfillment memory fulfillment = fulfillments[i];
                    FulfillmentComponent memory offerFc = fulfillment.offerComponents[0];
                    FulfillmentComponent memory considerationFc = fulfillment.considerationComponents[0];
                    OfferItem memory offer = advancedOrders[offerFc.orderIndex].parameters.offer[offerFc.itemIndex];
                    ConsiderationItem memory consideration = advancedOrders[considerationFc.orderIndex]
                        .parameters
                        .consideration[considerationFc.itemIndex];
                    // transfer fulfilled consideration
                    if (consideration.itemType == ItemType.ERC721_WITH_CRITERIA) {
                        _transferFromPool(_offerToReceived(offer, consideration.recipient, false), address(this));
                    } else if (consideration.startAmount > 0) {
                        _transferFromPool(_considerationToReceived(consideration), address(this));
                        consideration.startAmount = 0;
                    }
                    // backe unused offer
                    if (offer.endAmount > 0) {
                        _transferFromPool(
                            _offerToReceived(
                                offer,
                                payable(advancedOrders[offerFc.orderIndex].parameters.offerer),
                                true
                            ),
                            address(this)
                        );
                        offer.endAmount = 0;
                    }
                }
            }
        }
    }

    /**
     * @dev Internal function to match an arbitrary number of full or partial
     *      orders, each with an arbitrary number of items for offer and
     *      consideration, supplying criteria resolvers containing specific
     *      token identifiers and associated proofs as well as fulfillments
     *      allocating offer components to consideration components.
     *
     */
    function _matchAdvancedOrdersWithRandom(
        AdvancedOrder[] memory advancedOrders,
        Fulfillment[] memory fulfillments,
        bytes32[] memory existingOrderHahes,
        OrderProbility[] memory orderProbility
    ) internal returns (bool returnBack) {
        // Validate orders, update order status, and determine item amounts.
        _validateOrdersAndFulfillWithRandom(advancedOrders, existingOrderHahes, advancedOrders.length, orderProbility);
        // _logOrders(advancedOrders);
        // Fulfill the orders using the supplied fulfillments and recipient.
        return _fulfillAdvancedOrdersWithRandom(advancedOrders, fulfillments);
    }

    /**
     * @dev Check order and update start,end of orderProbility
     *
     */
    function _validateOrdersAndFulfillWithRandom(
        AdvancedOrder[] memory advancedOrders,
        bytes32[] memory existingOrderHahes,
        uint256 maximumFulfilled,
        OrderProbility[] memory orderProbility
    ) internal view {
        // Declare an error buffer indicating status of any native offer items.
        // Native tokens may only be provided as part of contract orders or when
        // fulfilling via matchOrders or matchAdvancedOrders; if bits indicating
        // these conditions are not met have been set, throw.
        uint256 invalidNativeOfferItemErrorBuffer;

        // Use assembly to set the value for the second bit of the error buffer.
        assembly {
            /**
             * Use the 231st bit of the error buffer to indicate whether the
             * current function is not matchAdvancedOrders or matchOrders.
             *
             * sig                                func
             * -----------------------------------------------------------------
             * 1010100000010111010001000 0 000100 matchOrders
             * 1111001011010001001010110 0 010010 matchAdvancedOrders
             * 1110110110011000101001010 1 110100 fulfillAvailableOrders
             * 1000011100100000000110110 1 000001 fulfillAvailableAdvancedOrders
             *                           ^ 7th bit
             */
            invalidNativeOfferItemErrorBuffer := and(NonMatchSelector_MagicMask, calldataload(0))
        }

        // Declare variables for later use.
        AdvancedOrder memory advancedOrder;
        uint256 terminalMemoryOffset;

        unchecked {
            // Read length of orders array and place on the stack.
            uint256 totalOrders = advancedOrders.length;

            // Determine the memory offset to terminate on during loops.
            terminalMemoryOffset = (totalOrders + 1) << OneWordShift;
        }

        // Skip overflow checks as all for loops are indexed starting at zero.
        unchecked {
            // Declare inner variables.
            OfferItem[] memory offer;
            ConsiderationItem[] memory consideration;

            // Iterate over each order.
            for (uint256 i = OneWord; i < terminalMemoryOffset; i += OneWord) {
                // Retrieve order using assembly to bypass out-of-range check.
                assembly {
                    advancedOrder := mload(add(advancedOrders, i))
                }

                // Determine if max number orders have already been fulfilled.
                if (maximumFulfilled == 0) {
                    // Mark fill fraction as zero as the order will not be used.
                    advancedOrder.numerator = 0;

                    // Continue iterating through the remaining orders.
                    continue;
                }

                // Validate it, update status, and determine fraction to fill.
                OrderParameters memory orderParameters = advancedOrder.parameters;
                bytes32 orderHash = _assertConsiderationLengthAndGetOrderHash(orderParameters);
                require(checkIfOrderHashesExists(existingOrderHahes, orderHash), Error_OrdersForRqurestId);
                (uint256 numerator, uint256 denominator, ) = _getLastMatchStatus(orderHash);
                (bool hasLucky, uint256 luckyNumerator, uint256 luckyDenominator) = checkIfProbilityExists(
                    orderProbility,
                    orderHash
                );

                // Do not track hash or adjust prices if order is not fulfilled.
                if (numerator == 0) {
                    // Mark fill fraction as zero if the order is not fulfilled.
                    advancedOrder.numerator = 0;

                    // Continue iterating through the remaining orders.
                    continue;
                }

                // Decrement the number of fulfilled orders.
                // Skip underflow check as the condition before
                // implies that maximumFulfilled > 0.
                --maximumFulfilled;

                // Retrieve array of offer items for the order in question.
                offer = advancedOrder.parameters.offer;

                // Read length of offer array and place on the stack.
                uint256 totalOfferItems = offer.length;

                // Iterate over each offer item on the order.
                for (uint256 j = 0; j < totalOfferItems; ++j) {
                    // Retrieve the offer item.
                    OfferItem memory offerItem = offer[j];
                    // Apply order fill fraction to offer item end amount.
                    uint256 endAmount = _getFraction(numerator, denominator, offerItem.endAmount);
                    // offer use endAmount
                    offerItem.startAmount = endAmount;
                    offerItem.endAmount = endAmount;
                }

                consideration = (advancedOrder.parameters.consideration);
                uint256 totalConsiderationItems = consideration.length;
                // Iterate over each consideration item on the order.
                for (uint256 j = 0; j < totalConsiderationItems; ++j) {
                    ConsiderationItem memory considerationItem = (consideration[j]);
                    // Apply fraction to consideration item end amount.
                    // consideration use lucky amount , notLucky use startAmount
                    uint256 startAmount = _getFraction(numerator, denominator, considerationItem.startAmount);
                    uint256 currentAmount;
                    if (hasLucky) {
                        uint256 endAmount = considerationItem.startAmount == considerationItem.endAmount
                            ? startAmount
                            : _getFraction(numerator, denominator, considerationItem.endAmount);
                        currentAmount = _locateLuckyAmount(
                            startAmount,
                            endAmount,
                            luckyNumerator,
                            luckyDenominator,
                            true // round up
                        );
                    } else {
                        currentAmount = startAmount;
                    }
                    considerationItem.startAmount = currentAmount;
                    considerationItem.endAmount = currentAmount;
                }
            }
        }

        // If the first bit is set, a native offer item was encountered on an
        // order that is not a contract order. If the 231st bit is set in the
        // error buffer, the current function is not matchOrders or
        // matchAdvancedOrders. If the value is 1 + (1 << 230), then both the
        // 1st and 231st bits were set; in that case, revert with an error.
        if (invalidNativeOfferItemErrorBuffer == NonMatchSelector_InvalidErrorValue) {
            _revertInvalidNativeOfferItem();
        }
    }

    /**
     * @dev According to startAmount, endAmount, random numberator,random denominator, calculates the final amount
     *
     * @param startAmount       The starting amount of the item.
     * @param endAmount         The ending amount of the item.
     * @param luckyNumerator    The random numberator of the order.
     * @param luckyDenominator  The random denominator of the order.
     * @param roundUp     A boolean indicating whether the resultant amount should be rounded up or down.
     *
     * @return amount The final amount.
     */
    function _locateLuckyAmount(
        uint256 startAmount,
        uint256 endAmount,
        uint256 luckyNumerator,
        uint256 luckyDenominator,
        bool roundUp
    ) internal pure returns (uint256 amount) {
        // Only modify end amount if it doesn't already equal start amount.
        if (startAmount != endAmount) {
            if (luckyNumerator != luckyDenominator) {
                // Aggregate new amounts weighted by time with rounding factor.
                uint256 totalBeforeDivision = ((startAmount * luckyDenominator) +
                    (endAmount * luckyNumerator) -
                    (startAmount * luckyNumerator));

                // Use assembly to combine operations and skip divide-by-zero check.
                assembly {
                    // Multiply by iszero(iszero(totalBeforeDivision)) to ensure
                    // amount is set to zero if totalBeforeDivision is zero,
                    // as intermediate overflow can occur if it is zero.
                    amount := mul(
                        iszero(iszero(totalBeforeDivision)),
                        add(div(sub(totalBeforeDivision, roundUp), luckyDenominator), roundUp)
                    )
                }

                // Return the current amount.
                return amount;
            }
        }
        // Return the original amount as startAmount == endAmount.
        return endAmount;
    }

    /**
     * check random and return hasRandom,numerator,denominator for order hash
     *
     * @param orderProbility random list
     * @param orderHash order hash
     * @return bool hasRandom
     * @return uint256 numerator
     * @return uint256 denominator
     */
    function checkIfProbilityExists(
        OrderProbility[] memory orderProbility,
        bytes32 orderHash
    ) internal pure returns (bool, uint256, uint256) {
        for (uint i = 0; i < orderProbility.length; i++) {
            if (orderProbility[i].orderHash == orderHash) {
                require(
                    orderProbility[i].numerator <= orderProbility[i].denominator && orderProbility[i].denominator > 0,
                    Error_OrderProbility
                );
                return (true, orderProbility[i].numerator, orderProbility[i].denominator);
            }
        }
        return (false, 1, 1);
    }

    /**
     * check target hash in hash list
     *
     * @param orderHashes order hash list
     * @param orderHash target hash
     */
    function checkIfOrderHashesExists(bytes32[] memory orderHashes, bytes32 orderHash) internal pure returns (bool) {
        for (uint i = 0; i < orderHashes.length; ++i) {
            if (orderHashes[i] == orderHash) {
                return true;
            }
        }
        return false;
    }
}
