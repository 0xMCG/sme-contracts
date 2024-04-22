// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

uint256 constant Error_selector_offset = 0x1c;

/*
 *  error MismatchedFulfillmentOfferAndConsiderationComponents(
 *      uint256 fulfillmentIndex
 *  )
 *    - Defined in FulfillmentApplicationErrors.sol
 *  Memory layout:
 *    - 0x00: Left-padded selector (data begins at 0x1c)
 *    - 0x20: fulfillmentIndex
 * Revert buffer is memory[0x1c:0x40]
 */
uint256 constant MismatchedOfferAndConsiderationComponents_error_selector = (0xbced929d);
uint256 constant MismatchedOfferAndConsiderationComponents_error_idx_ptr = 0x20;
uint256 constant MismatchedOfferAndConsiderationComponents_error_length = 0x24;


/*
 *  error InvalidContractOrder(bytes32 orderHash)
 *    - Defined in ZoneInteractionErrors.sol
 *  Memory layout:
 *    - 0x00: Left-padded selector (data begins at 0x1c)
 *    - 0x20: orderHash
 * Revert buffer is memory[0x1c:0x40]
 */
uint256 constant InvalidContractOrder_error_selector = 0x93979285;
uint256 constant InvalidContractOrder_error_orderHash_ptr = 0x20;
uint256 constant InvalidContractOrder_error_length = 0x24;

/*
 *  error BadSignatureV(uint8 v)
 *    - Defined in SignatureVerificationErrors.sol
 *  Memory layout:
 *    - 0x00: Left-padded selector (data begins at 0x1c)
 *    - 0x20: v
 * Revert buffer is memory[0x1c:0x40]
 */
uint256 constant BadSignatureV_error_selector = 0x1f003d0a;
uint256 constant BadSignatureV_error_v_ptr = 0x20;
uint256 constant BadSignatureV_error_length = 0x24;

/*
 *  error InvalidSigner()
 *    - Defined in SignatureVerificationErrors.sol
 *  Memory layout:
 *    - 0x00: Left-padded selector (data begins at 0x1c)
 * Revert buffer is memory[0x1c:0x20]
 */
uint256 constant InvalidSigner_error_selector = 0x815e1d64;
uint256 constant InvalidSigner_error_length = 0x04;

/*
 *  error InvalidSignature()
 *    - Defined in SignatureVerificationErrors.sol
 *  Memory layout:
 *    - 0x00: Left-padded selector (data begins at 0x1c)
 * Revert buffer is memory[0x1c:0x20]
 */
uint256 constant InvalidSignature_error_selector = 0x8baa579f;
uint256 constant InvalidSignature_error_length = 0x04;

/*
 *  error BadContractSignature()
 *    - Defined in SignatureVerificationErrors.sol
 *  Memory layout:
 *    - 0x00: Left-padded selector (data begins at 0x1c)
 * Revert buffer is memory[0x1c:0x20]
 */
uint256 constant BadContractSignature_error_selector = 0x4f7fb80d;
uint256 constant BadContractSignature_error_length = 0x04;

/*
 *  error InvalidERC721TransferAmount(uint256 amount)
 *    - Defined in TokenTransferrerErrors.sol
 *  Memory layout:
 *    - 0x00: Left-padded selector (data begins at 0x1c)
 *    - 0x20: amount
 * Revert buffer is memory[0x1c:0x40]
 */
uint256 constant InvalidERC721TransferAmount_error_selector = 0x69f95827;
uint256 constant InvalidERC721TransferAmount_error_amount_ptr = 0x20;
uint256 constant InvalidERC721TransferAmount_error_length = 0x24;

/*
 *  error MissingItemAmount()
 *    - Defined in TokenTransferrerErrors.sol
 *  Memory layout:
 *    - 0x00: Left-padded selector (data begins at 0x1c)
 * Revert buffer is memory[0x1c:0x20]
 */
uint256 constant MissingItemAmount_error_selector = 0x91b3e514;
uint256 constant MissingItemAmount_error_length = 0x04;

/*
 *  error UnusedItemParameters()
 *    - Defined in TokenTransferrerErrors.sol
 *  Memory layout:
 *    - 0x00: Left-padded selector (data begins at 0x1c)
 * Revert buffer is memory[0x1c:0x20]
 */
uint256 constant UnusedItemParameters_error_selector = 0x6ab37ce7;
uint256 constant UnusedItemParameters_error_length = 0x04;


/*
 *  error OrderAlreadyFilled(bytes32 orderHash)
 *    - Defined in ConsiderationEventsAndErrors.sol
 *  Memory layout:
 *    - 0x00: Left-padded selector (data begins at 0x1c)
 *    - 0x20: orderHash
 * Revert buffer is memory[0x1c:0x40]
 */
uint256 constant OrderAlreadyFilled_error_selector = 0x10fda3e1;
uint256 constant OrderAlreadyFilled_error_orderHash_ptr = 0x20;
uint256 constant OrderAlreadyFilled_error_length = 0x24;

/*
 *  error InvalidTime(uint256 startTime, uint256 endTime)
 *    - Defined in ConsiderationEventsAndErrors.sol
 *  Memory layout:
 *    - 0x00: Left-padded selector (data begins at 0x1c)
 *    - 0x20: startTime
 *    - 0x40: endTime
 * Revert buffer is memory[0x1c:0x60]
 */
uint256 constant InvalidTime_error_selector = 0x21ccfeb7;
uint256 constant InvalidTime_error_startTime_ptr = 0x20;
uint256 constant InvalidTime_error_endTime_ptr = 0x40;
uint256 constant InvalidTime_error_length = 0x44;

/*
 *  error MissingOriginalConsiderationItems()
 *    - Defined in ConsiderationEventsAndErrors.sol
 *  Memory layout:
 *    - 0x00: Left-padded selector (data begins at 0x1c)
 * Revert buffer is memory[0x1c:0x20]
 */
uint256 constant MissingOriginalConsiderationItems_error_selector = 0x466aa616;
uint256 constant MissingOriginalConsiderationItems_error_length = 0x04;


/*
 *  error NativeTokenTransferGenericFailure(address account, uint256 amount)
 *    - Defined in ConsiderationEventsAndErrors.sol
 *  Memory layout:
 *    - 0x00: Left-padded selector (data begins at 0x1c)
 *    - 0x20: account
 *    - 0x40: amount
 * Revert buffer is memory[0x1c:0x60]
 */
uint256 constant NativeTokenTransferGenericFailure_error_selector = 0xbc806b96;
uint256 constant NativeTokenTransferGenericFailure_error_account_ptr = 0x20;
uint256 constant NativeTokenTransferGenericFailure_error_amount_ptr = 0x40;
uint256 constant NativeTokenTransferGenericFailure_error_length = 0x44;

/*
 *  error PartialFillsNotEnabledForOrder()
 *    - Defined in ConsiderationEventsAndErrors.sol
 *  Memory layout:
 *    - 0x00: Left-padded selector (data begins at 0x1c)
 * Revert buffer is memory[0x1c:0x20]
 */
uint256 constant PartialFillsNotEnabledForOrder_error_selector = 0xa11b63ff;
uint256 constant PartialFillsNotEnabledForOrder_error_length = 0x04;

/*
 *  error OrderIsCancelled(bytes32 orderHash)
 *    - Defined in ConsiderationEventsAndErrors.sol
 *  Memory layout:
 *    - 0x00: Left-padded selector (data begins at 0x1c)
 *    - 0x20: orderHash
 * Revert buffer is memory[0x1c:0x40]
 */
uint256 constant OrderIsCancelled_error_selector = 0x1a515574;
uint256 constant OrderIsCancelled_error_orderHash_ptr = 0x20;
uint256 constant OrderIsCancelled_error_length = 0x24;

/*
 *  error OrderPartiallyFilled(bytes32 orderHash)
 *    - Defined in ConsiderationEventsAndErrors.sol
 *  Memory layout:
 *    - 0x00: Left-padded selector (data begins at 0x1c)
 *    - 0x20: orderHash
 * Revert buffer is memory[0x1c:0x40]
 */
uint256 constant OrderPartiallyFilled_error_selector = 0xee9e0e63;
uint256 constant OrderPartiallyFilled_error_orderHash_ptr = 0x20;
uint256 constant OrderPartiallyFilled_error_length = 0x24;

/*
 *  error CannotCancelOrder()
 *    - Defined in ConsiderationEventsAndErrors.sol
 *  Memory layout:
 *    - 0x00: Left-padded selector (data begins at 0x1c)
 * Revert buffer is memory[0x1c:0x20]
 */
uint256 constant CannotCancelOrder_error_selector = 0xfed398fc;
uint256 constant CannotCancelOrder_error_length = 0x04;

/*
 *  error BadFraction()
 *    - Defined in ConsiderationEventsAndErrors.sol
 *  Memory layout:
 *    - 0x00: Left-padded selector (data begins at 0x1c)
 * Revert buffer is memory[0x1c:0x20]
 */
uint256 constant BadFraction_error_selector = 0x5a052b32;
uint256 constant BadFraction_error_length = 0x04;



/*
 *  error InvalidNativeOfferItem()
 *    - Defined in ConsiderationEventsAndErrors.sol
 *  Memory layout:
 *    - 0x00: Left-padded selector (data begins at 0x1c)
 * Revert buffer is memory[0x1c:0x20]
 */
uint256 constant InvalidNativeOfferItem_error_selector = 0x12d3f5a3;
uint256 constant InvalidNativeOfferItem_error_length = 0x04;


/*
 *  error Panic(uint256 code)
 *    - Built-in Solidity error
 *  Memory layout:
 *    - 0x00: Left-padded selector (data begins at 0x1c)
 *    - 0x20: code
 * Revert buffer is memory[0x1c:0x40]
 */
uint256 constant Panic_error_selector = 0x4e487b71;
uint256 constant Panic_error_code_ptr = 0x20;
uint256 constant Panic_error_length = 0x24;

uint256 constant Panic_arithmetic = 0x11;
// uint256 constant Panic_resource = 0x41;
