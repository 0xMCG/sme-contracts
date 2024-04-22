// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

/*
 * -------------------------- Disambiguation & Other Notes ---------------------
 *    - The term "head" is used as it is in the documentation for ABI encoding,
 *      but only in reference to dynamic types, i.e. it always refers to the
 *      offset or pointer to the body of a dynamic type. In calldata, the head
 *      is always an offset (relative to the parent object), while in memory,
 *      the head is always the pointer to the body. More information found here:
 *      https://docs.soliditylang.org/en/v0.8.17/abi-spec.html#argument-encoding
 *        - Note that the length of an array is separate from and precedes the
 *          head of the array.
 *
 *    - The term "body" is used in place of the term "head" used in the ABI
 *      documentation. It refers to the start of the data for a dynamic type,
 *      e.g. the first word of a struct or the first word of the first element
 *      in an array.
 *
 *    - The term "pointer" is used to describe the absolute position of a value
 *      and never an offset relative to another value.
 *        - The suffix "_ptr" refers to a memory pointer.
 *        - The suffix "_cdPtr" refers to a calldata pointer.
 *
 *    - The term "offset" is used to describe the position of a value relative
 *      to some parent value. For example, OrderParameters_conduit_offset is the
 *      offset to the "conduit" value in the OrderParameters struct relative to
 *      the start of the body.
 *        - Note: Offsets are used to derive pointers.
 *
 *    - Some structs have pointers defined for all of their fields in this file.
 *      Lines which are commented out are fields that are not used in the
 *      codebase but have been left in for readability.
 */

// Declare constants for name, version, and reentrancy sentinel values.

// Name is right padded, so it touches the length which is left padded. This
// enables writing both values at once. Length goes at byte 95 in memory, and
// name fills bytes 96-109, so both values can be written left-padded to 77.

uint256 constant information_version_offset = 0;
uint256 constant information_version_cd_offset = 0x40;
uint256 constant information_domainSeparator_offset = 0x20;
uint256 constant information_versionLengthPtr = 0x43;
uint256 constant information_versionWithLength = 0x03322e30; // 2.0
uint256 constant information_length = 0x80;

uint256 constant Offset_matchOrders_fulfillments = 0x20;

uint256 constant Common_token_offset = 0x20;
uint256 constant Common_identifier_offset = 0x40;
uint256 constant Common_amount_offset = 0x60;
uint256 constant Common_endAmount_offset = 0x80;

uint256 constant SpentItem_size = 0x80;
uint256 constant SpentItem_size_shift = 0x7;

uint256 constant OfferItem_size = 0xa0;
uint256 constant OfferItem_size_with_length = 0xc0;

uint256 constant ReceivedItem_size_excluding_recipient = 0x80;
uint256 constant ReceivedItem_size = 0xa0;
uint256 constant ReceivedItem_amount_offset = 0x60;
uint256 constant ReceivedItem_recipient_offset = 0x80;

uint256 constant ReceivedItem_CommonParams_size = 0x60;

uint256 constant ConsiderationItem_size = 0xc0;
uint256 constant ConsiderationItem_size_with_length = 0xe0;

uint256 constant ConsiderationItem_recipient_offset = 0xa0;
// Store the same constant in an abbreviated format for a line length fix.
uint256 constant ConsiderItem_recipient_offset = 0xa0;

uint256 constant Execution_offerer_offset = 0x20;
uint256 constant Execution_conduit_offset = 0x40;

// uint256 constant OrderParameters_offerer_offset = 0x00;
uint256 constant OrderParameters_offer_head_offset = 0x20;
uint256 constant OrderParameters_consideration_head_offset = 0x40;
// uint256 constant OrderParameters_orderType_offset = 0x60;
uint256 constant OrderParameters_startTime_offset = 0x80;
uint256 constant OrderParameters_endTime_offset = 0xa0;
uint256 constant OrderParameters_counter_offset = 0xe0;

uint256 constant Fulfillment_itemIndex_offset = 0x20;

uint256 constant AdvancedOrder_head_size = 0xa0;
uint256 constant AdvancedOrder_numerator_offset = 0x20;
uint256 constant AdvancedOrder_denominator_offset = 0x40;
uint256 constant AdvancedOrder_signature_offset = 0x60;
uint256 constant AdvancedOrder_extraData_offset = 0x80;

uint256 constant OrderStatus_ValidatedAndNotCancelled = 1;
uint256 constant OrderStatus_filledNumerator_offset = 0x10;
uint256 constant OrderStatus_filledDenominator_offset = 0x88;

uint256 constant ThirtyOneBytes = 0x1f;
uint256 constant OneWord = 0x20;
uint256 constant TwoWords = 0x40;
uint256 constant ThreeWords = 0x60;
uint256 constant FourWords = 0x80;
uint256 constant FiveWords = 0xa0;

uint256 constant OneWordShift = 0x5;
uint256 constant TwoWordsShift = 0x6;

uint256 constant SixtyThreeBytes = 0x3f;
uint256 constant OnlyFullWordMask = 0xffffffe0;

uint256 constant FreeMemoryPointerSlot = 0x40;
uint256 constant ZeroSlot = 0x60;
uint256 constant DefaultFreeMemoryPointer = 0x80;

uint256 constant Slot0x80 = 0x80;
uint256 constant Slot0xA0 = 0xa0;

// uint256 constant BasicOrder_endAmount_cdPtr = 0x104;
uint256 constant BasicOrder_common_params_size = 0xa0;
uint256 constant BasicOrder_considerationHashesArray_ptr = 0x160;
uint256 constant BasicOrder_receivedItemByteMap = (0x0000010102030000000000000000000000000000000000000000000000000000);
uint256 constant BasicOrder_offeredItemByteMap = (0x0203020301010000000000000000000000000000000000000000000000000000);

bytes32 constant OrdersMatchedTopic0 = (0x4b9f2d36e1b4c93de62cc077b00b1a91d84b6c31b4a14e012718dcca230689e7);

uint256 constant EIP712_Order_size = 0x120;
uint256 constant EIP712_OfferItem_size = 0xc0;
uint256 constant EIP712_ConsiderationItem_size = 0xe0;
uint256 constant AdditionalRecipient_size = 0x40;
uint256 constant AdditionalRecipient_size_shift = 0x6;

uint256 constant EIP712_DomainSeparator_offset = 0x02;
uint256 constant EIP712_OrderHash_offset = 0x22;
uint256 constant EIP712_DigestPayload_size = 0x42;

uint256 constant EIP712_domainData_nameHash_offset = 0x20;
uint256 constant EIP712_domainData_versionHash_offset = 0x40;
uint256 constant EIP712_domainData_chainId_offset = 0x60;
uint256 constant EIP712_domainData_verifyingContract_offset = 0x80;
uint256 constant EIP712_domainData_size = 0xa0;


// Signature-related
bytes32 constant EIP2098_allButHighestBitMask = (0x7fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff);
bytes32 constant ECDSA_twentySeventhAndTwentyEighthBytesSet = (
    0x0000000000000000000000000000000000000000000000000000000101000000
);
uint256 constant ECDSA_MaxLength = 65;
uint256 constant ECDSA_signature_s_offset = 0x40;
uint256 constant ECDSA_signature_v_offset = 0x60;

bytes32 constant EIP1271_isValidSignature_selector = (
    0x1626ba7e00000000000000000000000000000000000000000000000000000000
);
uint256 constant EIP1271_isValidSignature_digest_negativeOffset = 0x40;
uint256 constant EIP1271_isValidSignature_selector_negativeOffset = 0x44;
uint256 constant EIP1271_isValidSignature_calldata_baseLength = 0x64;
uint256 constant EIP1271_isValidSignature_signature_head_offset = 0x40;

uint256 constant EIP_712_PREFIX = (0x1901000000000000000000000000000000000000000000000000000000000000);

uint256 constant ExtraGasBuffer = 0x20;
uint256 constant CostPerWord = 0x3;
uint256 constant MemoryExpansionCoefficientShift = 0x9;


uint256 constant MaxUint8 = 0xff;
uint256 constant MaxUint120 = 0xffffffffffffffffffffffffffffff;


uint256 constant Ecrecover_precompile = 0x1;
uint256 constant Ecrecover_args_size = 0x80;
uint256 constant Signature_lower_v = 27;

// Bitmask that only gives a non-zero value if masked with a non-match selector.
uint256 constant NonMatchSelector_MagicMask = (0x4000000000000000000000000000000000000000000000000000000000);

// First bit indicates that a NATIVE offer items has been used and the 231st bit
// indicates that a non match selector has been called.
uint256 constant NonMatchSelector_InvalidErrorValue = (0x4000000000000000000000000000000000000000000000000000000001);


// ConsiderationDecoder Constants
uint256 constant OrderParameters_head_size = 0x0100;
uint256 constant OrderParameters_totalOriginalConsiderationItems_offset = (0x0e0);
uint256 constant AdvancedOrderPlusOrderParameters_head_size = 0x0200;

uint256 constant Order_signature_offset = 0x20;
uint256 constant Order_head_size = 0x40;

uint256 constant AdvancedOrder_fixed_segment_0 = 0x40;

uint256 constant FulfillmentComponent_mem_tail_size = 0x40;
uint256 constant FulfillmentComponent_mem_tail_size_shift = 0x6;
uint256 constant Fulfillment_head_size = 0x40;
uint256 constant Fulfillment_considerationComponents_offset = 0x20;

uint256 constant OrderComponents_OrderParameters_common_head_size = 0x0e0;
