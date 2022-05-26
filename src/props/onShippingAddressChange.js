/* @flow */

import { ZalgoPromise } from '@krakenjs/zalgo-promise/src';
import { COUNTRY, FPTI_KEY } from '@paypal/sdk-constants/src';

import { patchOrder, type OrderResponse } from '../api';
import { FPTI_TRANSITION, FPTI_CONTEXT_TYPE, LSAT_UPGRADE_EXCLUDED_MERCHANTS, FPTI_CUSTOM_KEY } from '../constants';
import { getLogger } from '../lib';

import type { CreateOrder } from './createOrder';
import { type ShippingAmount, type ShippingOption, type Query, type ON_SHIPPING_CHANGE_EVENT, ON_SHIPPING_CHANGE_PATHS } from './onShippingChange';
import { buildBreakdown, calculateTotalFromShippingBreakdownAmounts, convertQueriesToArray } from './utils';
        
export type XOnShippingAddressChangeDataType = {|
    orderID? : string,
    paymentID? : string,
    paymentToken? : string,
    shipping_address? : {|
        city : string,
        state : string,
        country_code : $Values<typeof COUNTRY>,
        postal_code : string
    |}
|};

export type XOnShippingAddressChangeActionsType = {|
    patch : () => ZalgoPromise<OrderResponse>,
    query : () => $ReadOnlyArray<Query>,
    reject : (mixed) => ZalgoPromise<void>,
    updateShippingDiscount : ({| discountAmount : string |}) => XOnShippingAddressChangeActionsType,
    updateShippingOptions : ({| shippingOptions : $ReadOnlyArray<ShippingOption> |}) => XOnShippingAddressChangeActionsType,
    updateTax : ({| taxAmount : string |}) => XOnShippingAddressChangeActionsType
|};

export type XOnShippingAddressChange = (XOnShippingAddressChangeDataType, XOnShippingAddressChangeActionsType) => ZalgoPromise<void>;

export type OnShippingAddressChangeData = {|
    orderID? : string,
    paymentID? : string,
    paymentToken? : string,
    shipping_address? : {|
        city : string,
        state : string,
        country_code : $Values<typeof COUNTRY>,
        postal_code : string
    |},
    amount? : ShippingAmount,
    event? : ON_SHIPPING_CHANGE_EVENT,
    buyerAccessToken? : ?string,
    forceRestAPI? : boolean
|};
        
export type OnShippingAddressChangeActionsType = {|
    resolve : () => ZalgoPromise<void>,
    reject : () => ZalgoPromise<void>
|};
            
export function buildXOnShippingAddressChangeData(data : OnShippingAddressChangeData) : XOnShippingAddressChangeDataType {
    // eslint-disable-next-line no-unused-vars
    const { amount, buyerAccessToken, event, forceRestAPI, ...rest } = data;

    return rest;
}

export function buildXOnShippingAddressChangeActions({ data, actions: passedActions, orderID, facilitatorAccessToken, buyerAccessToken, partnerAttributionID, forceRestAPI } : {| data : OnShippingAddressChangeData, actions : OnShippingAddressChangeActionsType, orderID : string, facilitatorAccessToken : string, buyerAccessToken : ?string, partnerAttributionID : ?string, forceRestAPI : boolean |}) : XOnShippingAddressChangeActionsType {
    const patchQueries = {};

    let newAmount;
    let breakdown = data.amount?.breakdown || {};

    if (Object.keys(breakdown).length === 0) {
        throw new Error('Must pass breakdown into data attribute for onShippingAddressChange callback.');
    }

    const actions = {
        reject: passedActions.reject || function reject() {
            throw new Error(`Missing reject action callback`);
        },

        updateTax: ({ taxAmount }) => {
            breakdown = buildBreakdown({ breakdown, updatedAmounts: { tax_total: taxAmount } });
            newAmount = calculateTotalFromShippingBreakdownAmounts({ breakdown, updatedAmounts: { tax_total: taxAmount } });
        
            patchQueries[ON_SHIPPING_CHANGE_PATHS.AMOUNT] = {
                op:       'replace',
                path:     ON_SHIPPING_CHANGE_PATHS.AMOUNT,
                value: {
                    value:         `${ newAmount }`,
                    currency_code: data?.amount?.currency_code,
                    breakdown
                }
            };

            return actions;
        },

        updateShippingOptions: ({ shippingOptions }) => {
            patchQueries[ON_SHIPPING_CHANGE_PATHS.OPTIONS] = {
                op:    data?.event || 'replace', // or 'add' if there are none.
                path:  ON_SHIPPING_CHANGE_PATHS.OPTIONS,
                value: shippingOptions || []
            };

            return actions;
        },

        updateShippingDiscount: ({ discountAmount }) => {
            newAmount = calculateTotalFromShippingBreakdownAmounts({ breakdown, updatedAmounts: { shipping_discount: discountAmount } });
            breakdown = buildBreakdown({ breakdown, updatedAmounts: { shipping_discount: discountAmount } });

            patchQueries[ON_SHIPPING_CHANGE_PATHS.AMOUNT] = {
                op:       'replace',
                path:     ON_SHIPPING_CHANGE_PATHS.AMOUNT,
                value: {
                    value:         `${ newAmount }`,
                    currency_code: data?.amount?.currency_code,
                    breakdown
                }
            };

            return actions;
        },

        patch: () => {
            return patchOrder(orderID, convertQueriesToArray({ queries: patchQueries }), { facilitatorAccessToken, buyerAccessToken, partnerAttributionID, forceRestAPI }).catch(() => {
                throw new Error('Order could not be patched');
            });
        },

        query: () => convertQueriesToArray({ queries: patchQueries })

    };

    return actions;
}

export type OnShippingAddressChange = (OnShippingAddressChangeData, OnShippingAddressChangeActionsType) => ZalgoPromise<void>;

type OnShippingAddressChangeXProps = {|
    onShippingAddressChange : ?XOnShippingAddressChange,
    partnerAttributionID : ?string,
    clientID : string
|};

export function getOnShippingAddressChange({ onShippingAddressChange, partnerAttributionID, clientID } : OnShippingAddressChangeXProps, { facilitatorAccessToken, createOrder } : {| facilitatorAccessToken : string, createOrder : CreateOrder |}) : ?OnShippingAddressChange {
    const upgradeLSAT = LSAT_UPGRADE_EXCLUDED_MERCHANTS.indexOf(clientID) === -1;

    if (onShippingAddressChange) {
        return ({ buyerAccessToken, forceRestAPI = upgradeLSAT, ...data }, actions) => {
            return createOrder().then(orderID => {
                getLogger()
                    .info('button_shipping_address_change')
                    .track({
                        [FPTI_KEY.TRANSITION]:                       FPTI_TRANSITION.CHECKOUT_SHIPPING_ADDRESS_CHANGE,
                        [FPTI_KEY.CONTEXT_TYPE]:                     FPTI_CONTEXT_TYPE.ORDER_ID,
                        [FPTI_KEY.TOKEN]:                            orderID,
                        [FPTI_KEY.CONTEXT_ID]:                       orderID,
                        [FPTI_CUSTOM_KEY.SHIPPING_CALLBACK_INVOKED]: '1'
                    }).flush();
                
                return onShippingAddressChange(buildXOnShippingAddressChangeData(data), buildXOnShippingAddressChangeActions({ data, actions, orderID, facilitatorAccessToken, buyerAccessToken, partnerAttributionID, forceRestAPI }));
            });
        };
    }
}
