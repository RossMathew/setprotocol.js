import { BaseContract } from "./base_contract";
import { DetailedERC20Contract as ERC20Contract } from "./detailed_erc20_wrapper";
import { SetTokenContract } from "./set_token_wrapper";

export type ContractWrapper =
    | ERC20Contract
    | SetTokenContract;

export {
    BaseContract,
    ERC20Contract,
    SetTokenContract,
};
