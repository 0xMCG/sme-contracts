pragma solidity ^0.8.0;

interface ISeaportContract {
  function execute(
        uint256 requestId,
        uint256 numerator,
        uint256 denominator
    ) external;
}