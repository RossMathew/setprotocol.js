/*
  Copyright 2018 Set Labs Inc.

  Licensed under the Apache License, Version 2.0 (the "License");
  you may not use this file except in compliance with the License.
  You may obtain a copy of the License at

  http://www.apache.org/licenses/LICENSE-2.0

  Unless required by applicable law or agreed to in writing, software
  distributed under the License is distributed on an "AS IS" BASIS,
  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  See the License for the specific language governing permissions and
  limitations under the License.
*/

'use strict';

import * as _ from 'lodash';
import * as Web3 from 'web3';
import { Address } from 'set-protocol-utils';

import { ERC20Assertions } from './ERC20Assertions';
import { RebalancingSetTokenContract, DetailedERC20Contract } from 'set-protocol-contracts';
import { coreAPIErrors, rebalancingErrors } from '../errors';
import { BigNumber } from '../util';
import { RebalancingState } from '../types/common';
import { ZERO } from '../constants';

const moment = require('moment');

export class RebalancingAssertions {
  private web3: Web3;
  private erc20Assertions: ERC20Assertions;

  constructor(web3: Web3) {
    this.web3 = web3;
    this.erc20Assertions = new ERC20Assertions(this.web3);
  }

  /**
   * Throws if given rebalancingSetToken in Rebalance state
   *
   * @param  rebalancingSetTokenAddress   The address of the rebalancing set token
   */
  public async isNotInRebalanceState(rebalancingSetTokenAddress: Address): Promise<void> {
    const rebalancingSetTokenInstance = await RebalancingSetTokenContract.at(rebalancingSetTokenAddress, this.web3, {});

    const currentState = await rebalancingSetTokenInstance.rebalanceState.callAsync();
    if (currentState.eq(RebalancingState.REBALANCE)) {
      throw new Error(rebalancingErrors.REBALANCE_IN_PROGRESS(rebalancingSetTokenAddress));
    }
  }

  /**
   * Throws if given rebalancingSetToken is not in Proposal state
   *
   * @param  rebalancingSetTokenAddress   The address of the rebalancing set token
   */
  public async isInProposalState(rebalancingSetTokenAddress: Address): Promise<void> {
    const rebalancingSetTokenInstance = await RebalancingSetTokenContract.at(rebalancingSetTokenAddress, this.web3, {});

    const currentState = await rebalancingSetTokenInstance.rebalanceState.callAsync();
    if (!currentState.eq(RebalancingState.PROPOSAL)) {
      throw new Error(rebalancingErrors.INCORRECT_STATE(rebalancingSetTokenAddress, 'Proposal'));
    }
  }

  /**
   * Throws if given rebalancingSetToken is not in Rebalance state
   *
   * @param  rebalancingSetTokenAddress   The address of the rebalancing set token
   */
  public async isInRebalanceState(rebalancingSetTokenAddress: Address): Promise<void> {
    const rebalancingSetTokenInstance = await RebalancingSetTokenContract.at(rebalancingSetTokenAddress, this.web3, {});

    const currentState = await rebalancingSetTokenInstance.rebalanceState.callAsync();
    if (!currentState.eq(RebalancingState.REBALANCE)) {
      throw new Error(rebalancingErrors.INCORRECT_STATE(rebalancingSetTokenAddress, 'Rebalance'));
    }
  }

  /**
   * Throws if caller of rebalancingSetToken is not manager
   *
   * @param  caller   The address of the rebalancing set token
   */
  public async isManager(rebalancingSetTokenAddress: Address, caller: Address): Promise<void> {
    const rebalancingSetTokenInstance = await RebalancingSetTokenContract.at(rebalancingSetTokenAddress, this.web3, {});

    const manager = await rebalancingSetTokenInstance.manager.callAsync();

    if (manager != caller) {
      throw new Error(rebalancingErrors.NOT_REBALANCING_MANAGER(caller));
    }
  }

  /**
   * Throws if not enough time passed between last rebalance on rebalancing set token
   *
   * @param  rebalancingSetTokenAddress   The address of the rebalancing set token
   */
  public async sufficientTimeBetweenRebalance(rebalancingSetTokenAddress: Address): Promise<void> {
    const rebalancingSetTokenInstance = await RebalancingSetTokenContract.at(rebalancingSetTokenAddress, this.web3, {});

    const lastRebalanceTime = await rebalancingSetTokenInstance.lastRebalanceTimestamp.callAsync();
    const rebalanceInterval = await rebalancingSetTokenInstance.rebalanceInterval.callAsync();
    const nextAvailableRebalance = lastRebalanceTime.add(rebalanceInterval).mul(1000);
    const currentTimeStamp = new BigNumber(Date.now());

    if (nextAvailableRebalance.greaterThan(currentTimeStamp)) {
      const nextRebalanceFormattedDate = moment(
        nextAvailableRebalance.toNumber()).format('dddd, MMMM Do YYYY, h:mm:ss a'
      );
      throw new Error(rebalancingErrors.INSUFFICIENT_TIME_PASSED(nextRebalanceFormattedDate));
    }
  }

  /**
   * Throws if not enough time passed in proposal state
   *
   * @param  rebalancingSetTokenAddress   The address of the rebalancing set token
   */
  public async sufficientTimeInProposalState(rebalancingSetTokenAddress: Address): Promise<void> {
    const rebalancingSetTokenInstance = await RebalancingSetTokenContract.at(rebalancingSetTokenAddress, this.web3, {});

    const proposalStartTime = await rebalancingSetTokenInstance.proposalStartTime.callAsync();
    const proposalPeriod = await rebalancingSetTokenInstance.proposalPeriod.callAsync();
    const nextAvailableRebalance = proposalStartTime.add(proposalPeriod).mul(1000);
    const currentTimeStamp = new BigNumber(Date.now());

    if (nextAvailableRebalance.greaterThan(currentTimeStamp)) {
      const nextRebalanceFormattedDate = moment(
        nextAvailableRebalance.toNumber()).format('dddd, MMMM Do YYYY, h:mm:ss a'
      );
      throw new Error(rebalancingErrors.INSUFFICIENT_TIME_PASSED(nextRebalanceFormattedDate));
    }
  }

  /**
   * Throws if not enough current sets rebalanced in auction
   *
   * @param  rebalancingSetTokenAddress   The address of the rebalancing set token
   */
  public async enoughSetsRebalanced(rebalancingSetTokenAddress: Address): Promise<void> {
    const rebalancingSetTokenInstance = await RebalancingSetTokenContract.at(rebalancingSetTokenAddress, this.web3, {});
    const minimumBid = await rebalancingSetTokenInstance.minimumBid.callAsync();
    const remainingCurrentSets = await rebalancingSetTokenInstance.remainingCurrentSets.callAsync();

    if (remainingCurrentSets.greaterThanOrEqualTo(minimumBid)) {
      throw new Error(rebalancingErrors.NOT_ENOUGH_SETS_REBALANCED(
        rebalancingSetTokenAddress,
        minimumBid.toString(),
        remainingCurrentSets.toString()
      ));
    }
  }

  /**
   * Throws if user bids to rebalance an amount of current set token that is greater than amount of current set
   * token remaining.
   *
   * @param  rebalancingSetTokenAddress   The address of the rebalancing set token
   * @param  bidQuantity                  The amount of current set the user is seeking to rebalance
   */
  public async bidAmountLessThanRemainingSets(
    rebalancingSetTokenAddress: Address,
    bidQuantity: BigNumber
  ): Promise<void> {
    const rebalancingSetTokenInstance = await RebalancingSetTokenContract.at(rebalancingSetTokenAddress, this.web3, {});
    const remainingCurrentSets = await rebalancingSetTokenInstance.remainingCurrentSets.callAsync();

    if (bidQuantity.greaterThan(remainingCurrentSets)) {
      throw new Error(rebalancingErrors.BID_AMOUNT_EXCEEDS_REMAINING_CURRENT_SETS(
        remainingCurrentSets.toString(),
        bidQuantity.toString()
      ));
    }
  }

  /**
   * Throws if user bids to rebalance an amount of current set token that is not a multiple of the minimumBid.
   *
   * @param  rebalancingSetTokenAddress   The address of the rebalancing set token
   * @param  bidQuantity                  The amount of current set the user is seeking to rebalance
   */
  public async bidIsMultipleOfMinimumBid(rebalancingSetTokenAddress: Address, bidQuantity: BigNumber): Promise<void> {
    const rebalancingSetTokenInstance = await RebalancingSetTokenContract.at(rebalancingSetTokenAddress, this.web3, {});
    const minimumBid = await rebalancingSetTokenInstance.minimumBid.callAsync();

    if (!bidQuantity.modulo(minimumBid).isZero()) {
      throw new Error(rebalancingErrors.BID_AMOUNT_NOT_MULTIPLE_OF_MINIMUM_BID(
        bidQuantity.toString(),
        minimumBid.toString()
      ));
    }
  }

  /**
   * Throws if the given user doesn't have a sufficient balance for a component token needed to be
   * injected for a bid. Since the price can only get better for a bidder the inflow amounts queried
   * when this function is called suffices.
   *
   * @param  rebalancingSetTokenAddress  The address of the Rebalancing Set Token contract
   * @param  ownerAddress                The address of the owner
   * @param  quantity                    Amount of a Set in base units
   */
  public async hasSufficientBalances(
    rebalancingSetTokenAddress: Address,
    ownerAddress: Address,
    quantity: BigNumber,
  ): Promise<void> {
    const rebalancingSetTokenInstance = await RebalancingSetTokenContract.at(rebalancingSetTokenAddress, this.web3, {});

    const [inflowArray, outflowArray] = await rebalancingSetTokenInstance.getBidPrice.callAsync(quantity);
    const components = await rebalancingSetTokenInstance.getCombinedTokenArray.callAsync();

    // Create component ERC20 token instances
    const componentInstancePromises = _.map(
      components,
      async component =>
        await DetailedERC20Contract.at(component, this.web3, { from: ownerAddress }),
    );
    const componentInstances = await Promise.all(componentInstancePromises);

    // Assert that user has sufficient balance for each component token
    const userHasSufficientBalancePromises = _.map(
      componentInstances,
      async (componentInstance, index) => {
        const requiredBalance = inflowArray[index];
        await this.erc20Assertions.hasSufficientBalanceAsync(
          componentInstance.address,
          ownerAddress,
          requiredBalance,
        );
      },
    );
    await Promise.all(userHasSufficientBalancePromises);
  }

  /**
   * Throws if the given user doesn't have a sufficient allowance for a component token needed to be
   * injected for a bid. Since the price can only get better for a bidder the inflow amounts queried
   * when this function is called suffices.
   *
   * @param  rebalancingSetTokenAddress  The address of the Rebalancing Set Token contract
   * @param  ownerAddress                The address of the owner
   * @param  quantity                    Amount of a Set in base units
   */
  public async hasSufficientAllowances(
    rebalancingSetTokenAddress: Address,
    ownerAddress: Address,
    spenderAddress: Address,
    quantity: BigNumber,
  ): Promise<void> {
    const rebalancingSetTokenInstance = await RebalancingSetTokenContract.at(rebalancingSetTokenAddress, this.web3, {});

    const [inflowArray, outflowArray] = await rebalancingSetTokenInstance.getBidPrice.callAsync(quantity);
    const components = await rebalancingSetTokenInstance.getCombinedTokenArray.callAsync();

    // Create component ERC20 token instances
    const componentInstancePromises = _.map(
      components,
      async component =>
        await DetailedERC20Contract.at(component, this.web3, { from: ownerAddress }),
    );
    const componentInstances = await Promise.all(componentInstancePromises);

    // Assert that user has sufficient allowances for each component token
    const userHasSufficientAllowancePromises = _.map(
      componentInstances,
      async (componentInstance, index) => {
        const requiredBalance = inflowArray[index];
        return await this.erc20Assertions.hasSufficientAllowanceAsync(
          componentInstance.address,
          ownerAddress,
          spenderAddress,
          requiredBalance,
        );
      },
    );
    await Promise.all(userHasSufficientAllowancePromises);
  }
}