/* @flow */

import { prepareLatencyInstrumentationPayload, prepareLatencyInstrumentationTrackPayload } from './perceived-latency-instrumentation';
import { FPTI_KEY } from '@paypal/sdk-constants/src';

describe('customer perceived latency instrumentation utils', () => {
    describe('prepareLatencyInstrumentationPayload', () => {
        it('returns the CPL payload for the log', () => {
            jest.spyOn(Date, 'now').mockImplementation(() => 4000);
            const responseStartTime = 2000;
            const responseEndTime = 3000;
            const preparedPayload = {
                comp: {
                    'second-render-response': {
                        start: responseStartTime,
                        tt:    1000
                    },
                    'second-render-body': {
                        start: responseEndTime,
                        tt:    1000
                    }
                }
            };
            expect(prepareLatencyInstrumentationPayload(responseStartTime, responseEndTime)).toEqual(preparedPayload);

        });
    });
    describe('prepareLatencyInstrumentationTrackPayload', () => {
        it('returns the CPL track payload', () => {
            const expectedPayload = {
                [FPTI_KEY.STATE]:                 'CPL_LATENCY_METRICS',
                [FPTI_KEY.TRANSITION]:            'process_client_metrics',
                [FPTI_KEY.CONTEXT_ID]:            'token',
                [FPTI_KEY.PAGE]:                  'page',
                [FPTI_KEY.CPL_COMP_METRICS]:      JSON.stringify({})
            }
            expect(prepareLatencyInstrumentationTrackPayload('page', 'token', {})).toEqual(expectedPayload);
        });
    });
});
