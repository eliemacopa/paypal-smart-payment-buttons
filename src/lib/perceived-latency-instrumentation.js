/* @flow */
import { FPTI_KEY, FPTI_FEED } from '@paypal/sdk-constants/src';

type InstrumentationPayload = {|
    comp? : mixed,
    chunk? : mixed,
    query? : mixed
|};

/**
 * Prepare instrumentation Payload to be sent to logger
 * @param responseStartTime
 * @param responseEndTime
 */
export function prepareLatencyInstrumentationPayload (responseStartTime : number, responseEndTime : number) : InstrumentationPayload {
    const epochNow = Date.now();
    return {
        comp: {
            'second-render-response': {
                start: responseStartTime,
                tt:    responseEndTime - responseStartTime
            },
            'second-render-body': {
                start: responseEndTime,
                tt:    epochNow - responseEndTime
            }
        }
    };
}

type InstrumentationTrackPayload = {|
    [FPTI_KEY.STATE] : string,
    [FPTI_KEY.TRANSITION] : string,
    [FPTI_KEY.CONTEXT_ID] : string,
    [FPTI_KEY.PAGE] : string,
    [FPTI_KEY.FEED] : string,
    [FPTI_KEY.CPL_COMP_METRICS] : mixed
|};

/**
 * Prepare instrumentation track Payload to be sent to logger
 * @param page
 * @param token
 * @param compMetrics
 */
export function prepareLatencyInstrumentationTrackPayload (page : string, token : string, compMetrics : mixed) : InstrumentationTrackPayload  {
    return {
        [FPTI_KEY.STATE]:                 'CPL_LATENCY_METRICS',
        [FPTI_KEY.TRANSITION]:            'process_client_metrics',
        [FPTI_KEY.CONTEXT_ID]:            token,
        [FPTI_KEY.PAGE]:                  page,
        [FPTI_KEY.FEED]:                  FPTI_FEED.PAYMENTS_SDK,
        [FPTI_KEY.CPL_COMP_METRICS]:      JSON.stringify(compMetrics)
    }
}
