module.exports = [
"[project]/node_modules/.bun/@supabase+auth-js@2.95.3/node_modules/@supabase/auth-js/dist/module/lib/version.js [middleware] (ecmascript)", ((__turbopack_context__) => {
"use strict";

// Generated automatically during releases by scripts/update-version-files.ts
// This file provides runtime access to the package version for:
// - HTTP request headers (e.g., X-Client-Info header for API requests)
// - Debugging and support (identifying which version is running)
// - Telemetry and logging (version reporting in errors/analytics)
// - Ensuring build artifacts match the published package version
__turbopack_context__.s([
    "version",
    ()=>version
]);
const version = '2.95.3'; //# sourceMappingURL=version.js.map
}),
"[project]/node_modules/.bun/@supabase+auth-js@2.95.3/node_modules/@supabase/auth-js/dist/module/lib/constants.js [middleware] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "API_VERSIONS",
    ()=>API_VERSIONS,
    "API_VERSION_HEADER_NAME",
    ()=>API_VERSION_HEADER_NAME,
    "AUDIENCE",
    ()=>AUDIENCE,
    "AUTO_REFRESH_TICK_DURATION_MS",
    ()=>AUTO_REFRESH_TICK_DURATION_MS,
    "AUTO_REFRESH_TICK_THRESHOLD",
    ()=>AUTO_REFRESH_TICK_THRESHOLD,
    "BASE64URL_REGEX",
    ()=>BASE64URL_REGEX,
    "DEFAULT_HEADERS",
    ()=>DEFAULT_HEADERS,
    "EXPIRY_MARGIN_MS",
    ()=>EXPIRY_MARGIN_MS,
    "GOTRUE_URL",
    ()=>GOTRUE_URL,
    "JWKS_TTL",
    ()=>JWKS_TTL,
    "NETWORK_FAILURE",
    ()=>NETWORK_FAILURE,
    "STORAGE_KEY",
    ()=>STORAGE_KEY
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$version$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.bun/@supabase+auth-js@2.95.3/node_modules/@supabase/auth-js/dist/module/lib/version.js [middleware] (ecmascript)");
;
const AUTO_REFRESH_TICK_DURATION_MS = 30 * 1000;
const AUTO_REFRESH_TICK_THRESHOLD = 3;
const EXPIRY_MARGIN_MS = AUTO_REFRESH_TICK_THRESHOLD * AUTO_REFRESH_TICK_DURATION_MS;
const GOTRUE_URL = 'http://localhost:9999';
const STORAGE_KEY = 'supabase.auth.token';
const AUDIENCE = '';
const DEFAULT_HEADERS = {
    'X-Client-Info': `gotrue-js/${__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$version$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["version"]}`
};
const NETWORK_FAILURE = {
    MAX_RETRIES: 10,
    RETRY_INTERVAL: 2
};
const API_VERSION_HEADER_NAME = 'X-Supabase-Api-Version';
const API_VERSIONS = {
    '2024-01-01': {
        timestamp: Date.parse('2024-01-01T00:00:00.0Z'),
        name: '2024-01-01'
    }
};
const BASE64URL_REGEX = /^([a-z0-9_-]{4})*($|[a-z0-9_-]{3}$|[a-z0-9_-]{2}$)$/i;
const JWKS_TTL = 10 * 60 * 1000; // 10 minutes
 //# sourceMappingURL=constants.js.map
}),
"[project]/node_modules/.bun/@supabase+auth-js@2.95.3/node_modules/@supabase/auth-js/dist/module/lib/errors.js [middleware] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/**
 * Base error thrown by Supabase Auth helpers.
 *
 * @example
 * ```ts
 * import { AuthError } from '@supabase/auth-js'
 *
 * throw new AuthError('Unexpected auth error', 500, 'unexpected')
 * ```
 */ __turbopack_context__.s([
    "AuthApiError",
    ()=>AuthApiError,
    "AuthError",
    ()=>AuthError,
    "AuthImplicitGrantRedirectError",
    ()=>AuthImplicitGrantRedirectError,
    "AuthInvalidCredentialsError",
    ()=>AuthInvalidCredentialsError,
    "AuthInvalidJwtError",
    ()=>AuthInvalidJwtError,
    "AuthInvalidTokenResponseError",
    ()=>AuthInvalidTokenResponseError,
    "AuthPKCECodeVerifierMissingError",
    ()=>AuthPKCECodeVerifierMissingError,
    "AuthPKCEGrantCodeExchangeError",
    ()=>AuthPKCEGrantCodeExchangeError,
    "AuthRetryableFetchError",
    ()=>AuthRetryableFetchError,
    "AuthSessionMissingError",
    ()=>AuthSessionMissingError,
    "AuthUnknownError",
    ()=>AuthUnknownError,
    "AuthWeakPasswordError",
    ()=>AuthWeakPasswordError,
    "CustomAuthError",
    ()=>CustomAuthError,
    "isAuthApiError",
    ()=>isAuthApiError,
    "isAuthError",
    ()=>isAuthError,
    "isAuthImplicitGrantRedirectError",
    ()=>isAuthImplicitGrantRedirectError,
    "isAuthPKCECodeVerifierMissingError",
    ()=>isAuthPKCECodeVerifierMissingError,
    "isAuthRetryableFetchError",
    ()=>isAuthRetryableFetchError,
    "isAuthSessionMissingError",
    ()=>isAuthSessionMissingError,
    "isAuthWeakPasswordError",
    ()=>isAuthWeakPasswordError
]);
class AuthError extends Error {
    constructor(message, status, code){
        super(message);
        this.__isAuthError = true;
        this.name = 'AuthError';
        this.status = status;
        this.code = code;
    }
}
function isAuthError(error) {
    return typeof error === 'object' && error !== null && '__isAuthError' in error;
}
class AuthApiError extends AuthError {
    constructor(message, status, code){
        super(message, status, code);
        this.name = 'AuthApiError';
        this.status = status;
        this.code = code;
    }
}
function isAuthApiError(error) {
    return isAuthError(error) && error.name === 'AuthApiError';
}
class AuthUnknownError extends AuthError {
    constructor(message, originalError){
        super(message);
        this.name = 'AuthUnknownError';
        this.originalError = originalError;
    }
}
class CustomAuthError extends AuthError {
    constructor(message, name, status, code){
        super(message, status, code);
        this.name = name;
        this.status = status;
    }
}
class AuthSessionMissingError extends CustomAuthError {
    constructor(){
        super('Auth session missing!', 'AuthSessionMissingError', 400, undefined);
    }
}
function isAuthSessionMissingError(error) {
    return isAuthError(error) && error.name === 'AuthSessionMissingError';
}
class AuthInvalidTokenResponseError extends CustomAuthError {
    constructor(){
        super('Auth session or user missing', 'AuthInvalidTokenResponseError', 500, undefined);
    }
}
class AuthInvalidCredentialsError extends CustomAuthError {
    constructor(message){
        super(message, 'AuthInvalidCredentialsError', 400, undefined);
    }
}
class AuthImplicitGrantRedirectError extends CustomAuthError {
    constructor(message, details = null){
        super(message, 'AuthImplicitGrantRedirectError', 500, undefined);
        this.details = null;
        this.details = details;
    }
    toJSON() {
        return {
            name: this.name,
            message: this.message,
            status: this.status,
            details: this.details
        };
    }
}
function isAuthImplicitGrantRedirectError(error) {
    return isAuthError(error) && error.name === 'AuthImplicitGrantRedirectError';
}
class AuthPKCEGrantCodeExchangeError extends CustomAuthError {
    constructor(message, details = null){
        super(message, 'AuthPKCEGrantCodeExchangeError', 500, undefined);
        this.details = null;
        this.details = details;
    }
    toJSON() {
        return {
            name: this.name,
            message: this.message,
            status: this.status,
            details: this.details
        };
    }
}
class AuthPKCECodeVerifierMissingError extends CustomAuthError {
    constructor(){
        super('PKCE code verifier not found in storage. ' + 'This can happen if the auth flow was initiated in a different browser or device, ' + 'or if the storage was cleared. For SSR frameworks (Next.js, SvelteKit, etc.), ' + 'use @supabase/ssr on both the server and client to store the code verifier in cookies.', 'AuthPKCECodeVerifierMissingError', 400, 'pkce_code_verifier_not_found');
    }
}
function isAuthPKCECodeVerifierMissingError(error) {
    return isAuthError(error) && error.name === 'AuthPKCECodeVerifierMissingError';
}
class AuthRetryableFetchError extends CustomAuthError {
    constructor(message, status){
        super(message, 'AuthRetryableFetchError', status, undefined);
    }
}
function isAuthRetryableFetchError(error) {
    return isAuthError(error) && error.name === 'AuthRetryableFetchError';
}
class AuthWeakPasswordError extends CustomAuthError {
    constructor(message, status, reasons){
        super(message, 'AuthWeakPasswordError', status, 'weak_password');
        this.reasons = reasons;
    }
}
function isAuthWeakPasswordError(error) {
    return isAuthError(error) && error.name === 'AuthWeakPasswordError';
}
class AuthInvalidJwtError extends CustomAuthError {
    constructor(message){
        super(message, 'AuthInvalidJwtError', 400, 'invalid_jwt');
    }
} //# sourceMappingURL=errors.js.map
}),
"[project]/node_modules/.bun/@supabase+auth-js@2.95.3/node_modules/@supabase/auth-js/dist/module/lib/base64url.js [middleware] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "base64UrlToUint8Array",
    ()=>base64UrlToUint8Array,
    "byteFromBase64URL",
    ()=>byteFromBase64URL,
    "byteToBase64URL",
    ()=>byteToBase64URL,
    "bytesToBase64URL",
    ()=>bytesToBase64URL,
    "codepointToUTF8",
    ()=>codepointToUTF8,
    "stringFromBase64URL",
    ()=>stringFromBase64URL,
    "stringFromUTF8",
    ()=>stringFromUTF8,
    "stringToBase64URL",
    ()=>stringToBase64URL,
    "stringToUTF8",
    ()=>stringToUTF8,
    "stringToUint8Array",
    ()=>stringToUint8Array
]);
/**
 * Avoid modifying this file. It's part of
 * https://github.com/supabase-community/base64url-js.  Submit all fixes on
 * that repo!
 */ /**
 * An array of characters that encode 6 bits into a Base64-URL alphabet
 * character.
 */ const TO_BASE64URL = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'.split('');
/**
 * An array of characters that can appear in a Base64-URL encoded string but
 * should be ignored.
 */ const IGNORE_BASE64URL = ' \t\n\r='.split('');
/**
 * An array of 128 numbers that map a Base64-URL character to 6 bits, or if -2
 * used to skip the character, or if -1 used to error out.
 */ const FROM_BASE64URL = (()=>{
    const charMap = new Array(128);
    for(let i = 0; i < charMap.length; i += 1){
        charMap[i] = -1;
    }
    for(let i = 0; i < IGNORE_BASE64URL.length; i += 1){
        charMap[IGNORE_BASE64URL[i].charCodeAt(0)] = -2;
    }
    for(let i = 0; i < TO_BASE64URL.length; i += 1){
        charMap[TO_BASE64URL[i].charCodeAt(0)] = i;
    }
    return charMap;
})();
function byteToBase64URL(byte, state, emit) {
    if (byte !== null) {
        state.queue = state.queue << 8 | byte;
        state.queuedBits += 8;
        while(state.queuedBits >= 6){
            const pos = state.queue >> state.queuedBits - 6 & 63;
            emit(TO_BASE64URL[pos]);
            state.queuedBits -= 6;
        }
    } else if (state.queuedBits > 0) {
        state.queue = state.queue << 6 - state.queuedBits;
        state.queuedBits = 6;
        while(state.queuedBits >= 6){
            const pos = state.queue >> state.queuedBits - 6 & 63;
            emit(TO_BASE64URL[pos]);
            state.queuedBits -= 6;
        }
    }
}
function byteFromBase64URL(charCode, state, emit) {
    const bits = FROM_BASE64URL[charCode];
    if (bits > -1) {
        // valid Base64-URL character
        state.queue = state.queue << 6 | bits;
        state.queuedBits += 6;
        while(state.queuedBits >= 8){
            emit(state.queue >> state.queuedBits - 8 & 0xff);
            state.queuedBits -= 8;
        }
    } else if (bits === -2) {
        // ignore spaces, tabs, newlines, =
        return;
    } else {
        throw new Error(`Invalid Base64-URL character "${String.fromCharCode(charCode)}"`);
    }
}
function stringToBase64URL(str) {
    const base64 = [];
    const emitter = (char)=>{
        base64.push(char);
    };
    const state = {
        queue: 0,
        queuedBits: 0
    };
    stringToUTF8(str, (byte)=>{
        byteToBase64URL(byte, state, emitter);
    });
    byteToBase64URL(null, state, emitter);
    return base64.join('');
}
function stringFromBase64URL(str) {
    const conv = [];
    const utf8Emit = (codepoint)=>{
        conv.push(String.fromCodePoint(codepoint));
    };
    const utf8State = {
        utf8seq: 0,
        codepoint: 0
    };
    const b64State = {
        queue: 0,
        queuedBits: 0
    };
    const byteEmit = (byte)=>{
        stringFromUTF8(byte, utf8State, utf8Emit);
    };
    for(let i = 0; i < str.length; i += 1){
        byteFromBase64URL(str.charCodeAt(i), b64State, byteEmit);
    }
    return conv.join('');
}
function codepointToUTF8(codepoint, emit) {
    if (codepoint <= 0x7f) {
        emit(codepoint);
        return;
    } else if (codepoint <= 0x7ff) {
        emit(0xc0 | codepoint >> 6);
        emit(0x80 | codepoint & 0x3f);
        return;
    } else if (codepoint <= 0xffff) {
        emit(0xe0 | codepoint >> 12);
        emit(0x80 | codepoint >> 6 & 0x3f);
        emit(0x80 | codepoint & 0x3f);
        return;
    } else if (codepoint <= 0x10ffff) {
        emit(0xf0 | codepoint >> 18);
        emit(0x80 | codepoint >> 12 & 0x3f);
        emit(0x80 | codepoint >> 6 & 0x3f);
        emit(0x80 | codepoint & 0x3f);
        return;
    }
    throw new Error(`Unrecognized Unicode codepoint: ${codepoint.toString(16)}`);
}
function stringToUTF8(str, emit) {
    for(let i = 0; i < str.length; i += 1){
        let codepoint = str.charCodeAt(i);
        if (codepoint > 0xd7ff && codepoint <= 0xdbff) {
            // most UTF-16 codepoints are Unicode codepoints, except values in this
            // range where the next UTF-16 codepoint needs to be combined with the
            // current one to get the Unicode codepoint
            const highSurrogate = (codepoint - 0xd800) * 0x400 & 0xffff;
            const lowSurrogate = str.charCodeAt(i + 1) - 0xdc00 & 0xffff;
            codepoint = (lowSurrogate | highSurrogate) + 0x10000;
            i += 1;
        }
        codepointToUTF8(codepoint, emit);
    }
}
function stringFromUTF8(byte, state, emit) {
    if (state.utf8seq === 0) {
        if (byte <= 0x7f) {
            emit(byte);
            return;
        }
        // count the number of 1 leading bits until you reach 0
        for(let leadingBit = 1; leadingBit < 6; leadingBit += 1){
            if ((byte >> 7 - leadingBit & 1) === 0) {
                state.utf8seq = leadingBit;
                break;
            }
        }
        if (state.utf8seq === 2) {
            state.codepoint = byte & 31;
        } else if (state.utf8seq === 3) {
            state.codepoint = byte & 15;
        } else if (state.utf8seq === 4) {
            state.codepoint = byte & 7;
        } else {
            throw new Error('Invalid UTF-8 sequence');
        }
        state.utf8seq -= 1;
    } else if (state.utf8seq > 0) {
        if (byte <= 0x7f) {
            throw new Error('Invalid UTF-8 sequence');
        }
        state.codepoint = state.codepoint << 6 | byte & 63;
        state.utf8seq -= 1;
        if (state.utf8seq === 0) {
            emit(state.codepoint);
        }
    }
}
function base64UrlToUint8Array(str) {
    const result = [];
    const state = {
        queue: 0,
        queuedBits: 0
    };
    const onByte = (byte)=>{
        result.push(byte);
    };
    for(let i = 0; i < str.length; i += 1){
        byteFromBase64URL(str.charCodeAt(i), state, onByte);
    }
    return new Uint8Array(result);
}
function stringToUint8Array(str) {
    const result = [];
    stringToUTF8(str, (byte)=>result.push(byte));
    return new Uint8Array(result);
}
function bytesToBase64URL(bytes) {
    const result = [];
    const state = {
        queue: 0,
        queuedBits: 0
    };
    const onChar = (char)=>{
        result.push(char);
    };
    bytes.forEach((byte)=>byteToBase64URL(byte, state, onChar));
    // always call with `null` after processing all bytes
    byteToBase64URL(null, state, onChar);
    return result.join('');
} //# sourceMappingURL=base64url.js.map
}),
"[project]/node_modules/.bun/@supabase+auth-js@2.95.3/node_modules/@supabase/auth-js/dist/module/lib/helpers.js [middleware] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "Deferred",
    ()=>Deferred,
    "decodeJWT",
    ()=>decodeJWT,
    "deepClone",
    ()=>deepClone,
    "expiresAt",
    ()=>expiresAt,
    "generateCallbackId",
    ()=>generateCallbackId,
    "generatePKCEChallenge",
    ()=>generatePKCEChallenge,
    "generatePKCEVerifier",
    ()=>generatePKCEVerifier,
    "getAlgorithm",
    ()=>getAlgorithm,
    "getCodeChallengeAndMethod",
    ()=>getCodeChallengeAndMethod,
    "getItemAsync",
    ()=>getItemAsync,
    "insecureUserWarningProxy",
    ()=>insecureUserWarningProxy,
    "isBrowser",
    ()=>isBrowser,
    "looksLikeFetchResponse",
    ()=>looksLikeFetchResponse,
    "parseParametersFromURL",
    ()=>parseParametersFromURL,
    "parseResponseAPIVersion",
    ()=>parseResponseAPIVersion,
    "removeItemAsync",
    ()=>removeItemAsync,
    "resolveFetch",
    ()=>resolveFetch,
    "retryable",
    ()=>retryable,
    "setItemAsync",
    ()=>setItemAsync,
    "sleep",
    ()=>sleep,
    "supportsLocalStorage",
    ()=>supportsLocalStorage,
    "userNotAvailableProxy",
    ()=>userNotAvailableProxy,
    "validateExp",
    ()=>validateExp,
    "validateUUID",
    ()=>validateUUID
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$constants$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.bun/@supabase+auth-js@2.95.3/node_modules/@supabase/auth-js/dist/module/lib/constants.js [middleware] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$errors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.bun/@supabase+auth-js@2.95.3/node_modules/@supabase/auth-js/dist/module/lib/errors.js [middleware] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$base64url$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.bun/@supabase+auth-js@2.95.3/node_modules/@supabase/auth-js/dist/module/lib/base64url.js [middleware] (ecmascript)");
;
;
;
function expiresAt(expiresIn) {
    const timeNow = Math.round(Date.now() / 1000);
    return timeNow + expiresIn;
}
function generateCallbackId() {
    return Symbol('auth-callback');
}
const isBrowser = ()=>("TURBOPACK compile-time value", "undefined") !== 'undefined' && typeof document !== 'undefined';
const localStorageWriteTests = {
    tested: false,
    writable: false
};
const supportsLocalStorage = ()=>{
    if (!isBrowser()) {
        return false;
    }
    //TURBOPACK unreachable
    ;
    const randomKey = undefined;
};
function parseParametersFromURL(href) {
    const result = {};
    const url = new URL(href);
    if (url.hash && url.hash[0] === '#') {
        try {
            const hashSearchParams = new URLSearchParams(url.hash.substring(1));
            hashSearchParams.forEach((value, key)=>{
                result[key] = value;
            });
        } catch (e) {
        // hash is not a query string
        }
    }
    // search parameters take precedence over hash parameters
    url.searchParams.forEach((value, key)=>{
        result[key] = value;
    });
    return result;
}
const resolveFetch = (customFetch)=>{
    if (customFetch) {
        return (...args)=>customFetch(...args);
    }
    return (...args)=>fetch(...args);
};
const looksLikeFetchResponse = (maybeResponse)=>{
    return typeof maybeResponse === 'object' && maybeResponse !== null && 'status' in maybeResponse && 'ok' in maybeResponse && 'json' in maybeResponse && typeof maybeResponse.json === 'function';
};
const setItemAsync = async (storage, key, data)=>{
    await storage.setItem(key, JSON.stringify(data));
};
const getItemAsync = async (storage, key)=>{
    const value = await storage.getItem(key);
    if (!value) {
        return null;
    }
    try {
        return JSON.parse(value);
    } catch (_a) {
        return value;
    }
};
const removeItemAsync = async (storage, key)=>{
    await storage.removeItem(key);
};
class Deferred {
    constructor(){
        // eslint-disable-next-line @typescript-eslint/no-extra-semi
        ;
        this.promise = new Deferred.promiseConstructor((res, rej)=>{
            // eslint-disable-next-line @typescript-eslint/no-extra-semi
            ;
            this.resolve = res;
            this.reject = rej;
        });
    }
}
Deferred.promiseConstructor = Promise;
function decodeJWT(token) {
    const parts = token.split('.');
    if (parts.length !== 3) {
        throw new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$errors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["AuthInvalidJwtError"]('Invalid JWT structure');
    }
    // Regex checks for base64url format
    for(let i = 0; i < parts.length; i++){
        if (!__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$constants$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["BASE64URL_REGEX"].test(parts[i])) {
            throw new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$errors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["AuthInvalidJwtError"]('JWT not in base64url format');
        }
    }
    const data = {
        // using base64url lib
        header: JSON.parse((0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$base64url$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["stringFromBase64URL"])(parts[0])),
        payload: JSON.parse((0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$base64url$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["stringFromBase64URL"])(parts[1])),
        signature: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$base64url$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["base64UrlToUint8Array"])(parts[2]),
        raw: {
            header: parts[0],
            payload: parts[1]
        }
    };
    return data;
}
async function sleep(time) {
    return await new Promise((accept)=>{
        setTimeout(()=>accept(null), time);
    });
}
function retryable(fn, isRetryable) {
    const promise = new Promise((accept, reject)=>{
        // eslint-disable-next-line @typescript-eslint/no-extra-semi
        ;
        (async ()=>{
            for(let attempt = 0; attempt < Infinity; attempt++){
                try {
                    const result = await fn(attempt);
                    if (!isRetryable(attempt, null, result)) {
                        accept(result);
                        return;
                    }
                } catch (e) {
                    if (!isRetryable(attempt, e)) {
                        reject(e);
                        return;
                    }
                }
            }
        })();
    });
    return promise;
}
function dec2hex(dec) {
    return ('0' + dec.toString(16)).substr(-2);
}
function generatePKCEVerifier() {
    const verifierLength = 56;
    const array = new Uint32Array(verifierLength);
    if (typeof crypto === 'undefined') {
        const charSet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
        const charSetLen = charSet.length;
        let verifier = '';
        for(let i = 0; i < verifierLength; i++){
            verifier += charSet.charAt(Math.floor(Math.random() * charSetLen));
        }
        return verifier;
    }
    crypto.getRandomValues(array);
    return Array.from(array, dec2hex).join('');
}
async function sha256(randomString) {
    const encoder = new TextEncoder();
    const encodedData = encoder.encode(randomString);
    const hash = await crypto.subtle.digest('SHA-256', encodedData);
    const bytes = new Uint8Array(hash);
    return Array.from(bytes).map((c)=>String.fromCharCode(c)).join('');
}
async function generatePKCEChallenge(verifier) {
    const hasCryptoSupport = typeof crypto !== 'undefined' && typeof crypto.subtle !== 'undefined' && typeof TextEncoder !== 'undefined';
    if (!hasCryptoSupport) {
        console.warn('WebCrypto API is not supported. Code challenge method will default to use plain instead of sha256.');
        return verifier;
    }
    const hashed = await sha256(verifier);
    return btoa(hashed).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
async function getCodeChallengeAndMethod(storage, storageKey, isPasswordRecovery = false) {
    const codeVerifier = generatePKCEVerifier();
    let storedCodeVerifier = codeVerifier;
    if (isPasswordRecovery) {
        storedCodeVerifier += '/PASSWORD_RECOVERY';
    }
    await setItemAsync(storage, `${storageKey}-code-verifier`, storedCodeVerifier);
    const codeChallenge = await generatePKCEChallenge(codeVerifier);
    const codeChallengeMethod = codeVerifier === codeChallenge ? 'plain' : 's256';
    return [
        codeChallenge,
        codeChallengeMethod
    ];
}
/** Parses the API version which is 2YYY-MM-DD. */ const API_VERSION_REGEX = /^2[0-9]{3}-(0[1-9]|1[0-2])-(0[1-9]|1[0-9]|2[0-9]|3[0-1])$/i;
function parseResponseAPIVersion(response) {
    const apiVersion = response.headers.get(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$constants$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["API_VERSION_HEADER_NAME"]);
    if (!apiVersion) {
        return null;
    }
    if (!apiVersion.match(API_VERSION_REGEX)) {
        return null;
    }
    try {
        const date = new Date(`${apiVersion}T00:00:00.0Z`);
        return date;
    } catch (e) {
        return null;
    }
}
function validateExp(exp) {
    if (!exp) {
        throw new Error('Missing exp claim');
    }
    const timeNow = Math.floor(Date.now() / 1000);
    if (exp <= timeNow) {
        throw new Error('JWT has expired');
    }
}
function getAlgorithm(alg) {
    switch(alg){
        case 'RS256':
            return {
                name: 'RSASSA-PKCS1-v1_5',
                hash: {
                    name: 'SHA-256'
                }
            };
        case 'ES256':
            return {
                name: 'ECDSA',
                namedCurve: 'P-256',
                hash: {
                    name: 'SHA-256'
                }
            };
        default:
            throw new Error('Invalid alg claim');
    }
}
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
function validateUUID(str) {
    if (!UUID_REGEX.test(str)) {
        throw new Error('@supabase/auth-js: Expected parameter to be UUID but is not');
    }
}
function userNotAvailableProxy() {
    const proxyTarget = {};
    return new Proxy(proxyTarget, {
        get: (target, prop)=>{
            if (prop === '__isUserNotAvailableProxy') {
                return true;
            }
            // Preventative check for common problematic symbols during cloning/inspection
            // These symbols might be accessed by structuredClone or other internal mechanisms.
            if (typeof prop === 'symbol') {
                const sProp = prop.toString();
                if (sProp === 'Symbol(Symbol.toPrimitive)' || sProp === 'Symbol(Symbol.toStringTag)' || sProp === 'Symbol(util.inspect.custom)') {
                    // Node.js util.inspect
                    return undefined;
                }
            }
            throw new Error(`@supabase/auth-js: client was created with userStorage option and there was no user stored in the user storage. Accessing the "${prop}" property of the session object is not supported. Please use getUser() instead.`);
        },
        set: (_target, prop)=>{
            throw new Error(`@supabase/auth-js: client was created with userStorage option and there was no user stored in the user storage. Setting the "${prop}" property of the session object is not supported. Please use getUser() to fetch a user object you can manipulate.`);
        },
        deleteProperty: (_target, prop)=>{
            throw new Error(`@supabase/auth-js: client was created with userStorage option and there was no user stored in the user storage. Deleting the "${prop}" property of the session object is not supported. Please use getUser() to fetch a user object you can manipulate.`);
        }
    });
}
function insecureUserWarningProxy(user, suppressWarningRef) {
    return new Proxy(user, {
        get: (target, prop, receiver)=>{
            // Allow internal checks without warning
            if (prop === '__isInsecureUserWarningProxy') {
                return true;
            }
            // Preventative check for common problematic symbols during cloning/inspection
            // These symbols might be accessed by structuredClone or other internal mechanisms
            if (typeof prop === 'symbol') {
                const sProp = prop.toString();
                if (sProp === 'Symbol(Symbol.toPrimitive)' || sProp === 'Symbol(Symbol.toStringTag)' || sProp === 'Symbol(util.inspect.custom)' || sProp === 'Symbol(nodejs.util.inspect.custom)') {
                    // Return the actual value for these symbols to allow proper inspection
                    return Reflect.get(target, prop, receiver);
                }
            }
            // Emit warning on first property access
            if (!suppressWarningRef.value && typeof prop === 'string') {
                console.warn('Using the user object as returned from supabase.auth.getSession() or from some supabase.auth.onAuthStateChange() events could be insecure! This value comes directly from the storage medium (usually cookies on the server) and may not be authentic. Use supabase.auth.getUser() instead which authenticates the data by contacting the Supabase Auth server.');
                suppressWarningRef.value = true;
            }
            return Reflect.get(target, prop, receiver);
        }
    });
}
function deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
} //# sourceMappingURL=helpers.js.map
}),
"[project]/node_modules/.bun/@supabase+auth-js@2.95.3/node_modules/@supabase/auth-js/dist/module/lib/fetch.js [middleware] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "_generateLinkResponse",
    ()=>_generateLinkResponse,
    "_noResolveJsonResponse",
    ()=>_noResolveJsonResponse,
    "_request",
    ()=>_request,
    "_sessionResponse",
    ()=>_sessionResponse,
    "_sessionResponsePassword",
    ()=>_sessionResponsePassword,
    "_ssoResponse",
    ()=>_ssoResponse,
    "_userResponse",
    ()=>_userResponse,
    "handleError",
    ()=>handleError
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f$tslib$40$2$2e$8$2e$1$2f$node_modules$2f$tslib$2f$tslib$2e$es6$2e$mjs__$5b$middleware$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.bun/tslib@2.8.1/node_modules/tslib/tslib.es6.mjs [middleware] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$constants$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.bun/@supabase+auth-js@2.95.3/node_modules/@supabase/auth-js/dist/module/lib/constants.js [middleware] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$helpers$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.bun/@supabase+auth-js@2.95.3/node_modules/@supabase/auth-js/dist/module/lib/helpers.js [middleware] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$errors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.bun/@supabase+auth-js@2.95.3/node_modules/@supabase/auth-js/dist/module/lib/errors.js [middleware] (ecmascript)");
;
;
;
;
const _getErrorMessage = (err)=>err.msg || err.message || err.error_description || err.error || JSON.stringify(err);
const NETWORK_ERROR_CODES = [
    502,
    503,
    504
];
async function handleError(error) {
    var _a;
    if (!(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$helpers$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["looksLikeFetchResponse"])(error)) {
        throw new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$errors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["AuthRetryableFetchError"](_getErrorMessage(error), 0);
    }
    if (NETWORK_ERROR_CODES.includes(error.status)) {
        // status in 500...599 range - server had an error, request might be retryed.
        throw new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$errors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["AuthRetryableFetchError"](_getErrorMessage(error), error.status);
    }
    let data;
    try {
        data = await error.json();
    } catch (e) {
        throw new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$errors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["AuthUnknownError"](_getErrorMessage(e), e);
    }
    let errorCode = undefined;
    const responseAPIVersion = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$helpers$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["parseResponseAPIVersion"])(error);
    if (responseAPIVersion && responseAPIVersion.getTime() >= __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$constants$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["API_VERSIONS"]['2024-01-01'].timestamp && typeof data === 'object' && data && typeof data.code === 'string') {
        errorCode = data.code;
    } else if (typeof data === 'object' && data && typeof data.error_code === 'string') {
        errorCode = data.error_code;
    }
    if (!errorCode) {
        // Legacy support for weak password errors, when there were no error codes
        if (typeof data === 'object' && data && typeof data.weak_password === 'object' && data.weak_password && Array.isArray(data.weak_password.reasons) && data.weak_password.reasons.length && data.weak_password.reasons.reduce((a, i)=>a && typeof i === 'string', true)) {
            throw new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$errors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["AuthWeakPasswordError"](_getErrorMessage(data), error.status, data.weak_password.reasons);
        }
    } else if (errorCode === 'weak_password') {
        throw new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$errors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["AuthWeakPasswordError"](_getErrorMessage(data), error.status, ((_a = data.weak_password) === null || _a === void 0 ? void 0 : _a.reasons) || []);
    } else if (errorCode === 'session_not_found') {
        // The `session_id` inside the JWT does not correspond to a row in the
        // `sessions` table. This usually means the user has signed out, has been
        // deleted, or their session has somehow been terminated.
        throw new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$errors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["AuthSessionMissingError"]();
    }
    throw new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$errors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["AuthApiError"](_getErrorMessage(data), error.status || 500, errorCode);
}
const _getRequestParams = (method, options, parameters, body)=>{
    const params = {
        method,
        headers: (options === null || options === void 0 ? void 0 : options.headers) || {}
    };
    if (method === 'GET') {
        return params;
    }
    params.headers = Object.assign({
        'Content-Type': 'application/json;charset=UTF-8'
    }, options === null || options === void 0 ? void 0 : options.headers);
    params.body = JSON.stringify(body);
    return Object.assign(Object.assign({}, params), parameters);
};
async function _request(fetcher, method, url, options) {
    var _a;
    const headers = Object.assign({}, options === null || options === void 0 ? void 0 : options.headers);
    if (!headers[__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$constants$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["API_VERSION_HEADER_NAME"]]) {
        headers[__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$constants$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["API_VERSION_HEADER_NAME"]] = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$constants$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["API_VERSIONS"]['2024-01-01'].name;
    }
    if (options === null || options === void 0 ? void 0 : options.jwt) {
        headers['Authorization'] = `Bearer ${options.jwt}`;
    }
    const qs = (_a = options === null || options === void 0 ? void 0 : options.query) !== null && _a !== void 0 ? _a : {};
    if (options === null || options === void 0 ? void 0 : options.redirectTo) {
        qs['redirect_to'] = options.redirectTo;
    }
    const queryString = Object.keys(qs).length ? '?' + new URLSearchParams(qs).toString() : '';
    const data = await _handleRequest(fetcher, method, url + queryString, {
        headers,
        noResolveJson: options === null || options === void 0 ? void 0 : options.noResolveJson
    }, {}, options === null || options === void 0 ? void 0 : options.body);
    return (options === null || options === void 0 ? void 0 : options.xform) ? options === null || options === void 0 ? void 0 : options.xform(data) : {
        data: Object.assign({}, data),
        error: null
    };
}
async function _handleRequest(fetcher, method, url, options, parameters, body) {
    const requestParams = _getRequestParams(method, options, parameters, body);
    let result;
    try {
        result = await fetcher(url, Object.assign({}, requestParams));
    } catch (e) {
        console.error(e);
        // fetch failed, likely due to a network or CORS error
        throw new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$errors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["AuthRetryableFetchError"](_getErrorMessage(e), 0);
    }
    if (!result.ok) {
        await handleError(result);
    }
    if (options === null || options === void 0 ? void 0 : options.noResolveJson) {
        return result;
    }
    try {
        return await result.json();
    } catch (e) {
        await handleError(e);
    }
}
function _sessionResponse(data) {
    var _a;
    let session = null;
    if (hasSession(data)) {
        session = Object.assign({}, data);
        if (!data.expires_at) {
            session.expires_at = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$helpers$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["expiresAt"])(data.expires_in);
        }
    }
    const user = (_a = data.user) !== null && _a !== void 0 ? _a : data;
    return {
        data: {
            session,
            user
        },
        error: null
    };
}
function _sessionResponsePassword(data) {
    const response = _sessionResponse(data);
    if (!response.error && data.weak_password && typeof data.weak_password === 'object' && Array.isArray(data.weak_password.reasons) && data.weak_password.reasons.length && data.weak_password.message && typeof data.weak_password.message === 'string' && data.weak_password.reasons.reduce((a, i)=>a && typeof i === 'string', true)) {
        response.data.weak_password = data.weak_password;
    }
    return response;
}
function _userResponse(data) {
    var _a;
    const user = (_a = data.user) !== null && _a !== void 0 ? _a : data;
    return {
        data: {
            user
        },
        error: null
    };
}
function _ssoResponse(data) {
    return {
        data,
        error: null
    };
}
function _generateLinkResponse(data) {
    const { action_link, email_otp, hashed_token, redirect_to, verification_type } = data, rest = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f$tslib$40$2$2e$8$2e$1$2f$node_modules$2f$tslib$2f$tslib$2e$es6$2e$mjs__$5b$middleware$5d$__$28$ecmascript$29$__["__rest"])(data, [
        "action_link",
        "email_otp",
        "hashed_token",
        "redirect_to",
        "verification_type"
    ]);
    const properties = {
        action_link,
        email_otp,
        hashed_token,
        redirect_to,
        verification_type
    };
    const user = Object.assign({}, rest);
    return {
        data: {
            properties,
            user
        },
        error: null
    };
}
function _noResolveJsonResponse(data) {
    return data;
}
/**
 * hasSession checks if the response object contains a valid session
 * @param data A response object
 * @returns true if a session is in the response
 */ function hasSession(data) {
    return data.access_token && data.refresh_token && data.expires_in;
} //# sourceMappingURL=fetch.js.map
}),
"[project]/node_modules/.bun/@supabase+auth-js@2.95.3/node_modules/@supabase/auth-js/dist/module/lib/types.js [middleware] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "SIGN_OUT_SCOPES",
    ()=>SIGN_OUT_SCOPES
]);
const WeakPasswordReasons = [
    'length',
    'characters',
    'pwned'
];
const AMRMethods = [
    'password',
    'otp',
    'oauth',
    'totp',
    'mfa/totp',
    'mfa/phone',
    'mfa/webauthn',
    'anonymous',
    'sso/saml',
    'magiclink',
    'web3',
    'oauth_provider/authorization_code'
];
const FactorTypes = [
    'totp',
    'phone',
    'webauthn'
];
const FactorVerificationStatuses = [
    'verified',
    'unverified'
];
const MFATOTPChannels = [
    'sms',
    'whatsapp'
];
const SIGN_OUT_SCOPES = [
    'global',
    'local',
    'others'
]; //# sourceMappingURL=types.js.map
}),
"[project]/node_modules/.bun/@supabase+auth-js@2.95.3/node_modules/@supabase/auth-js/dist/module/GoTrueAdminApi.js [middleware] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>GoTrueAdminApi
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f$tslib$40$2$2e$8$2e$1$2f$node_modules$2f$tslib$2f$tslib$2e$es6$2e$mjs__$5b$middleware$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.bun/tslib@2.8.1/node_modules/tslib/tslib.es6.mjs [middleware] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$fetch$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.bun/@supabase+auth-js@2.95.3/node_modules/@supabase/auth-js/dist/module/lib/fetch.js [middleware] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$helpers$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.bun/@supabase+auth-js@2.95.3/node_modules/@supabase/auth-js/dist/module/lib/helpers.js [middleware] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$types$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.bun/@supabase+auth-js@2.95.3/node_modules/@supabase/auth-js/dist/module/lib/types.js [middleware] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$errors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.bun/@supabase+auth-js@2.95.3/node_modules/@supabase/auth-js/dist/module/lib/errors.js [middleware] (ecmascript)");
;
;
;
;
;
class GoTrueAdminApi {
    /**
     * Creates an admin API client that can be used to manage users and OAuth clients.
     *
     * @example
     * ```ts
     * import { GoTrueAdminApi } from '@supabase/auth-js'
     *
     * const admin = new GoTrueAdminApi({
     *   url: 'https://xyzcompany.supabase.co/auth/v1',
     *   headers: { Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}` },
     * })
     * ```
     */ constructor({ url = '', headers = {}, fetch }){
        this.url = url;
        this.headers = headers;
        this.fetch = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$helpers$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["resolveFetch"])(fetch);
        this.mfa = {
            listFactors: this._listFactors.bind(this),
            deleteFactor: this._deleteFactor.bind(this)
        };
        this.oauth = {
            listClients: this._listOAuthClients.bind(this),
            createClient: this._createOAuthClient.bind(this),
            getClient: this._getOAuthClient.bind(this),
            updateClient: this._updateOAuthClient.bind(this),
            deleteClient: this._deleteOAuthClient.bind(this),
            regenerateClientSecret: this._regenerateOAuthClientSecret.bind(this)
        };
    }
    /**
     * Removes a logged-in session.
     * @param jwt A valid, logged-in JWT.
     * @param scope The logout sope.
     */ async signOut(jwt, scope = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$types$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["SIGN_OUT_SCOPES"][0]) {
        if (__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$types$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["SIGN_OUT_SCOPES"].indexOf(scope) < 0) {
            throw new Error(`@supabase/auth-js: Parameter scope must be one of ${__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$types$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["SIGN_OUT_SCOPES"].join(', ')}`);
        }
        try {
            await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$fetch$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["_request"])(this.fetch, 'POST', `${this.url}/logout?scope=${scope}`, {
                headers: this.headers,
                jwt,
                noResolveJson: true
            });
            return {
                data: null,
                error: null
            };
        } catch (error) {
            if ((0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$errors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["isAuthError"])(error)) {
                return {
                    data: null,
                    error
                };
            }
            throw error;
        }
    }
    /**
     * Sends an invite link to an email address.
     * @param email The email address of the user.
     * @param options Additional options to be included when inviting.
     */ async inviteUserByEmail(email, options = {}) {
        try {
            return await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$fetch$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["_request"])(this.fetch, 'POST', `${this.url}/invite`, {
                body: {
                    email,
                    data: options.data
                },
                headers: this.headers,
                redirectTo: options.redirectTo,
                xform: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$fetch$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["_userResponse"]
            });
        } catch (error) {
            if ((0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$errors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["isAuthError"])(error)) {
                return {
                    data: {
                        user: null
                    },
                    error
                };
            }
            throw error;
        }
    }
    /**
     * Generates email links and OTPs to be sent via a custom email provider.
     * @param email The user's email.
     * @param options.password User password. For signup only.
     * @param options.data Optional user metadata. For signup only.
     * @param options.redirectTo The redirect url which should be appended to the generated link
     */ async generateLink(params) {
        try {
            const { options } = params, rest = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f$tslib$40$2$2e$8$2e$1$2f$node_modules$2f$tslib$2f$tslib$2e$es6$2e$mjs__$5b$middleware$5d$__$28$ecmascript$29$__["__rest"])(params, [
                "options"
            ]);
            const body = Object.assign(Object.assign({}, rest), options);
            if ('newEmail' in rest) {
                // replace newEmail with new_email in request body
                body.new_email = rest === null || rest === void 0 ? void 0 : rest.newEmail;
                delete body['newEmail'];
            }
            return await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$fetch$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["_request"])(this.fetch, 'POST', `${this.url}/admin/generate_link`, {
                body: body,
                headers: this.headers,
                xform: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$fetch$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["_generateLinkResponse"],
                redirectTo: options === null || options === void 0 ? void 0 : options.redirectTo
            });
        } catch (error) {
            if ((0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$errors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["isAuthError"])(error)) {
                return {
                    data: {
                        properties: null,
                        user: null
                    },
                    error
                };
            }
            throw error;
        }
    }
    // User Admin API
    /**
     * Creates a new user.
     * This function should only be called on a server. Never expose your `service_role` key in the browser.
     */ async createUser(attributes) {
        try {
            return await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$fetch$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["_request"])(this.fetch, 'POST', `${this.url}/admin/users`, {
                body: attributes,
                headers: this.headers,
                xform: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$fetch$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["_userResponse"]
            });
        } catch (error) {
            if ((0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$errors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["isAuthError"])(error)) {
                return {
                    data: {
                        user: null
                    },
                    error
                };
            }
            throw error;
        }
    }
    /**
     * Get a list of users.
     *
     * This function should only be called on a server. Never expose your `service_role` key in the browser.
     * @param params An object which supports `page` and `perPage` as numbers, to alter the paginated results.
     */ async listUsers(params) {
        var _a, _b, _c, _d, _e, _f, _g;
        try {
            const pagination = {
                nextPage: null,
                lastPage: 0,
                total: 0
            };
            const response = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$fetch$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["_request"])(this.fetch, 'GET', `${this.url}/admin/users`, {
                headers: this.headers,
                noResolveJson: true,
                query: {
                    page: (_b = (_a = params === null || params === void 0 ? void 0 : params.page) === null || _a === void 0 ? void 0 : _a.toString()) !== null && _b !== void 0 ? _b : '',
                    per_page: (_d = (_c = params === null || params === void 0 ? void 0 : params.perPage) === null || _c === void 0 ? void 0 : _c.toString()) !== null && _d !== void 0 ? _d : ''
                },
                xform: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$fetch$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["_noResolveJsonResponse"]
            });
            if (response.error) throw response.error;
            const users = await response.json();
            const total = (_e = response.headers.get('x-total-count')) !== null && _e !== void 0 ? _e : 0;
            const links = (_g = (_f = response.headers.get('link')) === null || _f === void 0 ? void 0 : _f.split(',')) !== null && _g !== void 0 ? _g : [];
            if (links.length > 0) {
                links.forEach((link)=>{
                    const page = parseInt(link.split(';')[0].split('=')[1].substring(0, 1));
                    const rel = JSON.parse(link.split(';')[1].split('=')[1]);
                    pagination[`${rel}Page`] = page;
                });
                pagination.total = parseInt(total);
            }
            return {
                data: Object.assign(Object.assign({}, users), pagination),
                error: null
            };
        } catch (error) {
            if ((0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$errors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["isAuthError"])(error)) {
                return {
                    data: {
                        users: []
                    },
                    error
                };
            }
            throw error;
        }
    }
    /**
     * Get user by id.
     *
     * @param uid The user's unique identifier
     *
     * This function should only be called on a server. Never expose your `service_role` key in the browser.
     */ async getUserById(uid) {
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$helpers$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["validateUUID"])(uid);
        try {
            return await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$fetch$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["_request"])(this.fetch, 'GET', `${this.url}/admin/users/${uid}`, {
                headers: this.headers,
                xform: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$fetch$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["_userResponse"]
            });
        } catch (error) {
            if ((0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$errors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["isAuthError"])(error)) {
                return {
                    data: {
                        user: null
                    },
                    error
                };
            }
            throw error;
        }
    }
    /**
     * Updates the user data. Changes are applied directly without confirmation flows.
     *
     * @param attributes The data you want to update.
     *
     * This function should only be called on a server. Never expose your `service_role` key in the browser.
     */ async updateUserById(uid, attributes) {
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$helpers$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["validateUUID"])(uid);
        try {
            return await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$fetch$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["_request"])(this.fetch, 'PUT', `${this.url}/admin/users/${uid}`, {
                body: attributes,
                headers: this.headers,
                xform: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$fetch$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["_userResponse"]
            });
        } catch (error) {
            if ((0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$errors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["isAuthError"])(error)) {
                return {
                    data: {
                        user: null
                    },
                    error
                };
            }
            throw error;
        }
    }
    /**
     * Delete a user. Requires a `service_role` key.
     *
     * @param id The user id you want to remove.
     * @param shouldSoftDelete If true, then the user will be soft-deleted from the auth schema. Soft deletion allows user identification from the hashed user ID but is not reversible.
     * Defaults to false for backward compatibility.
     *
     * This function should only be called on a server. Never expose your `service_role` key in the browser.
     */ async deleteUser(id, shouldSoftDelete = false) {
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$helpers$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["validateUUID"])(id);
        try {
            return await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$fetch$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["_request"])(this.fetch, 'DELETE', `${this.url}/admin/users/${id}`, {
                headers: this.headers,
                body: {
                    should_soft_delete: shouldSoftDelete
                },
                xform: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$fetch$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["_userResponse"]
            });
        } catch (error) {
            if ((0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$errors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["isAuthError"])(error)) {
                return {
                    data: {
                        user: null
                    },
                    error
                };
            }
            throw error;
        }
    }
    async _listFactors(params) {
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$helpers$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["validateUUID"])(params.userId);
        try {
            const { data, error } = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$fetch$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["_request"])(this.fetch, 'GET', `${this.url}/admin/users/${params.userId}/factors`, {
                headers: this.headers,
                xform: (factors)=>{
                    return {
                        data: {
                            factors
                        },
                        error: null
                    };
                }
            });
            return {
                data,
                error
            };
        } catch (error) {
            if ((0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$errors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["isAuthError"])(error)) {
                return {
                    data: null,
                    error
                };
            }
            throw error;
        }
    }
    async _deleteFactor(params) {
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$helpers$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["validateUUID"])(params.userId);
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$helpers$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["validateUUID"])(params.id);
        try {
            const data = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$fetch$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["_request"])(this.fetch, 'DELETE', `${this.url}/admin/users/${params.userId}/factors/${params.id}`, {
                headers: this.headers
            });
            return {
                data,
                error: null
            };
        } catch (error) {
            if ((0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$errors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["isAuthError"])(error)) {
                return {
                    data: null,
                    error
                };
            }
            throw error;
        }
    }
    /**
     * Lists all OAuth clients with optional pagination.
     * Only relevant when the OAuth 2.1 server is enabled in Supabase Auth.
     *
     * This function should only be called on a server. Never expose your `service_role` key in the browser.
     */ async _listOAuthClients(params) {
        var _a, _b, _c, _d, _e, _f, _g;
        try {
            const pagination = {
                nextPage: null,
                lastPage: 0,
                total: 0
            };
            const response = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$fetch$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["_request"])(this.fetch, 'GET', `${this.url}/admin/oauth/clients`, {
                headers: this.headers,
                noResolveJson: true,
                query: {
                    page: (_b = (_a = params === null || params === void 0 ? void 0 : params.page) === null || _a === void 0 ? void 0 : _a.toString()) !== null && _b !== void 0 ? _b : '',
                    per_page: (_d = (_c = params === null || params === void 0 ? void 0 : params.perPage) === null || _c === void 0 ? void 0 : _c.toString()) !== null && _d !== void 0 ? _d : ''
                },
                xform: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$fetch$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["_noResolveJsonResponse"]
            });
            if (response.error) throw response.error;
            const clients = await response.json();
            const total = (_e = response.headers.get('x-total-count')) !== null && _e !== void 0 ? _e : 0;
            const links = (_g = (_f = response.headers.get('link')) === null || _f === void 0 ? void 0 : _f.split(',')) !== null && _g !== void 0 ? _g : [];
            if (links.length > 0) {
                links.forEach((link)=>{
                    const page = parseInt(link.split(';')[0].split('=')[1].substring(0, 1));
                    const rel = JSON.parse(link.split(';')[1].split('=')[1]);
                    pagination[`${rel}Page`] = page;
                });
                pagination.total = parseInt(total);
            }
            return {
                data: Object.assign(Object.assign({}, clients), pagination),
                error: null
            };
        } catch (error) {
            if ((0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$errors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["isAuthError"])(error)) {
                return {
                    data: {
                        clients: []
                    },
                    error
                };
            }
            throw error;
        }
    }
    /**
     * Creates a new OAuth client.
     * Only relevant when the OAuth 2.1 server is enabled in Supabase Auth.
     *
     * This function should only be called on a server. Never expose your `service_role` key in the browser.
     */ async _createOAuthClient(params) {
        try {
            return await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$fetch$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["_request"])(this.fetch, 'POST', `${this.url}/admin/oauth/clients`, {
                body: params,
                headers: this.headers,
                xform: (client)=>{
                    return {
                        data: client,
                        error: null
                    };
                }
            });
        } catch (error) {
            if ((0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$errors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["isAuthError"])(error)) {
                return {
                    data: null,
                    error
                };
            }
            throw error;
        }
    }
    /**
     * Gets details of a specific OAuth client.
     * Only relevant when the OAuth 2.1 server is enabled in Supabase Auth.
     *
     * This function should only be called on a server. Never expose your `service_role` key in the browser.
     */ async _getOAuthClient(clientId) {
        try {
            return await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$fetch$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["_request"])(this.fetch, 'GET', `${this.url}/admin/oauth/clients/${clientId}`, {
                headers: this.headers,
                xform: (client)=>{
                    return {
                        data: client,
                        error: null
                    };
                }
            });
        } catch (error) {
            if ((0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$errors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["isAuthError"])(error)) {
                return {
                    data: null,
                    error
                };
            }
            throw error;
        }
    }
    /**
     * Updates an existing OAuth client.
     * Only relevant when the OAuth 2.1 server is enabled in Supabase Auth.
     *
     * This function should only be called on a server. Never expose your `service_role` key in the browser.
     */ async _updateOAuthClient(clientId, params) {
        try {
            return await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$fetch$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["_request"])(this.fetch, 'PUT', `${this.url}/admin/oauth/clients/${clientId}`, {
                body: params,
                headers: this.headers,
                xform: (client)=>{
                    return {
                        data: client,
                        error: null
                    };
                }
            });
        } catch (error) {
            if ((0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$errors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["isAuthError"])(error)) {
                return {
                    data: null,
                    error
                };
            }
            throw error;
        }
    }
    /**
     * Deletes an OAuth client.
     * Only relevant when the OAuth 2.1 server is enabled in Supabase Auth.
     *
     * This function should only be called on a server. Never expose your `service_role` key in the browser.
     */ async _deleteOAuthClient(clientId) {
        try {
            await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$fetch$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["_request"])(this.fetch, 'DELETE', `${this.url}/admin/oauth/clients/${clientId}`, {
                headers: this.headers,
                noResolveJson: true
            });
            return {
                data: null,
                error: null
            };
        } catch (error) {
            if ((0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$errors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["isAuthError"])(error)) {
                return {
                    data: null,
                    error
                };
            }
            throw error;
        }
    }
    /**
     * Regenerates the secret for an OAuth client.
     * Only relevant when the OAuth 2.1 server is enabled in Supabase Auth.
     *
     * This function should only be called on a server. Never expose your `service_role` key in the browser.
     */ async _regenerateOAuthClientSecret(clientId) {
        try {
            return await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$fetch$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["_request"])(this.fetch, 'POST', `${this.url}/admin/oauth/clients/${clientId}/regenerate_secret`, {
                headers: this.headers,
                xform: (client)=>{
                    return {
                        data: client,
                        error: null
                    };
                }
            });
        } catch (error) {
            if ((0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$errors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["isAuthError"])(error)) {
                return {
                    data: null,
                    error
                };
            }
            throw error;
        }
    }
} //# sourceMappingURL=GoTrueAdminApi.js.map
}),
"[project]/node_modules/.bun/@supabase+auth-js@2.95.3/node_modules/@supabase/auth-js/dist/module/lib/local-storage.js [middleware] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/**
 * Returns a localStorage-like object that stores the key-value pairs in
 * memory.
 */ __turbopack_context__.s([
    "memoryLocalStorageAdapter",
    ()=>memoryLocalStorageAdapter
]);
function memoryLocalStorageAdapter(store = {}) {
    return {
        getItem: (key)=>{
            return store[key] || null;
        },
        setItem: (key, value)=>{
            store[key] = value;
        },
        removeItem: (key)=>{
            delete store[key];
        }
    };
} //# sourceMappingURL=local-storage.js.map
}),
"[project]/node_modules/.bun/@supabase+auth-js@2.95.3/node_modules/@supabase/auth-js/dist/module/lib/locks.js [middleware] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "LockAcquireTimeoutError",
    ()=>LockAcquireTimeoutError,
    "NavigatorLockAcquireTimeoutError",
    ()=>NavigatorLockAcquireTimeoutError,
    "ProcessLockAcquireTimeoutError",
    ()=>ProcessLockAcquireTimeoutError,
    "internals",
    ()=>internals,
    "navigatorLock",
    ()=>navigatorLock,
    "processLock",
    ()=>processLock
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$helpers$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.bun/@supabase+auth-js@2.95.3/node_modules/@supabase/auth-js/dist/module/lib/helpers.js [middleware] (ecmascript)");
;
const internals = {
    /**
     * @experimental
     */ debug: !!(globalThis && (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$helpers$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["supportsLocalStorage"])() && globalThis.localStorage && globalThis.localStorage.getItem('supabase.gotrue-js.locks.debug') === 'true')
};
class LockAcquireTimeoutError extends Error {
    constructor(message){
        super(message);
        this.isAcquireTimeout = true;
    }
}
class NavigatorLockAcquireTimeoutError extends LockAcquireTimeoutError {
}
class ProcessLockAcquireTimeoutError extends LockAcquireTimeoutError {
}
async function navigatorLock(name, acquireTimeout, fn) {
    if (internals.debug) {
        console.log('@supabase/gotrue-js: navigatorLock: acquire lock', name, acquireTimeout);
    }
    const abortController = new globalThis.AbortController();
    if (acquireTimeout > 0) {
        setTimeout(()=>{
            abortController.abort();
            if (internals.debug) {
                console.log('@supabase/gotrue-js: navigatorLock acquire timed out', name);
            }
        }, acquireTimeout);
    }
    // MDN article: https://developer.mozilla.org/en-US/docs/Web/API/LockManager/request
    // Wrapping navigator.locks.request() with a plain Promise is done as some
    // libraries like zone.js patch the Promise object to track the execution
    // context. However, it appears that most browsers use an internal promise
    // implementation when using the navigator.locks.request() API causing them
    // to lose context and emit confusing log messages or break certain features.
    // This wrapping is believed to help zone.js track the execution context
    // better.
    return await Promise.resolve().then(()=>globalThis.navigator.locks.request(name, acquireTimeout === 0 ? {
            mode: 'exclusive',
            ifAvailable: true
        } : {
            mode: 'exclusive',
            signal: abortController.signal
        }, async (lock)=>{
            if (lock) {
                if (internals.debug) {
                    console.log('@supabase/gotrue-js: navigatorLock: acquired', name, lock.name);
                }
                try {
                    return await fn();
                } finally{
                    if (internals.debug) {
                        console.log('@supabase/gotrue-js: navigatorLock: released', name, lock.name);
                    }
                }
            } else {
                if (acquireTimeout === 0) {
                    if (internals.debug) {
                        console.log('@supabase/gotrue-js: navigatorLock: not immediately available', name);
                    }
                    throw new NavigatorLockAcquireTimeoutError(`Acquiring an exclusive Navigator LockManager lock "${name}" immediately failed`);
                } else {
                    if (internals.debug) {
                        try {
                            const result = await globalThis.navigator.locks.query();
                            console.log('@supabase/gotrue-js: Navigator LockManager state', JSON.stringify(result, null, '  '));
                        } catch (e) {
                            console.warn('@supabase/gotrue-js: Error when querying Navigator LockManager state', e);
                        }
                    }
                    // Browser is not following the Navigator LockManager spec, it
                    // returned a null lock when we didn't use ifAvailable. So we can
                    // pretend the lock is acquired in the name of backward compatibility
                    // and user experience and just run the function.
                    console.warn('@supabase/gotrue-js: Navigator LockManager returned a null lock when using #request without ifAvailable set to true, it appears this browser is not following the LockManager spec https://developer.mozilla.org/en-US/docs/Web/API/LockManager/request');
                    return await fn();
                }
            }
        }));
}
const PROCESS_LOCKS = {};
async function processLock(name, acquireTimeout, fn) {
    var _a;
    const previousOperation = (_a = PROCESS_LOCKS[name]) !== null && _a !== void 0 ? _a : Promise.resolve();
    const currentOperation = Promise.race([
        previousOperation.catch(()=>{
            // ignore error of previous operation that we're waiting to finish
            return null;
        }),
        acquireTimeout >= 0 ? new Promise((_, reject)=>{
            setTimeout(()=>{
                console.warn(`@supabase/gotrue-js: Lock "${name}" acquisition timed out after ${acquireTimeout}ms. ` + 'This may be caused by another operation holding the lock. ' + 'Consider increasing lockAcquireTimeout or checking for stuck operations.');
                reject(new ProcessLockAcquireTimeoutError(`Acquiring process lock with name "${name}" timed out`));
            }, acquireTimeout);
        }) : null
    ].filter((x)=>x)).catch((e)=>{
        if (e && e.isAcquireTimeout) {
            throw e;
        }
        return null;
    }).then(async ()=>{
        // previous operations finished and we didn't get a race on the acquire
        // timeout, so the current operation can finally start
        return await fn();
    });
    PROCESS_LOCKS[name] = currentOperation.catch(async (e)=>{
        if (e && e.isAcquireTimeout) {
            // if the current operation timed out, it doesn't mean that the previous
            // operation finished, so we need contnue waiting for it to finish
            await previousOperation;
            return null;
        }
        throw e;
    });
    // finally wait for the current operation to finish successfully, with an
    // error or with an acquire timeout error
    return await currentOperation;
} //# sourceMappingURL=locks.js.map
}),
"[project]/node_modules/.bun/@supabase+auth-js@2.95.3/node_modules/@supabase/auth-js/dist/module/lib/polyfills.js [middleware] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/**
 * https://mathiasbynens.be/notes/globalthis
 */ __turbopack_context__.s([
    "polyfillGlobalThis",
    ()=>polyfillGlobalThis
]);
function polyfillGlobalThis() {
    if (typeof globalThis === 'object') return;
    try {
        Object.defineProperty(Object.prototype, '__magic__', {
            get: function() {
                return this;
            },
            configurable: true
        });
        // @ts-expect-error 'Allow access to magic'
        __magic__.globalThis = __magic__;
        // @ts-expect-error 'Allow access to magic'
        delete Object.prototype.__magic__;
    } catch (e) {
        if (typeof self !== 'undefined') {
            // @ts-expect-error 'Allow access to globals'
            self.globalThis = self;
        }
    }
} //# sourceMappingURL=polyfills.js.map
}),
"[project]/node_modules/.bun/@supabase+auth-js@2.95.3/node_modules/@supabase/auth-js/dist/module/lib/web3/ethereum.js [middleware] (ecmascript)", ((__turbopack_context__) => {
"use strict";

// types and functions copied over from viem so this library doesn't depend on it
__turbopack_context__.s([
    "createSiweMessage",
    ()=>createSiweMessage,
    "fromHex",
    ()=>fromHex,
    "getAddress",
    ()=>getAddress,
    "toHex",
    ()=>toHex
]);
function getAddress(address) {
    if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
        throw new Error(`@supabase/auth-js: Address "${address}" is invalid.`);
    }
    return address.toLowerCase();
}
function fromHex(hex) {
    return parseInt(hex, 16);
}
function toHex(value) {
    const bytes = new TextEncoder().encode(value);
    const hex = Array.from(bytes, (byte)=>byte.toString(16).padStart(2, '0')).join('');
    return '0x' + hex;
}
function createSiweMessage(parameters) {
    var _a;
    const { chainId, domain, expirationTime, issuedAt = new Date(), nonce, notBefore, requestId, resources, scheme, uri, version } = parameters;
    // Validate fields
    {
        if (!Number.isInteger(chainId)) throw new Error(`@supabase/auth-js: Invalid SIWE message field "chainId". Chain ID must be a EIP-155 chain ID. Provided value: ${chainId}`);
        if (!domain) throw new Error(`@supabase/auth-js: Invalid SIWE message field "domain". Domain must be provided.`);
        if (nonce && nonce.length < 8) throw new Error(`@supabase/auth-js: Invalid SIWE message field "nonce". Nonce must be at least 8 characters. Provided value: ${nonce}`);
        if (!uri) throw new Error(`@supabase/auth-js: Invalid SIWE message field "uri". URI must be provided.`);
        if (version !== '1') throw new Error(`@supabase/auth-js: Invalid SIWE message field "version". Version must be '1'. Provided value: ${version}`);
        if ((_a = parameters.statement) === null || _a === void 0 ? void 0 : _a.includes('\n')) throw new Error(`@supabase/auth-js: Invalid SIWE message field "statement". Statement must not include '\\n'. Provided value: ${parameters.statement}`);
    }
    // Construct message
    const address = getAddress(parameters.address);
    const origin = scheme ? `${scheme}://${domain}` : domain;
    const statement = parameters.statement ? `${parameters.statement}\n` : '';
    const prefix = `${origin} wants you to sign in with your Ethereum account:\n${address}\n\n${statement}`;
    let suffix = `URI: ${uri}\nVersion: ${version}\nChain ID: ${chainId}${nonce ? `\nNonce: ${nonce}` : ''}\nIssued At: ${issuedAt.toISOString()}`;
    if (expirationTime) suffix += `\nExpiration Time: ${expirationTime.toISOString()}`;
    if (notBefore) suffix += `\nNot Before: ${notBefore.toISOString()}`;
    if (requestId) suffix += `\nRequest ID: ${requestId}`;
    if (resources) {
        let content = '\nResources:';
        for (const resource of resources){
            if (!resource || typeof resource !== 'string') throw new Error(`@supabase/auth-js: Invalid SIWE message field "resources". Every resource must be a valid string. Provided value: ${resource}`);
            content += `\n- ${resource}`;
        }
        suffix += content;
    }
    return `${prefix}\n${suffix}`;
} //# sourceMappingURL=ethereum.js.map
}),
"[project]/node_modules/.bun/@supabase+auth-js@2.95.3/node_modules/@supabase/auth-js/dist/module/lib/webauthn.errors.js [middleware] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "WebAuthnError",
    ()=>WebAuthnError,
    "WebAuthnUnknownError",
    ()=>WebAuthnUnknownError,
    "identifyAuthenticationError",
    ()=>identifyAuthenticationError,
    "identifyRegistrationError",
    ()=>identifyRegistrationError,
    "isWebAuthnError",
    ()=>isWebAuthnError
]);
/* eslint-disable @typescript-eslint/ban-ts-comment */ var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$webauthn$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/node_modules/.bun/@supabase+auth-js@2.95.3/node_modules/@supabase/auth-js/dist/module/lib/webauthn.js [middleware] (ecmascript) <locals>");
;
class WebAuthnError extends Error {
    constructor({ message, code, cause, name }){
        var _a;
        // @ts-ignore: help Rollup understand that `cause` is okay to set
        super(message, {
            cause
        });
        this.__isWebAuthnError = true;
        this.name = (_a = name !== null && name !== void 0 ? name : cause instanceof Error ? cause.name : undefined) !== null && _a !== void 0 ? _a : 'Unknown Error';
        this.code = code;
    }
}
class WebAuthnUnknownError extends WebAuthnError {
    constructor(message, originalError){
        super({
            code: 'ERROR_PASSTHROUGH_SEE_CAUSE_PROPERTY',
            cause: originalError,
            message
        });
        this.name = 'WebAuthnUnknownError';
        this.originalError = originalError;
    }
}
function isWebAuthnError(error) {
    return typeof error === 'object' && error !== null && '__isWebAuthnError' in error;
}
function identifyRegistrationError({ error, options }) {
    var _a, _b, _c;
    const { publicKey } = options;
    if (!publicKey) {
        throw Error('options was missing required publicKey property');
    }
    if (error.name === 'AbortError') {
        if (options.signal instanceof AbortSignal) {
            // https://www.w3.org/TR/webauthn-2/#sctn-createCredential (Step 16)
            return new WebAuthnError({
                message: 'Registration ceremony was sent an abort signal',
                code: 'ERROR_CEREMONY_ABORTED',
                cause: error
            });
        }
    } else if (error.name === 'ConstraintError') {
        if (((_a = publicKey.authenticatorSelection) === null || _a === void 0 ? void 0 : _a.requireResidentKey) === true) {
            // https://www.w3.org/TR/webauthn-2/#sctn-op-make-cred (Step 4)
            return new WebAuthnError({
                message: 'Discoverable credentials were required but no available authenticator supported it',
                code: 'ERROR_AUTHENTICATOR_MISSING_DISCOVERABLE_CREDENTIAL_SUPPORT',
                cause: error
            });
        } else if (// @ts-ignore: `mediation` doesn't yet exist on CredentialCreationOptions but it's possible as of Sept 2024
        options.mediation === 'conditional' && ((_b = publicKey.authenticatorSelection) === null || _b === void 0 ? void 0 : _b.userVerification) === 'required') {
            // https://w3c.github.io/webauthn/#sctn-createCredential (Step 22.4)
            return new WebAuthnError({
                message: 'User verification was required during automatic registration but it could not be performed',
                code: 'ERROR_AUTO_REGISTER_USER_VERIFICATION_FAILURE',
                cause: error
            });
        } else if (((_c = publicKey.authenticatorSelection) === null || _c === void 0 ? void 0 : _c.userVerification) === 'required') {
            // https://www.w3.org/TR/webauthn-2/#sctn-op-make-cred (Step 5)
            return new WebAuthnError({
                message: 'User verification was required but no available authenticator supported it',
                code: 'ERROR_AUTHENTICATOR_MISSING_USER_VERIFICATION_SUPPORT',
                cause: error
            });
        }
    } else if (error.name === 'InvalidStateError') {
        // https://www.w3.org/TR/webauthn-2/#sctn-createCredential (Step 20)
        // https://www.w3.org/TR/webauthn-2/#sctn-op-make-cred (Step 3)
        return new WebAuthnError({
            message: 'The authenticator was previously registered',
            code: 'ERROR_AUTHENTICATOR_PREVIOUSLY_REGISTERED',
            cause: error
        });
    } else if (error.name === 'NotAllowedError') {
        /**
         * Pass the error directly through. Platforms are overloading this error beyond what the spec
         * defines and we don't want to overwrite potentially useful error messages.
         */ return new WebAuthnError({
            message: error.message,
            code: 'ERROR_PASSTHROUGH_SEE_CAUSE_PROPERTY',
            cause: error
        });
    } else if (error.name === 'NotSupportedError') {
        const validPubKeyCredParams = publicKey.pubKeyCredParams.filter((param)=>param.type === 'public-key');
        if (validPubKeyCredParams.length === 0) {
            // https://www.w3.org/TR/webauthn-2/#sctn-createCredential (Step 10)
            return new WebAuthnError({
                message: 'No entry in pubKeyCredParams was of type "public-key"',
                code: 'ERROR_MALFORMED_PUBKEYCREDPARAMS',
                cause: error
            });
        }
        // https://www.w3.org/TR/webauthn-2/#sctn-op-make-cred (Step 2)
        return new WebAuthnError({
            message: 'No available authenticator supported any of the specified pubKeyCredParams algorithms',
            code: 'ERROR_AUTHENTICATOR_NO_SUPPORTED_PUBKEYCREDPARAMS_ALG',
            cause: error
        });
    } else if (error.name === 'SecurityError') {
        const effectiveDomain = window.location.hostname;
        if (!(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$webauthn$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__$3c$locals$3e$__["isValidDomain"])(effectiveDomain)) {
            // https://www.w3.org/TR/webauthn-2/#sctn-createCredential (Step 7)
            return new WebAuthnError({
                message: `${window.location.hostname} is an invalid domain`,
                code: 'ERROR_INVALID_DOMAIN',
                cause: error
            });
        } else if (publicKey.rp.id !== effectiveDomain) {
            // https://www.w3.org/TR/webauthn-2/#sctn-createCredential (Step 8)
            return new WebAuthnError({
                message: `The RP ID "${publicKey.rp.id}" is invalid for this domain`,
                code: 'ERROR_INVALID_RP_ID',
                cause: error
            });
        }
    } else if (error.name === 'TypeError') {
        if (publicKey.user.id.byteLength < 1 || publicKey.user.id.byteLength > 64) {
            // https://www.w3.org/TR/webauthn-2/#sctn-createCredential (Step 5)
            return new WebAuthnError({
                message: 'User ID was not between 1 and 64 characters',
                code: 'ERROR_INVALID_USER_ID_LENGTH',
                cause: error
            });
        }
    } else if (error.name === 'UnknownError') {
        // https://www.w3.org/TR/webauthn-2/#sctn-op-make-cred (Step 1)
        // https://www.w3.org/TR/webauthn-2/#sctn-op-make-cred (Step 8)
        return new WebAuthnError({
            message: 'The authenticator was unable to process the specified options, or could not create a new credential',
            code: 'ERROR_AUTHENTICATOR_GENERAL_ERROR',
            cause: error
        });
    }
    return new WebAuthnError({
        message: 'a Non-Webauthn related error has occurred',
        code: 'ERROR_PASSTHROUGH_SEE_CAUSE_PROPERTY',
        cause: error
    });
}
function identifyAuthenticationError({ error, options }) {
    const { publicKey } = options;
    if (!publicKey) {
        throw Error('options was missing required publicKey property');
    }
    if (error.name === 'AbortError') {
        if (options.signal instanceof AbortSignal) {
            // https://www.w3.org/TR/webauthn-2/#sctn-createCredential (Step 16)
            return new WebAuthnError({
                message: 'Authentication ceremony was sent an abort signal',
                code: 'ERROR_CEREMONY_ABORTED',
                cause: error
            });
        }
    } else if (error.name === 'NotAllowedError') {
        /**
         * Pass the error directly through. Platforms are overloading this error beyond what the spec
         * defines and we don't want to overwrite potentially useful error messages.
         */ return new WebAuthnError({
            message: error.message,
            code: 'ERROR_PASSTHROUGH_SEE_CAUSE_PROPERTY',
            cause: error
        });
    } else if (error.name === 'SecurityError') {
        const effectiveDomain = window.location.hostname;
        if (!(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$webauthn$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__$3c$locals$3e$__["isValidDomain"])(effectiveDomain)) {
            // https://www.w3.org/TR/webauthn-2/#sctn-discover-from-external-source (Step 5)
            return new WebAuthnError({
                message: `${window.location.hostname} is an invalid domain`,
                code: 'ERROR_INVALID_DOMAIN',
                cause: error
            });
        } else if (publicKey.rpId !== effectiveDomain) {
            // https://www.w3.org/TR/webauthn-2/#sctn-discover-from-external-source (Step 6)
            return new WebAuthnError({
                message: `The RP ID "${publicKey.rpId}" is invalid for this domain`,
                code: 'ERROR_INVALID_RP_ID',
                cause: error
            });
        }
    } else if (error.name === 'UnknownError') {
        // https://www.w3.org/TR/webauthn-2/#sctn-op-get-assertion (Step 1)
        // https://www.w3.org/TR/webauthn-2/#sctn-op-get-assertion (Step 12)
        return new WebAuthnError({
            message: 'The authenticator was unable to process the specified options, or could not create a new assertion signature',
            code: 'ERROR_AUTHENTICATOR_GENERAL_ERROR',
            cause: error
        });
    }
    return new WebAuthnError({
        message: 'a Non-Webauthn related error has occurred',
        code: 'ERROR_PASSTHROUGH_SEE_CAUSE_PROPERTY',
        cause: error
    });
} //# sourceMappingURL=webauthn.errors.js.map
}),
"[project]/node_modules/.bun/@supabase+auth-js@2.95.3/node_modules/@supabase/auth-js/dist/module/lib/webauthn.js [middleware] (ecmascript) <locals>", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "DEFAULT_CREATION_OPTIONS",
    ()=>DEFAULT_CREATION_OPTIONS,
    "DEFAULT_REQUEST_OPTIONS",
    ()=>DEFAULT_REQUEST_OPTIONS,
    "WebAuthnAbortService",
    ()=>WebAuthnAbortService,
    "WebAuthnApi",
    ()=>WebAuthnApi,
    "createCredential",
    ()=>createCredential,
    "deserializeCredentialCreationOptions",
    ()=>deserializeCredentialCreationOptions,
    "deserializeCredentialRequestOptions",
    ()=>deserializeCredentialRequestOptions,
    "getCredential",
    ()=>getCredential,
    "isValidDomain",
    ()=>isValidDomain,
    "mergeCredentialCreationOptions",
    ()=>mergeCredentialCreationOptions,
    "mergeCredentialRequestOptions",
    ()=>mergeCredentialRequestOptions,
    "serializeCredentialCreationResponse",
    ()=>serializeCredentialCreationResponse,
    "serializeCredentialRequestResponse",
    ()=>serializeCredentialRequestResponse,
    "webAuthnAbortService",
    ()=>webAuthnAbortService
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f$tslib$40$2$2e$8$2e$1$2f$node_modules$2f$tslib$2f$tslib$2e$es6$2e$mjs__$5b$middleware$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.bun/tslib@2.8.1/node_modules/tslib/tslib.es6.mjs [middleware] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$base64url$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.bun/@supabase+auth-js@2.95.3/node_modules/@supabase/auth-js/dist/module/lib/base64url.js [middleware] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$errors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.bun/@supabase+auth-js@2.95.3/node_modules/@supabase/auth-js/dist/module/lib/errors.js [middleware] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$helpers$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.bun/@supabase+auth-js@2.95.3/node_modules/@supabase/auth-js/dist/module/lib/helpers.js [middleware] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$webauthn$2e$errors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.bun/@supabase+auth-js@2.95.3/node_modules/@supabase/auth-js/dist/module/lib/webauthn.errors.js [middleware] (ecmascript)");
;
;
;
;
;
;
class WebAuthnAbortService {
    /**
     * Create an abort signal for a new WebAuthn operation.
     * Automatically cancels any existing operation.
     *
     * @returns {AbortSignal} Signal to pass to navigator.credentials.create() or .get()
     * @see {@link https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal MDN - AbortSignal}
     */ createNewAbortSignal() {
        // Abort any existing calls to navigator.credentials.create() or navigator.credentials.get()
        if (this.controller) {
            const abortError = new Error('Cancelling existing WebAuthn API call for new one');
            abortError.name = 'AbortError';
            this.controller.abort(abortError);
        }
        const newController = new AbortController();
        this.controller = newController;
        return newController.signal;
    }
    /**
     * Manually cancel the current WebAuthn operation.
     * Useful for cleaning up when user cancels or navigates away.
     *
     * @see {@link https://developer.mozilla.org/en-US/docs/Web/API/AbortController/abort MDN - AbortController.abort}
     */ cancelCeremony() {
        if (this.controller) {
            const abortError = new Error('Manually cancelling existing WebAuthn API call');
            abortError.name = 'AbortError';
            this.controller.abort(abortError);
            this.controller = undefined;
        }
    }
}
const webAuthnAbortService = new WebAuthnAbortService();
function deserializeCredentialCreationOptions(options) {
    if (!options) {
        throw new Error('Credential creation options are required');
    }
    // Check if the native parseCreationOptionsFromJSON method is available
    if (typeof PublicKeyCredential !== 'undefined' && 'parseCreationOptionsFromJSON' in PublicKeyCredential && typeof PublicKeyCredential.parseCreationOptionsFromJSON === 'function') {
        // Use the native WebAuthn Level 3 method
        return PublicKeyCredential.parseCreationOptionsFromJSON(/** we assert the options here as typescript still doesn't know about future webauthn types */ options);
    }
    // Fallback to manual parsing for browsers that don't support the native method
    // Destructure to separate fields that need transformation
    const { challenge: challengeStr, user: userOpts, excludeCredentials } = options, restOptions = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f$tslib$40$2$2e$8$2e$1$2f$node_modules$2f$tslib$2f$tslib$2e$es6$2e$mjs__$5b$middleware$5d$__$28$ecmascript$29$__["__rest"])(options, [
        "challenge",
        "user",
        "excludeCredentials"
    ]);
    // Convert challenge from base64url to ArrayBuffer
    const challenge = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$base64url$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["base64UrlToUint8Array"])(challengeStr).buffer;
    // Convert user.id from base64url to ArrayBuffer
    const user = Object.assign(Object.assign({}, userOpts), {
        id: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$base64url$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["base64UrlToUint8Array"])(userOpts.id).buffer
    });
    // Build the result object
    const result = Object.assign(Object.assign({}, restOptions), {
        challenge,
        user
    });
    // Only add excludeCredentials if it exists
    if (excludeCredentials && excludeCredentials.length > 0) {
        result.excludeCredentials = new Array(excludeCredentials.length);
        for(let i = 0; i < excludeCredentials.length; i++){
            const cred = excludeCredentials[i];
            result.excludeCredentials[i] = Object.assign(Object.assign({}, cred), {
                id: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$base64url$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["base64UrlToUint8Array"])(cred.id).buffer,
                type: cred.type || 'public-key',
                // Cast transports to handle future transport types like "cable"
                transports: cred.transports
            });
        }
    }
    return result;
}
function deserializeCredentialRequestOptions(options) {
    if (!options) {
        throw new Error('Credential request options are required');
    }
    // Check if the native parseRequestOptionsFromJSON method is available
    if (typeof PublicKeyCredential !== 'undefined' && 'parseRequestOptionsFromJSON' in PublicKeyCredential && typeof PublicKeyCredential.parseRequestOptionsFromJSON === 'function') {
        // Use the native WebAuthn Level 3 method
        return PublicKeyCredential.parseRequestOptionsFromJSON(options);
    }
    // Fallback to manual parsing for browsers that don't support the native method
    // Destructure to separate fields that need transformation
    const { challenge: challengeStr, allowCredentials } = options, restOptions = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f$tslib$40$2$2e$8$2e$1$2f$node_modules$2f$tslib$2f$tslib$2e$es6$2e$mjs__$5b$middleware$5d$__$28$ecmascript$29$__["__rest"])(options, [
        "challenge",
        "allowCredentials"
    ]);
    // Convert challenge from base64url to ArrayBuffer
    const challenge = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$base64url$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["base64UrlToUint8Array"])(challengeStr).buffer;
    // Build the result object
    const result = Object.assign(Object.assign({}, restOptions), {
        challenge
    });
    // Only add allowCredentials if it exists
    if (allowCredentials && allowCredentials.length > 0) {
        result.allowCredentials = new Array(allowCredentials.length);
        for(let i = 0; i < allowCredentials.length; i++){
            const cred = allowCredentials[i];
            result.allowCredentials[i] = Object.assign(Object.assign({}, cred), {
                id: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$base64url$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["base64UrlToUint8Array"])(cred.id).buffer,
                type: cred.type || 'public-key',
                // Cast transports to handle future transport types like "cable"
                transports: cred.transports
            });
        }
    }
    return result;
}
function serializeCredentialCreationResponse(credential) {
    var _a;
    // Check if the credential instance has the toJSON method
    if ('toJSON' in credential && typeof credential.toJSON === 'function') {
        // Use the native WebAuthn Level 3 method
        return credential.toJSON();
    }
    const credentialWithAttachment = credential;
    return {
        id: credential.id,
        rawId: credential.id,
        response: {
            attestationObject: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$base64url$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["bytesToBase64URL"])(new Uint8Array(credential.response.attestationObject)),
            clientDataJSON: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$base64url$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["bytesToBase64URL"])(new Uint8Array(credential.response.clientDataJSON))
        },
        type: 'public-key',
        clientExtensionResults: credential.getClientExtensionResults(),
        // Convert null to undefined and cast to AuthenticatorAttachment type
        authenticatorAttachment: (_a = credentialWithAttachment.authenticatorAttachment) !== null && _a !== void 0 ? _a : undefined
    };
}
function serializeCredentialRequestResponse(credential) {
    var _a;
    // Check if the credential instance has the toJSON method
    if ('toJSON' in credential && typeof credential.toJSON === 'function') {
        // Use the native WebAuthn Level 3 method
        return credential.toJSON();
    }
    // Fallback to manual conversion for browsers that don't support toJSON
    // Access authenticatorAttachment via type assertion to handle TypeScript version differences
    // @simplewebauthn/types includes this property but base TypeScript 4.7.4 doesn't
    const credentialWithAttachment = credential;
    const clientExtensionResults = credential.getClientExtensionResults();
    const assertionResponse = credential.response;
    return {
        id: credential.id,
        rawId: credential.id,
        response: {
            authenticatorData: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$base64url$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["bytesToBase64URL"])(new Uint8Array(assertionResponse.authenticatorData)),
            clientDataJSON: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$base64url$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["bytesToBase64URL"])(new Uint8Array(assertionResponse.clientDataJSON)),
            signature: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$base64url$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["bytesToBase64URL"])(new Uint8Array(assertionResponse.signature)),
            userHandle: assertionResponse.userHandle ? (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$base64url$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["bytesToBase64URL"])(new Uint8Array(assertionResponse.userHandle)) : undefined
        },
        type: 'public-key',
        clientExtensionResults,
        // Convert null to undefined and cast to AuthenticatorAttachment type
        authenticatorAttachment: (_a = credentialWithAttachment.authenticatorAttachment) !== null && _a !== void 0 ? _a : undefined
    };
}
function isValidDomain(hostname) {
    return(// Consider localhost valid as well since it's okay wrt Secure Contexts
    hostname === 'localhost' || /^([a-z0-9]+(-[a-z0-9]+)*\.)+[a-z]{2,}$/i.test(hostname));
}
/**
 * Determine if the browser is capable of WebAuthn.
 * Checks for necessary Web APIs: PublicKeyCredential and Credential Management.
 *
 * @returns {boolean} True if browser supports WebAuthn
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/API/PublicKeyCredential#browser_compatibility MDN - PublicKeyCredential Browser Compatibility}
 */ function browserSupportsWebAuthn() {
    var _a, _b;
    return !!((0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$helpers$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["isBrowser"])() && 'PublicKeyCredential' in window && window.PublicKeyCredential && 'credentials' in navigator && typeof ((_a = navigator === null || navigator === void 0 ? void 0 : navigator.credentials) === null || _a === void 0 ? void 0 : _a.create) === 'function' && typeof ((_b = navigator === null || navigator === void 0 ? void 0 : navigator.credentials) === null || _b === void 0 ? void 0 : _b.get) === 'function');
}
async function createCredential(options) {
    try {
        const response = await navigator.credentials.create(/** we assert the type here until typescript types are updated */ options);
        if (!response) {
            return {
                data: null,
                error: new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$webauthn$2e$errors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["WebAuthnUnknownError"]('Empty credential response', response)
            };
        }
        if (!(response instanceof PublicKeyCredential)) {
            return {
                data: null,
                error: new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$webauthn$2e$errors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["WebAuthnUnknownError"]('Browser returned unexpected credential type', response)
            };
        }
        return {
            data: response,
            error: null
        };
    } catch (err) {
        return {
            data: null,
            error: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$webauthn$2e$errors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["identifyRegistrationError"])({
                error: err,
                options
            })
        };
    }
}
async function getCredential(options) {
    try {
        const response = await navigator.credentials.get(/** we assert the type here until typescript types are updated */ options);
        if (!response) {
            return {
                data: null,
                error: new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$webauthn$2e$errors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["WebAuthnUnknownError"]('Empty credential response', response)
            };
        }
        if (!(response instanceof PublicKeyCredential)) {
            return {
                data: null,
                error: new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$webauthn$2e$errors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["WebAuthnUnknownError"]('Browser returned unexpected credential type', response)
            };
        }
        return {
            data: response,
            error: null
        };
    } catch (err) {
        return {
            data: null,
            error: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$webauthn$2e$errors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["identifyAuthenticationError"])({
                error: err,
                options
            })
        };
    }
}
const DEFAULT_CREATION_OPTIONS = {
    hints: [
        'security-key'
    ],
    authenticatorSelection: {
        authenticatorAttachment: 'cross-platform',
        requireResidentKey: false,
        /** set to preferred because older yubikeys don't have PIN/Biometric */ userVerification: 'preferred',
        residentKey: 'discouraged'
    },
    attestation: 'direct'
};
const DEFAULT_REQUEST_OPTIONS = {
    /** set to preferred because older yubikeys don't have PIN/Biometric */ userVerification: 'preferred',
    hints: [
        'security-key'
    ],
    attestation: 'direct'
};
function deepMerge(...sources) {
    const isObject = (val)=>val !== null && typeof val === 'object' && !Array.isArray(val);
    const isArrayBufferLike = (val)=>val instanceof ArrayBuffer || ArrayBuffer.isView(val);
    const result = {};
    for (const source of sources){
        if (!source) continue;
        for(const key in source){
            const value = source[key];
            if (value === undefined) continue;
            if (Array.isArray(value)) {
                // preserve array reference, including unions like AuthenticatorTransport[]
                result[key] = value;
            } else if (isArrayBufferLike(value)) {
                result[key] = value;
            } else if (isObject(value)) {
                const existing = result[key];
                if (isObject(existing)) {
                    result[key] = deepMerge(existing, value);
                } else {
                    result[key] = deepMerge(value);
                }
            } else {
                result[key] = value;
            }
        }
    }
    return result;
}
function mergeCredentialCreationOptions(baseOptions, overrides) {
    return deepMerge(DEFAULT_CREATION_OPTIONS, baseOptions, overrides || {});
}
function mergeCredentialRequestOptions(baseOptions, overrides) {
    return deepMerge(DEFAULT_REQUEST_OPTIONS, baseOptions, overrides || {});
}
class WebAuthnApi {
    constructor(client){
        this.client = client;
        // Bind all methods so they can be destructured
        this.enroll = this._enroll.bind(this);
        this.challenge = this._challenge.bind(this);
        this.verify = this._verify.bind(this);
        this.authenticate = this._authenticate.bind(this);
        this.register = this._register.bind(this);
    }
    /**
     * Enroll a new WebAuthn factor.
     * Creates an unverified WebAuthn factor that must be verified with a credential.
     *
     * @experimental This method is experimental and may change in future releases
     * @param {Omit<MFAEnrollWebauthnParams, 'factorType'>} params - Enrollment parameters (friendlyName required)
     * @returns {Promise<AuthMFAEnrollWebauthnResponse>} Enrolled factor details or error
     * @see {@link https://w3c.github.io/webauthn/#sctn-registering-a-new-credential W3C WebAuthn Spec - Registering a New Credential}
     */ async _enroll(params) {
        return this.client.mfa.enroll(Object.assign(Object.assign({}, params), {
            factorType: 'webauthn'
        }));
    }
    /**
     * Challenge for WebAuthn credential creation or authentication.
     * Combines server challenge with browser credential operations.
     * Handles both registration (create) and authentication (request) flows.
     *
     * @experimental This method is experimental and may change in future releases
     * @param {MFAChallengeWebauthnParams & { friendlyName?: string; signal?: AbortSignal }} params - Challenge parameters including factorId
     * @param {Object} overrides - Allows you to override the parameters passed to navigator.credentials
     * @param {PublicKeyCredentialCreationOptionsFuture} overrides.create - Override options for credential creation
     * @param {PublicKeyCredentialRequestOptionsFuture} overrides.request - Override options for credential request
     * @returns {Promise<RequestResult>} Challenge response with credential or error
     * @see {@link https://w3c.github.io/webauthn/#sctn-credential-creation W3C WebAuthn Spec - Credential Creation}
     * @see {@link https://w3c.github.io/webauthn/#sctn-verifying-assertion W3C WebAuthn Spec - Verifying Assertion}
     */ async _challenge({ factorId, webauthn, friendlyName, signal }, overrides) {
        var _a;
        try {
            // Get challenge from server using the client's MFA methods
            const { data: challengeResponse, error: challengeError } = await this.client.mfa.challenge({
                factorId,
                webauthn
            });
            if (!challengeResponse) {
                return {
                    data: null,
                    error: challengeError
                };
            }
            const abortSignal = signal !== null && signal !== void 0 ? signal : webAuthnAbortService.createNewAbortSignal();
            /** webauthn will fail if either of the name/displayname are blank */ if (challengeResponse.webauthn.type === 'create') {
                const { user } = challengeResponse.webauthn.credential_options.publicKey;
                if (!user.name) {
                    // Preserve original format: use friendlyName if provided, otherwise fetch fallback
                    // This maintains backward compatibility with the ${user.id}:${name} format
                    const nameToUse = friendlyName;
                    if (!nameToUse) {
                        // Only fetch user data if friendlyName is not provided (bug fix for null friendlyName)
                        const currentUser = await this.client.getUser();
                        const userData = currentUser.data.user;
                        const fallbackName = ((_a = userData === null || userData === void 0 ? void 0 : userData.user_metadata) === null || _a === void 0 ? void 0 : _a.name) || (userData === null || userData === void 0 ? void 0 : userData.email) || (userData === null || userData === void 0 ? void 0 : userData.id) || 'User';
                        user.name = `${user.id}:${fallbackName}`;
                    } else {
                        user.name = `${user.id}:${nameToUse}`;
                    }
                }
                if (!user.displayName) {
                    user.displayName = user.name;
                }
            }
            switch(challengeResponse.webauthn.type){
                case 'create':
                    {
                        const options = mergeCredentialCreationOptions(challengeResponse.webauthn.credential_options.publicKey, overrides === null || overrides === void 0 ? void 0 : overrides.create);
                        const { data, error } = await createCredential({
                            publicKey: options,
                            signal: abortSignal
                        });
                        if (data) {
                            return {
                                data: {
                                    factorId,
                                    challengeId: challengeResponse.id,
                                    webauthn: {
                                        type: challengeResponse.webauthn.type,
                                        credential_response: data
                                    }
                                },
                                error: null
                            };
                        }
                        return {
                            data: null,
                            error
                        };
                    }
                case 'request':
                    {
                        const options = mergeCredentialRequestOptions(challengeResponse.webauthn.credential_options.publicKey, overrides === null || overrides === void 0 ? void 0 : overrides.request);
                        const { data, error } = await getCredential(Object.assign(Object.assign({}, challengeResponse.webauthn.credential_options), {
                            publicKey: options,
                            signal: abortSignal
                        }));
                        if (data) {
                            return {
                                data: {
                                    factorId,
                                    challengeId: challengeResponse.id,
                                    webauthn: {
                                        type: challengeResponse.webauthn.type,
                                        credential_response: data
                                    }
                                },
                                error: null
                            };
                        }
                        return {
                            data: null,
                            error
                        };
                    }
            }
        } catch (error) {
            if ((0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$errors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["isAuthError"])(error)) {
                return {
                    data: null,
                    error
                };
            }
            return {
                data: null,
                error: new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$errors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["AuthUnknownError"]('Unexpected error in challenge', error)
            };
        }
    }
    /**
     * Verify a WebAuthn credential with the server.
     * Completes the WebAuthn ceremony by sending the credential to the server for verification.
     *
     * @experimental This method is experimental and may change in future releases
     * @param {Object} params - Verification parameters
     * @param {string} params.challengeId - ID of the challenge being verified
     * @param {string} params.factorId - ID of the WebAuthn factor
     * @param {MFAVerifyWebauthnParams<T>['webauthn']} params.webauthn - WebAuthn credential response
     * @returns {Promise<AuthMFAVerifyResponse>} Verification result with session or error
     * @see {@link https://w3c.github.io/webauthn/#sctn-verifying-assertion W3C WebAuthn Spec - Verifying an Authentication Assertion}
     * */ async _verify({ challengeId, factorId, webauthn }) {
        return this.client.mfa.verify({
            factorId,
            challengeId,
            webauthn: webauthn
        });
    }
    /**
     * Complete WebAuthn authentication flow.
     * Performs challenge and verification in a single operation for existing credentials.
     *
     * @experimental This method is experimental and may change in future releases
     * @param {Object} params - Authentication parameters
     * @param {string} params.factorId - ID of the WebAuthn factor to authenticate with
     * @param {Object} params.webauthn - WebAuthn configuration
     * @param {string} params.webauthn.rpId - Relying Party ID (defaults to current hostname)
     * @param {string[]} params.webauthn.rpOrigins - Allowed origins (defaults to current origin)
     * @param {AbortSignal} params.webauthn.signal - Optional abort signal
     * @param {PublicKeyCredentialRequestOptionsFuture} overrides - Override options for navigator.credentials.get
     * @returns {Promise<RequestResult<AuthMFAVerifyResponseData, WebAuthnError | AuthError>>} Authentication result
     * @see {@link https://w3c.github.io/webauthn/#sctn-authentication W3C WebAuthn Spec - Authentication Ceremony}
     * @see {@link https://developer.mozilla.org/en-US/docs/Web/API/PublicKeyCredentialRequestOptions MDN - PublicKeyCredentialRequestOptions}
     */ async _authenticate({ factorId, webauthn: { rpId = ("TURBOPACK compile-time falsy", 0) ? "TURBOPACK unreachable" : undefined, rpOrigins = ("TURBOPACK compile-time falsy", 0) ? "TURBOPACK unreachable" : undefined, signal } = {} }, overrides) {
        if (!rpId) {
            return {
                data: null,
                error: new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$errors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["AuthError"]('rpId is required for WebAuthn authentication')
            };
        }
        try {
            if (!browserSupportsWebAuthn()) {
                return {
                    data: null,
                    error: new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$errors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["AuthUnknownError"]('Browser does not support WebAuthn', null)
                };
            }
            // Get challenge and credential
            const { data: challengeResponse, error: challengeError } = await this.challenge({
                factorId,
                webauthn: {
                    rpId,
                    rpOrigins
                },
                signal
            }, {
                request: overrides
            });
            if (!challengeResponse) {
                return {
                    data: null,
                    error: challengeError
                };
            }
            const { webauthn } = challengeResponse;
            // Verify credential
            return this._verify({
                factorId,
                challengeId: challengeResponse.challengeId,
                webauthn: {
                    type: webauthn.type,
                    rpId,
                    rpOrigins,
                    credential_response: webauthn.credential_response
                }
            });
        } catch (error) {
            if ((0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$errors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["isAuthError"])(error)) {
                return {
                    data: null,
                    error
                };
            }
            return {
                data: null,
                error: new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$errors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["AuthUnknownError"]('Unexpected error in authenticate', error)
            };
        }
    }
    /**
     * Complete WebAuthn registration flow.
     * Performs enrollment, challenge, and verification in a single operation for new credentials.
     *
     * @experimental This method is experimental and may change in future releases
     * @param {Object} params - Registration parameters
     * @param {string} params.friendlyName - User-friendly name for the credential
     * @param {string} params.rpId - Relying Party ID (defaults to current hostname)
     * @param {string[]} params.rpOrigins - Allowed origins (defaults to current origin)
     * @param {AbortSignal} params.signal - Optional abort signal
     * @param {PublicKeyCredentialCreationOptionsFuture} overrides - Override options for navigator.credentials.create
     * @returns {Promise<RequestResult<AuthMFAVerifyResponseData, WebAuthnError | AuthError>>} Registration result
     * @see {@link https://w3c.github.io/webauthn/#sctn-registering-a-new-credential W3C WebAuthn Spec - Registration Ceremony}
     * @see {@link https://developer.mozilla.org/en-US/docs/Web/API/PublicKeyCredentialCreationOptions MDN - PublicKeyCredentialCreationOptions}
     */ async _register({ friendlyName, webauthn: { rpId = ("TURBOPACK compile-time falsy", 0) ? "TURBOPACK unreachable" : undefined, rpOrigins = ("TURBOPACK compile-time falsy", 0) ? "TURBOPACK unreachable" : undefined, signal } = {} }, overrides) {
        if (!rpId) {
            return {
                data: null,
                error: new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$errors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["AuthError"]('rpId is required for WebAuthn registration')
            };
        }
        try {
            if (!browserSupportsWebAuthn()) {
                return {
                    data: null,
                    error: new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$errors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["AuthUnknownError"]('Browser does not support WebAuthn', null)
                };
            }
            // Enroll factor
            const { data: factor, error: enrollError } = await this._enroll({
                friendlyName
            });
            if (!factor) {
                await this.client.mfa.listFactors().then((factors)=>{
                    var _a;
                    return (_a = factors.data) === null || _a === void 0 ? void 0 : _a.all.find((v)=>v.factor_type === 'webauthn' && v.friendly_name === friendlyName && v.status !== 'unverified');
                }).then((factor)=>factor ? this.client.mfa.unenroll({
                        factorId: factor === null || factor === void 0 ? void 0 : factor.id
                    }) : void 0);
                return {
                    data: null,
                    error: enrollError
                };
            }
            // Get challenge and create credential
            const { data: challengeResponse, error: challengeError } = await this._challenge({
                factorId: factor.id,
                friendlyName: factor.friendly_name,
                webauthn: {
                    rpId,
                    rpOrigins
                },
                signal
            }, {
                create: overrides
            });
            if (!challengeResponse) {
                return {
                    data: null,
                    error: challengeError
                };
            }
            return this._verify({
                factorId: factor.id,
                challengeId: challengeResponse.challengeId,
                webauthn: {
                    rpId,
                    rpOrigins,
                    type: challengeResponse.webauthn.type,
                    credential_response: challengeResponse.webauthn.credential_response
                }
            });
        } catch (error) {
            if ((0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$errors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["isAuthError"])(error)) {
                return {
                    data: null,
                    error
                };
            }
            return {
                data: null,
                error: new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$errors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["AuthUnknownError"]('Unexpected error in register', error)
            };
        }
    }
} //# sourceMappingURL=webauthn.js.map
}),
"[project]/node_modules/.bun/@supabase+auth-js@2.95.3/node_modules/@supabase/auth-js/dist/module/GoTrueClient.js [middleware] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>__TURBOPACK__default__export__
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$GoTrueAdminApi$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.bun/@supabase+auth-js@2.95.3/node_modules/@supabase/auth-js/dist/module/GoTrueAdminApi.js [middleware] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$constants$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.bun/@supabase+auth-js@2.95.3/node_modules/@supabase/auth-js/dist/module/lib/constants.js [middleware] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$errors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.bun/@supabase+auth-js@2.95.3/node_modules/@supabase/auth-js/dist/module/lib/errors.js [middleware] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$fetch$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.bun/@supabase+auth-js@2.95.3/node_modules/@supabase/auth-js/dist/module/lib/fetch.js [middleware] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$helpers$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.bun/@supabase+auth-js@2.95.3/node_modules/@supabase/auth-js/dist/module/lib/helpers.js [middleware] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$local$2d$storage$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.bun/@supabase+auth-js@2.95.3/node_modules/@supabase/auth-js/dist/module/lib/local-storage.js [middleware] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$locks$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.bun/@supabase+auth-js@2.95.3/node_modules/@supabase/auth-js/dist/module/lib/locks.js [middleware] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$polyfills$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.bun/@supabase+auth-js@2.95.3/node_modules/@supabase/auth-js/dist/module/lib/polyfills.js [middleware] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$version$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.bun/@supabase+auth-js@2.95.3/node_modules/@supabase/auth-js/dist/module/lib/version.js [middleware] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$base64url$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.bun/@supabase+auth-js@2.95.3/node_modules/@supabase/auth-js/dist/module/lib/base64url.js [middleware] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$web3$2f$ethereum$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.bun/@supabase+auth-js@2.95.3/node_modules/@supabase/auth-js/dist/module/lib/web3/ethereum.js [middleware] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$webauthn$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/node_modules/.bun/@supabase+auth-js@2.95.3/node_modules/@supabase/auth-js/dist/module/lib/webauthn.js [middleware] (ecmascript) <locals>");
;
;
;
;
;
;
;
;
;
;
;
;
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$polyfills$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["polyfillGlobalThis"])(); // Make "globalThis" available
const DEFAULT_OPTIONS = {
    url: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$constants$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["GOTRUE_URL"],
    storageKey: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$constants$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["STORAGE_KEY"],
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    headers: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$constants$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["DEFAULT_HEADERS"],
    flowType: 'implicit',
    debug: false,
    hasCustomAuthorizationHeader: false,
    throwOnError: false,
    lockAcquireTimeout: 10000
};
async function lockNoOp(name, acquireTimeout, fn) {
    return await fn();
}
/**
 * Caches JWKS values for all clients created in the same environment. This is
 * especially useful for shared-memory execution environments such as Vercel's
 * Fluid Compute, AWS Lambda or Supabase's Edge Functions. Regardless of how
 * many clients are created, if they share the same storage key they will use
 * the same JWKS cache, significantly speeding up getClaims() with asymmetric
 * JWTs.
 */ const GLOBAL_JWKS = {};
class GoTrueClient {
    /**
     * The JWKS used for verifying asymmetric JWTs
     */ get jwks() {
        var _a, _b;
        return (_b = (_a = GLOBAL_JWKS[this.storageKey]) === null || _a === void 0 ? void 0 : _a.jwks) !== null && _b !== void 0 ? _b : {
            keys: []
        };
    }
    set jwks(value) {
        GLOBAL_JWKS[this.storageKey] = Object.assign(Object.assign({}, GLOBAL_JWKS[this.storageKey]), {
            jwks: value
        });
    }
    get jwks_cached_at() {
        var _a, _b;
        return (_b = (_a = GLOBAL_JWKS[this.storageKey]) === null || _a === void 0 ? void 0 : _a.cachedAt) !== null && _b !== void 0 ? _b : Number.MIN_SAFE_INTEGER;
    }
    set jwks_cached_at(value) {
        GLOBAL_JWKS[this.storageKey] = Object.assign(Object.assign({}, GLOBAL_JWKS[this.storageKey]), {
            cachedAt: value
        });
    }
    /**
     * Create a new client for use in the browser.
     *
     * @example
     * ```ts
     * import { GoTrueClient } from '@supabase/auth-js'
     *
     * const auth = new GoTrueClient({
     *   url: 'https://xyzcompany.supabase.co/auth/v1',
     *   headers: { apikey: 'public-anon-key' },
     *   storageKey: 'supabase-auth',
     * })
     * ```
     */ constructor(options){
        var _a, _b, _c;
        /**
         * @experimental
         */ this.userStorage = null;
        this.memoryStorage = null;
        this.stateChangeEmitters = new Map();
        this.autoRefreshTicker = null;
        this.autoRefreshTickTimeout = null;
        this.visibilityChangedCallback = null;
        this.refreshingDeferred = null;
        /**
         * Keeps track of the async client initialization.
         * When null or not yet resolved the auth state is `unknown`
         * Once resolved the auth state is known and it's safe to call any further client methods.
         * Keep extra care to never reject or throw uncaught errors
         */ this.initializePromise = null;
        this.detectSessionInUrl = true;
        this.hasCustomAuthorizationHeader = false;
        this.suppressGetSessionWarning = false;
        this.lockAcquired = false;
        this.pendingInLock = [];
        /**
         * Used to broadcast state change events to other tabs listening.
         */ this.broadcastChannel = null;
        this.logger = console.log;
        const settings = Object.assign(Object.assign({}, DEFAULT_OPTIONS), options);
        this.storageKey = settings.storageKey;
        this.instanceID = (_a = GoTrueClient.nextInstanceID[this.storageKey]) !== null && _a !== void 0 ? _a : 0;
        GoTrueClient.nextInstanceID[this.storageKey] = this.instanceID + 1;
        this.logDebugMessages = !!settings.debug;
        if (typeof settings.debug === 'function') {
            this.logger = settings.debug;
        }
        if (this.instanceID > 0 && (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$helpers$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["isBrowser"])()) {
            const message = `${this._logPrefix()} Multiple GoTrueClient instances detected in the same browser context. It is not an error, but this should be avoided as it may produce undefined behavior when used concurrently under the same storage key.`;
            console.warn(message);
            if (this.logDebugMessages) {
                console.trace(message);
            }
        }
        this.persistSession = settings.persistSession;
        this.autoRefreshToken = settings.autoRefreshToken;
        this.admin = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$GoTrueAdminApi$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["default"]({
            url: settings.url,
            headers: settings.headers,
            fetch: settings.fetch
        });
        this.url = settings.url;
        this.headers = settings.headers;
        this.fetch = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$helpers$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["resolveFetch"])(settings.fetch);
        this.lock = settings.lock || lockNoOp;
        this.detectSessionInUrl = settings.detectSessionInUrl;
        this.flowType = settings.flowType;
        this.hasCustomAuthorizationHeader = settings.hasCustomAuthorizationHeader;
        this.throwOnError = settings.throwOnError;
        this.lockAcquireTimeout = settings.lockAcquireTimeout;
        if (settings.lock) {
            this.lock = settings.lock;
        } else if (this.persistSession && (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$helpers$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["isBrowser"])() && ((_b = globalThis === null || globalThis === void 0 ? void 0 : globalThis.navigator) === null || _b === void 0 ? void 0 : _b.locks)) {
            this.lock = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$locks$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["navigatorLock"];
        } else {
            this.lock = lockNoOp;
        }
        if (!this.jwks) {
            this.jwks = {
                keys: []
            };
            this.jwks_cached_at = Number.MIN_SAFE_INTEGER;
        }
        this.mfa = {
            verify: this._verify.bind(this),
            enroll: this._enroll.bind(this),
            unenroll: this._unenroll.bind(this),
            challenge: this._challenge.bind(this),
            listFactors: this._listFactors.bind(this),
            challengeAndVerify: this._challengeAndVerify.bind(this),
            getAuthenticatorAssuranceLevel: this._getAuthenticatorAssuranceLevel.bind(this),
            webauthn: new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$webauthn$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__$3c$locals$3e$__["WebAuthnApi"](this)
        };
        this.oauth = {
            getAuthorizationDetails: this._getAuthorizationDetails.bind(this),
            approveAuthorization: this._approveAuthorization.bind(this),
            denyAuthorization: this._denyAuthorization.bind(this),
            listGrants: this._listOAuthGrants.bind(this),
            revokeGrant: this._revokeOAuthGrant.bind(this)
        };
        if (this.persistSession) {
            if (settings.storage) {
                this.storage = settings.storage;
            } else {
                if ((0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$helpers$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["supportsLocalStorage"])()) {
                    this.storage = globalThis.localStorage;
                } else {
                    this.memoryStorage = {};
                    this.storage = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$local$2d$storage$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["memoryLocalStorageAdapter"])(this.memoryStorage);
                }
            }
            if (settings.userStorage) {
                this.userStorage = settings.userStorage;
            }
        } else {
            this.memoryStorage = {};
            this.storage = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$local$2d$storage$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["memoryLocalStorageAdapter"])(this.memoryStorage);
        }
        if ((0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$helpers$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["isBrowser"])() && globalThis.BroadcastChannel && this.persistSession && this.storageKey) {
            try {
                this.broadcastChannel = new globalThis.BroadcastChannel(this.storageKey);
            } catch (e) {
                console.error('Failed to create a new BroadcastChannel, multi-tab state changes will not be available', e);
            }
            (_c = this.broadcastChannel) === null || _c === void 0 ? void 0 : _c.addEventListener('message', async (event)=>{
                this._debug('received broadcast notification from other tab or client', event);
                try {
                    await this._notifyAllSubscribers(event.data.event, event.data.session, false); // broadcast = false so we don't get an endless loop of messages
                } catch (error) {
                    this._debug('#broadcastChannel', 'error', error);
                }
            });
        }
        this.initialize().catch((error)=>{
            this._debug('#initialize()', 'error', error);
        });
    }
    /**
     * Returns whether error throwing mode is enabled for this client.
     */ isThrowOnErrorEnabled() {
        return this.throwOnError;
    }
    /**
     * Centralizes return handling with optional error throwing. When `throwOnError` is enabled
     * and the provided result contains a non-nullish error, the error is thrown instead of
     * being returned. This ensures consistent behavior across all public API methods.
     */ _returnResult(result) {
        if (this.throwOnError && result && result.error) {
            throw result.error;
        }
        return result;
    }
    _logPrefix() {
        return 'GoTrueClient@' + `${this.storageKey}:${this.instanceID} (${__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$version$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["version"]}) ${new Date().toISOString()}`;
    }
    _debug(...args) {
        if (this.logDebugMessages) {
            this.logger(this._logPrefix(), ...args);
        }
        return this;
    }
    /**
     * Initializes the client session either from the url or from storage.
     * This method is automatically called when instantiating the client, but should also be called
     * manually when checking for an error from an auth redirect (oauth, magiclink, password recovery, etc).
     */ async initialize() {
        if (this.initializePromise) {
            return await this.initializePromise;
        }
        this.initializePromise = (async ()=>{
            return await this._acquireLock(this.lockAcquireTimeout, async ()=>{
                return await this._initialize();
            });
        })();
        return await this.initializePromise;
    }
    /**
     * IMPORTANT:
     * 1. Never throw in this method, as it is called from the constructor
     * 2. Never return a session from this method as it would be cached over
     *    the whole lifetime of the client
     */ async _initialize() {
        var _a;
        try {
            let params = {};
            let callbackUrlType = 'none';
            if ((0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$helpers$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["isBrowser"])()) {
                params = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$helpers$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["parseParametersFromURL"])(window.location.href);
                if (this._isImplicitGrantCallback(params)) {
                    callbackUrlType = 'implicit';
                } else if (await this._isPKCECallback(params)) {
                    callbackUrlType = 'pkce';
                }
            }
            /**
             * Attempt to get the session from the URL only if these conditions are fulfilled
             *
             * Note: If the URL isn't one of the callback url types (implicit or pkce),
             * then there could be an existing session so we don't want to prematurely remove it
             */ if ((0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$helpers$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["isBrowser"])() && this.detectSessionInUrl && callbackUrlType !== 'none') {
                const { data, error } = await this._getSessionFromURL(params, callbackUrlType);
                if (error) {
                    this._debug('#_initialize()', 'error detecting session from URL', error);
                    if ((0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$errors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["isAuthImplicitGrantRedirectError"])(error)) {
                        const errorCode = (_a = error.details) === null || _a === void 0 ? void 0 : _a.code;
                        if (errorCode === 'identity_already_exists' || errorCode === 'identity_not_found' || errorCode === 'single_identity_not_deletable') {
                            return {
                                error
                            };
                        }
                    }
                    // Don't remove existing session on URL login failure.
                    // A failed attempt (e.g. reused magic link) shouldn't invalidate a valid session.
                    return {
                        error
                    };
                }
                const { session, redirectType } = data;
                this._debug('#_initialize()', 'detected session in URL', session, 'redirect type', redirectType);
                await this._saveSession(session);
                setTimeout(async ()=>{
                    if (redirectType === 'recovery') {
                        await this._notifyAllSubscribers('PASSWORD_RECOVERY', session);
                    } else {
                        await this._notifyAllSubscribers('SIGNED_IN', session);
                    }
                }, 0);
                return {
                    error: null
                };
            }
            // no login attempt via callback url try to recover session from storage
            await this._recoverAndRefresh();
            return {
                error: null
            };
        } catch (error) {
            if ((0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$errors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["isAuthError"])(error)) {
                return this._returnResult({
                    error
                });
            }
            return this._returnResult({
                error: new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$errors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["AuthUnknownError"]('Unexpected error during initialization', error)
            });
        } finally{
            await this._handleVisibilityChange();
            this._debug('#_initialize()', 'end');
        }
    }
    /**
     * Creates a new anonymous user.
     *
     * @returns A session where the is_anonymous claim in the access token JWT set to true
     */ async signInAnonymously(credentials) {
        var _a, _b, _c;
        try {
            const res = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$fetch$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["_request"])(this.fetch, 'POST', `${this.url}/signup`, {
                headers: this.headers,
                body: {
                    data: (_b = (_a = credentials === null || credentials === void 0 ? void 0 : credentials.options) === null || _a === void 0 ? void 0 : _a.data) !== null && _b !== void 0 ? _b : {},
                    gotrue_meta_security: {
                        captcha_token: (_c = credentials === null || credentials === void 0 ? void 0 : credentials.options) === null || _c === void 0 ? void 0 : _c.captchaToken
                    }
                },
                xform: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$fetch$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["_sessionResponse"]
            });
            const { data, error } = res;
            if (error || !data) {
                return this._returnResult({
                    data: {
                        user: null,
                        session: null
                    },
                    error: error
                });
            }
            const session = data.session;
            const user = data.user;
            if (data.session) {
                await this._saveSession(data.session);
                await this._notifyAllSubscribers('SIGNED_IN', session);
            }
            return this._returnResult({
                data: {
                    user,
                    session
                },
                error: null
            });
        } catch (error) {
            if ((0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$errors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["isAuthError"])(error)) {
                return this._returnResult({
                    data: {
                        user: null,
                        session: null
                    },
                    error
                });
            }
            throw error;
        }
    }
    /**
     * Creates a new user.
     *
     * Be aware that if a user account exists in the system you may get back an
     * error message that attempts to hide this information from the user.
     * This method has support for PKCE via email signups. The PKCE flow cannot be used when autoconfirm is enabled.
     *
     * @returns A logged-in session if the server has "autoconfirm" ON
     * @returns A user if the server has "autoconfirm" OFF
     */ async signUp(credentials) {
        var _a, _b, _c;
        try {
            let res;
            if ('email' in credentials) {
                const { email, password, options } = credentials;
                let codeChallenge = null;
                let codeChallengeMethod = null;
                if (this.flowType === 'pkce') {
                    ;
                    [codeChallenge, codeChallengeMethod] = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$helpers$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["getCodeChallengeAndMethod"])(this.storage, this.storageKey);
                }
                res = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$fetch$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["_request"])(this.fetch, 'POST', `${this.url}/signup`, {
                    headers: this.headers,
                    redirectTo: options === null || options === void 0 ? void 0 : options.emailRedirectTo,
                    body: {
                        email,
                        password,
                        data: (_a = options === null || options === void 0 ? void 0 : options.data) !== null && _a !== void 0 ? _a : {},
                        gotrue_meta_security: {
                            captcha_token: options === null || options === void 0 ? void 0 : options.captchaToken
                        },
                        code_challenge: codeChallenge,
                        code_challenge_method: codeChallengeMethod
                    },
                    xform: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$fetch$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["_sessionResponse"]
                });
            } else if ('phone' in credentials) {
                const { phone, password, options } = credentials;
                res = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$fetch$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["_request"])(this.fetch, 'POST', `${this.url}/signup`, {
                    headers: this.headers,
                    body: {
                        phone,
                        password,
                        data: (_b = options === null || options === void 0 ? void 0 : options.data) !== null && _b !== void 0 ? _b : {},
                        channel: (_c = options === null || options === void 0 ? void 0 : options.channel) !== null && _c !== void 0 ? _c : 'sms',
                        gotrue_meta_security: {
                            captcha_token: options === null || options === void 0 ? void 0 : options.captchaToken
                        }
                    },
                    xform: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$fetch$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["_sessionResponse"]
                });
            } else {
                throw new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$errors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["AuthInvalidCredentialsError"]('You must provide either an email or phone number and a password');
            }
            const { data, error } = res;
            if (error || !data) {
                await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$helpers$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["removeItemAsync"])(this.storage, `${this.storageKey}-code-verifier`);
                return this._returnResult({
                    data: {
                        user: null,
                        session: null
                    },
                    error: error
                });
            }
            const session = data.session;
            const user = data.user;
            if (data.session) {
                await this._saveSession(data.session);
                await this._notifyAllSubscribers('SIGNED_IN', session);
            }
            return this._returnResult({
                data: {
                    user,
                    session
                },
                error: null
            });
        } catch (error) {
            await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$helpers$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["removeItemAsync"])(this.storage, `${this.storageKey}-code-verifier`);
            if ((0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$errors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["isAuthError"])(error)) {
                return this._returnResult({
                    data: {
                        user: null,
                        session: null
                    },
                    error
                });
            }
            throw error;
        }
    }
    /**
     * Log in an existing user with an email and password or phone and password.
     *
     * Be aware that you may get back an error message that will not distinguish
     * between the cases where the account does not exist or that the
     * email/phone and password combination is wrong or that the account can only
     * be accessed via social login.
     */ async signInWithPassword(credentials) {
        try {
            let res;
            if ('email' in credentials) {
                const { email, password, options } = credentials;
                res = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$fetch$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["_request"])(this.fetch, 'POST', `${this.url}/token?grant_type=password`, {
                    headers: this.headers,
                    body: {
                        email,
                        password,
                        gotrue_meta_security: {
                            captcha_token: options === null || options === void 0 ? void 0 : options.captchaToken
                        }
                    },
                    xform: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$fetch$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["_sessionResponsePassword"]
                });
            } else if ('phone' in credentials) {
                const { phone, password, options } = credentials;
                res = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$fetch$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["_request"])(this.fetch, 'POST', `${this.url}/token?grant_type=password`, {
                    headers: this.headers,
                    body: {
                        phone,
                        password,
                        gotrue_meta_security: {
                            captcha_token: options === null || options === void 0 ? void 0 : options.captchaToken
                        }
                    },
                    xform: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$fetch$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["_sessionResponsePassword"]
                });
            } else {
                throw new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$errors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["AuthInvalidCredentialsError"]('You must provide either an email or phone number and a password');
            }
            const { data, error } = res;
            if (error) {
                return this._returnResult({
                    data: {
                        user: null,
                        session: null
                    },
                    error
                });
            } else if (!data || !data.session || !data.user) {
                const invalidTokenError = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$errors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["AuthInvalidTokenResponseError"]();
                return this._returnResult({
                    data: {
                        user: null,
                        session: null
                    },
                    error: invalidTokenError
                });
            }
            if (data.session) {
                await this._saveSession(data.session);
                await this._notifyAllSubscribers('SIGNED_IN', data.session);
            }
            return this._returnResult({
                data: Object.assign({
                    user: data.user,
                    session: data.session
                }, data.weak_password ? {
                    weakPassword: data.weak_password
                } : null),
                error
            });
        } catch (error) {
            if ((0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$errors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["isAuthError"])(error)) {
                return this._returnResult({
                    data: {
                        user: null,
                        session: null
                    },
                    error
                });
            }
            throw error;
        }
    }
    /**
     * Log in an existing user via a third-party provider.
     * This method supports the PKCE flow.
     */ async signInWithOAuth(credentials) {
        var _a, _b, _c, _d;
        return await this._handleProviderSignIn(credentials.provider, {
            redirectTo: (_a = credentials.options) === null || _a === void 0 ? void 0 : _a.redirectTo,
            scopes: (_b = credentials.options) === null || _b === void 0 ? void 0 : _b.scopes,
            queryParams: (_c = credentials.options) === null || _c === void 0 ? void 0 : _c.queryParams,
            skipBrowserRedirect: (_d = credentials.options) === null || _d === void 0 ? void 0 : _d.skipBrowserRedirect
        });
    }
    /**
     * Log in an existing user by exchanging an Auth Code issued during the PKCE flow.
     */ async exchangeCodeForSession(authCode) {
        await this.initializePromise;
        return this._acquireLock(this.lockAcquireTimeout, async ()=>{
            return this._exchangeCodeForSession(authCode);
        });
    }
    /**
     * Signs in a user by verifying a message signed by the user's private key.
     * Supports Ethereum (via Sign-In-With-Ethereum) & Solana (Sign-In-With-Solana) standards,
     * both of which derive from the EIP-4361 standard
     * With slight variation on Solana's side.
     * @reference https://eips.ethereum.org/EIPS/eip-4361
     */ async signInWithWeb3(credentials) {
        const { chain } = credentials;
        switch(chain){
            case 'ethereum':
                return await this.signInWithEthereum(credentials);
            case 'solana':
                return await this.signInWithSolana(credentials);
            default:
                throw new Error(`@supabase/auth-js: Unsupported chain "${chain}"`);
        }
    }
    async signInWithEthereum(credentials) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l;
        // TODO: flatten type
        let message;
        let signature;
        if ('message' in credentials) {
            message = credentials.message;
            signature = credentials.signature;
        } else {
            const { chain, wallet, statement, options } = credentials;
            let resolvedWallet;
            if (!(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$helpers$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["isBrowser"])()) {
                if (typeof wallet !== 'object' || !(options === null || options === void 0 ? void 0 : options.url)) {
                    throw new Error('@supabase/auth-js: Both wallet and url must be specified in non-browser environments.');
                }
                resolvedWallet = wallet;
            } else if (typeof wallet === 'object') {
                resolvedWallet = wallet;
            } else {
                const windowAny = window;
                if ('ethereum' in windowAny && typeof windowAny.ethereum === 'object' && 'request' in windowAny.ethereum && typeof windowAny.ethereum.request === 'function') {
                    resolvedWallet = windowAny.ethereum;
                } else {
                    throw new Error(`@supabase/auth-js: No compatible Ethereum wallet interface on the window object (window.ethereum) detected. Make sure the user already has a wallet installed and connected for this app. Prefer passing the wallet interface object directly to signInWithWeb3({ chain: 'ethereum', wallet: resolvedUserWallet }) instead.`);
                }
            }
            const url = new URL((_a = options === null || options === void 0 ? void 0 : options.url) !== null && _a !== void 0 ? _a : window.location.href);
            const accounts = await resolvedWallet.request({
                method: 'eth_requestAccounts'
            }).then((accs)=>accs).catch(()=>{
                throw new Error(`@supabase/auth-js: Wallet method eth_requestAccounts is missing or invalid`);
            });
            if (!accounts || accounts.length === 0) {
                throw new Error(`@supabase/auth-js: No accounts available. Please ensure the wallet is connected.`);
            }
            const address = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$web3$2f$ethereum$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["getAddress"])(accounts[0]);
            let chainId = (_b = options === null || options === void 0 ? void 0 : options.signInWithEthereum) === null || _b === void 0 ? void 0 : _b.chainId;
            if (!chainId) {
                const chainIdHex = await resolvedWallet.request({
                    method: 'eth_chainId'
                });
                chainId = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$web3$2f$ethereum$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["fromHex"])(chainIdHex);
            }
            const siweMessage = {
                domain: url.host,
                address: address,
                statement: statement,
                uri: url.href,
                version: '1',
                chainId: chainId,
                nonce: (_c = options === null || options === void 0 ? void 0 : options.signInWithEthereum) === null || _c === void 0 ? void 0 : _c.nonce,
                issuedAt: (_e = (_d = options === null || options === void 0 ? void 0 : options.signInWithEthereum) === null || _d === void 0 ? void 0 : _d.issuedAt) !== null && _e !== void 0 ? _e : new Date(),
                expirationTime: (_f = options === null || options === void 0 ? void 0 : options.signInWithEthereum) === null || _f === void 0 ? void 0 : _f.expirationTime,
                notBefore: (_g = options === null || options === void 0 ? void 0 : options.signInWithEthereum) === null || _g === void 0 ? void 0 : _g.notBefore,
                requestId: (_h = options === null || options === void 0 ? void 0 : options.signInWithEthereum) === null || _h === void 0 ? void 0 : _h.requestId,
                resources: (_j = options === null || options === void 0 ? void 0 : options.signInWithEthereum) === null || _j === void 0 ? void 0 : _j.resources
            };
            message = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$web3$2f$ethereum$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["createSiweMessage"])(siweMessage);
            // Sign message
            signature = await resolvedWallet.request({
                method: 'personal_sign',
                params: [
                    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$web3$2f$ethereum$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["toHex"])(message),
                    address
                ]
            });
        }
        try {
            const { data, error } = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$fetch$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["_request"])(this.fetch, 'POST', `${this.url}/token?grant_type=web3`, {
                headers: this.headers,
                body: Object.assign({
                    chain: 'ethereum',
                    message,
                    signature
                }, ((_k = credentials.options) === null || _k === void 0 ? void 0 : _k.captchaToken) ? {
                    gotrue_meta_security: {
                        captcha_token: (_l = credentials.options) === null || _l === void 0 ? void 0 : _l.captchaToken
                    }
                } : null),
                xform: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$fetch$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["_sessionResponse"]
            });
            if (error) {
                throw error;
            }
            if (!data || !data.session || !data.user) {
                const invalidTokenError = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$errors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["AuthInvalidTokenResponseError"]();
                return this._returnResult({
                    data: {
                        user: null,
                        session: null
                    },
                    error: invalidTokenError
                });
            }
            if (data.session) {
                await this._saveSession(data.session);
                await this._notifyAllSubscribers('SIGNED_IN', data.session);
            }
            return this._returnResult({
                data: Object.assign({}, data),
                error
            });
        } catch (error) {
            if ((0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$errors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["isAuthError"])(error)) {
                return this._returnResult({
                    data: {
                        user: null,
                        session: null
                    },
                    error
                });
            }
            throw error;
        }
    }
    async signInWithSolana(credentials) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m;
        let message;
        let signature;
        if ('message' in credentials) {
            message = credentials.message;
            signature = credentials.signature;
        } else {
            const { chain, wallet, statement, options } = credentials;
            let resolvedWallet;
            if (!(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$helpers$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["isBrowser"])()) {
                if (typeof wallet !== 'object' || !(options === null || options === void 0 ? void 0 : options.url)) {
                    throw new Error('@supabase/auth-js: Both wallet and url must be specified in non-browser environments.');
                }
                resolvedWallet = wallet;
            } else if (typeof wallet === 'object') {
                resolvedWallet = wallet;
            } else {
                const windowAny = window;
                if ('solana' in windowAny && typeof windowAny.solana === 'object' && ('signIn' in windowAny.solana && typeof windowAny.solana.signIn === 'function' || 'signMessage' in windowAny.solana && typeof windowAny.solana.signMessage === 'function')) {
                    resolvedWallet = windowAny.solana;
                } else {
                    throw new Error(`@supabase/auth-js: No compatible Solana wallet interface on the window object (window.solana) detected. Make sure the user already has a wallet installed and connected for this app. Prefer passing the wallet interface object directly to signInWithWeb3({ chain: 'solana', wallet: resolvedUserWallet }) instead.`);
                }
            }
            const url = new URL((_a = options === null || options === void 0 ? void 0 : options.url) !== null && _a !== void 0 ? _a : window.location.href);
            if ('signIn' in resolvedWallet && resolvedWallet.signIn) {
                const output = await resolvedWallet.signIn(Object.assign(Object.assign(Object.assign({
                    issuedAt: new Date().toISOString()
                }, options === null || options === void 0 ? void 0 : options.signInWithSolana), {
                    // non-overridable properties
                    version: '1',
                    domain: url.host,
                    uri: url.href
                }), statement ? {
                    statement
                } : null));
                let outputToProcess;
                if (Array.isArray(output) && output[0] && typeof output[0] === 'object') {
                    outputToProcess = output[0];
                } else if (output && typeof output === 'object' && 'signedMessage' in output && 'signature' in output) {
                    outputToProcess = output;
                } else {
                    throw new Error('@supabase/auth-js: Wallet method signIn() returned unrecognized value');
                }
                if ('signedMessage' in outputToProcess && 'signature' in outputToProcess && (typeof outputToProcess.signedMessage === 'string' || outputToProcess.signedMessage instanceof Uint8Array) && outputToProcess.signature instanceof Uint8Array) {
                    message = typeof outputToProcess.signedMessage === 'string' ? outputToProcess.signedMessage : new TextDecoder().decode(outputToProcess.signedMessage);
                    signature = outputToProcess.signature;
                } else {
                    throw new Error('@supabase/auth-js: Wallet method signIn() API returned object without signedMessage and signature fields');
                }
            } else {
                if (!('signMessage' in resolvedWallet) || typeof resolvedWallet.signMessage !== 'function' || !('publicKey' in resolvedWallet) || typeof resolvedWallet !== 'object' || !resolvedWallet.publicKey || !('toBase58' in resolvedWallet.publicKey) || typeof resolvedWallet.publicKey.toBase58 !== 'function') {
                    throw new Error('@supabase/auth-js: Wallet does not have a compatible signMessage() and publicKey.toBase58() API');
                }
                message = [
                    `${url.host} wants you to sign in with your Solana account:`,
                    resolvedWallet.publicKey.toBase58(),
                    ...statement ? [
                        '',
                        statement,
                        ''
                    ] : [
                        ''
                    ],
                    'Version: 1',
                    `URI: ${url.href}`,
                    `Issued At: ${(_c = (_b = options === null || options === void 0 ? void 0 : options.signInWithSolana) === null || _b === void 0 ? void 0 : _b.issuedAt) !== null && _c !== void 0 ? _c : new Date().toISOString()}`,
                    ...((_d = options === null || options === void 0 ? void 0 : options.signInWithSolana) === null || _d === void 0 ? void 0 : _d.notBefore) ? [
                        `Not Before: ${options.signInWithSolana.notBefore}`
                    ] : [],
                    ...((_e = options === null || options === void 0 ? void 0 : options.signInWithSolana) === null || _e === void 0 ? void 0 : _e.expirationTime) ? [
                        `Expiration Time: ${options.signInWithSolana.expirationTime}`
                    ] : [],
                    ...((_f = options === null || options === void 0 ? void 0 : options.signInWithSolana) === null || _f === void 0 ? void 0 : _f.chainId) ? [
                        `Chain ID: ${options.signInWithSolana.chainId}`
                    ] : [],
                    ...((_g = options === null || options === void 0 ? void 0 : options.signInWithSolana) === null || _g === void 0 ? void 0 : _g.nonce) ? [
                        `Nonce: ${options.signInWithSolana.nonce}`
                    ] : [],
                    ...((_h = options === null || options === void 0 ? void 0 : options.signInWithSolana) === null || _h === void 0 ? void 0 : _h.requestId) ? [
                        `Request ID: ${options.signInWithSolana.requestId}`
                    ] : [],
                    ...((_k = (_j = options === null || options === void 0 ? void 0 : options.signInWithSolana) === null || _j === void 0 ? void 0 : _j.resources) === null || _k === void 0 ? void 0 : _k.length) ? [
                        'Resources',
                        ...options.signInWithSolana.resources.map((resource)=>`- ${resource}`)
                    ] : []
                ].join('\n');
                const maybeSignature = await resolvedWallet.signMessage(new TextEncoder().encode(message), 'utf8');
                if (!maybeSignature || !(maybeSignature instanceof Uint8Array)) {
                    throw new Error('@supabase/auth-js: Wallet signMessage() API returned an recognized value');
                }
                signature = maybeSignature;
            }
        }
        try {
            const { data, error } = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$fetch$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["_request"])(this.fetch, 'POST', `${this.url}/token?grant_type=web3`, {
                headers: this.headers,
                body: Object.assign({
                    chain: 'solana',
                    message,
                    signature: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$base64url$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["bytesToBase64URL"])(signature)
                }, ((_l = credentials.options) === null || _l === void 0 ? void 0 : _l.captchaToken) ? {
                    gotrue_meta_security: {
                        captcha_token: (_m = credentials.options) === null || _m === void 0 ? void 0 : _m.captchaToken
                    }
                } : null),
                xform: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$fetch$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["_sessionResponse"]
            });
            if (error) {
                throw error;
            }
            if (!data || !data.session || !data.user) {
                const invalidTokenError = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$errors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["AuthInvalidTokenResponseError"]();
                return this._returnResult({
                    data: {
                        user: null,
                        session: null
                    },
                    error: invalidTokenError
                });
            }
            if (data.session) {
                await this._saveSession(data.session);
                await this._notifyAllSubscribers('SIGNED_IN', data.session);
            }
            return this._returnResult({
                data: Object.assign({}, data),
                error
            });
        } catch (error) {
            if ((0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$errors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["isAuthError"])(error)) {
                return this._returnResult({
                    data: {
                        user: null,
                        session: null
                    },
                    error
                });
            }
            throw error;
        }
    }
    async _exchangeCodeForSession(authCode) {
        const storageItem = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$helpers$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["getItemAsync"])(this.storage, `${this.storageKey}-code-verifier`);
        const [codeVerifier, redirectType] = (storageItem !== null && storageItem !== void 0 ? storageItem : '').split('/');
        try {
            if (!codeVerifier && this.flowType === 'pkce') {
                throw new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$errors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["AuthPKCECodeVerifierMissingError"]();
            }
            const { data, error } = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$fetch$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["_request"])(this.fetch, 'POST', `${this.url}/token?grant_type=pkce`, {
                headers: this.headers,
                body: {
                    auth_code: authCode,
                    code_verifier: codeVerifier
                },
                xform: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$fetch$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["_sessionResponse"]
            });
            await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$helpers$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["removeItemAsync"])(this.storage, `${this.storageKey}-code-verifier`);
            if (error) {
                throw error;
            }
            if (!data || !data.session || !data.user) {
                const invalidTokenError = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$errors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["AuthInvalidTokenResponseError"]();
                return this._returnResult({
                    data: {
                        user: null,
                        session: null,
                        redirectType: null
                    },
                    error: invalidTokenError
                });
            }
            if (data.session) {
                await this._saveSession(data.session);
                await this._notifyAllSubscribers('SIGNED_IN', data.session);
            }
            return this._returnResult({
                data: Object.assign(Object.assign({}, data), {
                    redirectType: redirectType !== null && redirectType !== void 0 ? redirectType : null
                }),
                error
            });
        } catch (error) {
            await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$helpers$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["removeItemAsync"])(this.storage, `${this.storageKey}-code-verifier`);
            if ((0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$errors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["isAuthError"])(error)) {
                return this._returnResult({
                    data: {
                        user: null,
                        session: null,
                        redirectType: null
                    },
                    error
                });
            }
            throw error;
        }
    }
    /**
     * Allows signing in with an OIDC ID token. The authentication provider used
     * should be enabled and configured.
     */ async signInWithIdToken(credentials) {
        try {
            const { options, provider, token, access_token, nonce } = credentials;
            const res = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$fetch$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["_request"])(this.fetch, 'POST', `${this.url}/token?grant_type=id_token`, {
                headers: this.headers,
                body: {
                    provider,
                    id_token: token,
                    access_token,
                    nonce,
                    gotrue_meta_security: {
                        captcha_token: options === null || options === void 0 ? void 0 : options.captchaToken
                    }
                },
                xform: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$fetch$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["_sessionResponse"]
            });
            const { data, error } = res;
            if (error) {
                return this._returnResult({
                    data: {
                        user: null,
                        session: null
                    },
                    error
                });
            } else if (!data || !data.session || !data.user) {
                const invalidTokenError = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$errors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["AuthInvalidTokenResponseError"]();
                return this._returnResult({
                    data: {
                        user: null,
                        session: null
                    },
                    error: invalidTokenError
                });
            }
            if (data.session) {
                await this._saveSession(data.session);
                await this._notifyAllSubscribers('SIGNED_IN', data.session);
            }
            return this._returnResult({
                data,
                error
            });
        } catch (error) {
            if ((0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$errors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["isAuthError"])(error)) {
                return this._returnResult({
                    data: {
                        user: null,
                        session: null
                    },
                    error
                });
            }
            throw error;
        }
    }
    /**
     * Log in a user using magiclink or a one-time password (OTP).
     *
     * If the `{{ .ConfirmationURL }}` variable is specified in the email template, a magiclink will be sent.
     * If the `{{ .Token }}` variable is specified in the email template, an OTP will be sent.
     * If you're using phone sign-ins, only an OTP will be sent. You won't be able to send a magiclink for phone sign-ins.
     *
     * Be aware that you may get back an error message that will not distinguish
     * between the cases where the account does not exist or, that the account
     * can only be accessed via social login.
     *
     * Do note that you will need to configure a Whatsapp sender on Twilio
     * if you are using phone sign in with the 'whatsapp' channel. The whatsapp
     * channel is not supported on other providers
     * at this time.
     * This method supports PKCE when an email is passed.
     */ async signInWithOtp(credentials) {
        var _a, _b, _c, _d, _e;
        try {
            if ('email' in credentials) {
                const { email, options } = credentials;
                let codeChallenge = null;
                let codeChallengeMethod = null;
                if (this.flowType === 'pkce') {
                    ;
                    [codeChallenge, codeChallengeMethod] = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$helpers$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["getCodeChallengeAndMethod"])(this.storage, this.storageKey);
                }
                const { error } = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$fetch$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["_request"])(this.fetch, 'POST', `${this.url}/otp`, {
                    headers: this.headers,
                    body: {
                        email,
                        data: (_a = options === null || options === void 0 ? void 0 : options.data) !== null && _a !== void 0 ? _a : {},
                        create_user: (_b = options === null || options === void 0 ? void 0 : options.shouldCreateUser) !== null && _b !== void 0 ? _b : true,
                        gotrue_meta_security: {
                            captcha_token: options === null || options === void 0 ? void 0 : options.captchaToken
                        },
                        code_challenge: codeChallenge,
                        code_challenge_method: codeChallengeMethod
                    },
                    redirectTo: options === null || options === void 0 ? void 0 : options.emailRedirectTo
                });
                return this._returnResult({
                    data: {
                        user: null,
                        session: null
                    },
                    error
                });
            }
            if ('phone' in credentials) {
                const { phone, options } = credentials;
                const { data, error } = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$fetch$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["_request"])(this.fetch, 'POST', `${this.url}/otp`, {
                    headers: this.headers,
                    body: {
                        phone,
                        data: (_c = options === null || options === void 0 ? void 0 : options.data) !== null && _c !== void 0 ? _c : {},
                        create_user: (_d = options === null || options === void 0 ? void 0 : options.shouldCreateUser) !== null && _d !== void 0 ? _d : true,
                        gotrue_meta_security: {
                            captcha_token: options === null || options === void 0 ? void 0 : options.captchaToken
                        },
                        channel: (_e = options === null || options === void 0 ? void 0 : options.channel) !== null && _e !== void 0 ? _e : 'sms'
                    }
                });
                return this._returnResult({
                    data: {
                        user: null,
                        session: null,
                        messageId: data === null || data === void 0 ? void 0 : data.message_id
                    },
                    error
                });
            }
            throw new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$errors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["AuthInvalidCredentialsError"]('You must provide either an email or phone number.');
        } catch (error) {
            await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$helpers$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["removeItemAsync"])(this.storage, `${this.storageKey}-code-verifier`);
            if ((0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$errors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["isAuthError"])(error)) {
                return this._returnResult({
                    data: {
                        user: null,
                        session: null
                    },
                    error
                });
            }
            throw error;
        }
    }
    /**
     * Log in a user given a User supplied OTP or TokenHash received through mobile or email.
     */ async verifyOtp(params) {
        var _a, _b;
        try {
            let redirectTo = undefined;
            let captchaToken = undefined;
            if ('options' in params) {
                redirectTo = (_a = params.options) === null || _a === void 0 ? void 0 : _a.redirectTo;
                captchaToken = (_b = params.options) === null || _b === void 0 ? void 0 : _b.captchaToken;
            }
            const { data, error } = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$fetch$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["_request"])(this.fetch, 'POST', `${this.url}/verify`, {
                headers: this.headers,
                body: Object.assign(Object.assign({}, params), {
                    gotrue_meta_security: {
                        captcha_token: captchaToken
                    }
                }),
                redirectTo,
                xform: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$fetch$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["_sessionResponse"]
            });
            if (error) {
                throw error;
            }
            if (!data) {
                const tokenVerificationError = new Error('An error occurred on token verification.');
                throw tokenVerificationError;
            }
            const session = data.session;
            const user = data.user;
            if (session === null || session === void 0 ? void 0 : session.access_token) {
                await this._saveSession(session);
                await this._notifyAllSubscribers(params.type == 'recovery' ? 'PASSWORD_RECOVERY' : 'SIGNED_IN', session);
            }
            return this._returnResult({
                data: {
                    user,
                    session
                },
                error: null
            });
        } catch (error) {
            if ((0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$errors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["isAuthError"])(error)) {
                return this._returnResult({
                    data: {
                        user: null,
                        session: null
                    },
                    error
                });
            }
            throw error;
        }
    }
    /**
     * Attempts a single-sign on using an enterprise Identity Provider. A
     * successful SSO attempt will redirect the current page to the identity
     * provider authorization page. The redirect URL is implementation and SSO
     * protocol specific.
     *
     * You can use it by providing a SSO domain. Typically you can extract this
     * domain by asking users for their email address. If this domain is
     * registered on the Auth instance the redirect will use that organization's
     * currently active SSO Identity Provider for the login.
     *
     * If you have built an organization-specific login page, you can use the
     * organization's SSO Identity Provider UUID directly instead.
     */ async signInWithSSO(params) {
        var _a, _b, _c, _d, _e;
        try {
            let codeChallenge = null;
            let codeChallengeMethod = null;
            if (this.flowType === 'pkce') {
                ;
                [codeChallenge, codeChallengeMethod] = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$helpers$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["getCodeChallengeAndMethod"])(this.storage, this.storageKey);
            }
            const result = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$fetch$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["_request"])(this.fetch, 'POST', `${this.url}/sso`, {
                body: Object.assign(Object.assign(Object.assign(Object.assign(Object.assign({}, 'providerId' in params ? {
                    provider_id: params.providerId
                } : null), 'domain' in params ? {
                    domain: params.domain
                } : null), {
                    redirect_to: (_b = (_a = params.options) === null || _a === void 0 ? void 0 : _a.redirectTo) !== null && _b !== void 0 ? _b : undefined
                }), ((_c = params === null || params === void 0 ? void 0 : params.options) === null || _c === void 0 ? void 0 : _c.captchaToken) ? {
                    gotrue_meta_security: {
                        captcha_token: params.options.captchaToken
                    }
                } : null), {
                    skip_http_redirect: true,
                    code_challenge: codeChallenge,
                    code_challenge_method: codeChallengeMethod
                }),
                headers: this.headers,
                xform: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$fetch$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["_ssoResponse"]
            });
            // Automatically redirect in browser unless skipBrowserRedirect is true
            if (((_d = result.data) === null || _d === void 0 ? void 0 : _d.url) && (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$helpers$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["isBrowser"])() && !((_e = params.options) === null || _e === void 0 ? void 0 : _e.skipBrowserRedirect)) {
                window.location.assign(result.data.url);
            }
            return this._returnResult(result);
        } catch (error) {
            await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$helpers$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["removeItemAsync"])(this.storage, `${this.storageKey}-code-verifier`);
            if ((0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$errors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["isAuthError"])(error)) {
                return this._returnResult({
                    data: null,
                    error
                });
            }
            throw error;
        }
    }
    /**
     * Sends a reauthentication OTP to the user's email or phone number.
     * Requires the user to be signed-in.
     */ async reauthenticate() {
        await this.initializePromise;
        return await this._acquireLock(this.lockAcquireTimeout, async ()=>{
            return await this._reauthenticate();
        });
    }
    async _reauthenticate() {
        try {
            return await this._useSession(async (result)=>{
                const { data: { session }, error: sessionError } = result;
                if (sessionError) throw sessionError;
                if (!session) throw new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$errors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["AuthSessionMissingError"]();
                const { error } = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$fetch$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["_request"])(this.fetch, 'GET', `${this.url}/reauthenticate`, {
                    headers: this.headers,
                    jwt: session.access_token
                });
                return this._returnResult({
                    data: {
                        user: null,
                        session: null
                    },
                    error
                });
            });
        } catch (error) {
            if ((0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$errors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["isAuthError"])(error)) {
                return this._returnResult({
                    data: {
                        user: null,
                        session: null
                    },
                    error
                });
            }
            throw error;
        }
    }
    /**
     * Resends an existing signup confirmation email, email change email, SMS OTP or phone change OTP.
     */ async resend(credentials) {
        try {
            const endpoint = `${this.url}/resend`;
            if ('email' in credentials) {
                const { email, type, options } = credentials;
                const { error } = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$fetch$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["_request"])(this.fetch, 'POST', endpoint, {
                    headers: this.headers,
                    body: {
                        email,
                        type,
                        gotrue_meta_security: {
                            captcha_token: options === null || options === void 0 ? void 0 : options.captchaToken
                        }
                    },
                    redirectTo: options === null || options === void 0 ? void 0 : options.emailRedirectTo
                });
                return this._returnResult({
                    data: {
                        user: null,
                        session: null
                    },
                    error
                });
            } else if ('phone' in credentials) {
                const { phone, type, options } = credentials;
                const { data, error } = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$fetch$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["_request"])(this.fetch, 'POST', endpoint, {
                    headers: this.headers,
                    body: {
                        phone,
                        type,
                        gotrue_meta_security: {
                            captcha_token: options === null || options === void 0 ? void 0 : options.captchaToken
                        }
                    }
                });
                return this._returnResult({
                    data: {
                        user: null,
                        session: null,
                        messageId: data === null || data === void 0 ? void 0 : data.message_id
                    },
                    error
                });
            }
            throw new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$errors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["AuthInvalidCredentialsError"]('You must provide either an email or phone number and a type');
        } catch (error) {
            if ((0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$errors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["isAuthError"])(error)) {
                return this._returnResult({
                    data: {
                        user: null,
                        session: null
                    },
                    error
                });
            }
            throw error;
        }
    }
    /**
     * Returns the session, refreshing it if necessary.
     *
     * The session returned can be null if the session is not detected which can happen in the event a user is not signed-in or has logged out.
     *
     * **IMPORTANT:** This method loads values directly from the storage attached
     * to the client. If that storage is based on request cookies for example,
     * the values in it may not be authentic and therefore it's strongly advised
     * against using this method and its results in such circumstances. A warning
     * will be emitted if this is detected. Use {@link #getUser()} instead.
     */ async getSession() {
        await this.initializePromise;
        const result = await this._acquireLock(this.lockAcquireTimeout, async ()=>{
            return this._useSession(async (result)=>{
                return result;
            });
        });
        return result;
    }
    /**
     * Acquires a global lock based on the storage key.
     */ async _acquireLock(acquireTimeout, fn) {
        this._debug('#_acquireLock', 'begin', acquireTimeout);
        try {
            if (this.lockAcquired) {
                const last = this.pendingInLock.length ? this.pendingInLock[this.pendingInLock.length - 1] : Promise.resolve();
                const result = (async ()=>{
                    await last;
                    return await fn();
                })();
                this.pendingInLock.push((async ()=>{
                    try {
                        await result;
                    } catch (e) {
                    // we just care if it finished
                    }
                })());
                return result;
            }
            return await this.lock(`lock:${this.storageKey}`, acquireTimeout, async ()=>{
                this._debug('#_acquireLock', 'lock acquired for storage key', this.storageKey);
                try {
                    this.lockAcquired = true;
                    const result = fn();
                    this.pendingInLock.push((async ()=>{
                        try {
                            await result;
                        } catch (e) {
                        // we just care if it finished
                        }
                    })());
                    await result;
                    // keep draining the queue until there's nothing to wait on
                    while(this.pendingInLock.length){
                        const waitOn = [
                            ...this.pendingInLock
                        ];
                        await Promise.all(waitOn);
                        this.pendingInLock.splice(0, waitOn.length);
                    }
                    return await result;
                } finally{
                    this._debug('#_acquireLock', 'lock released for storage key', this.storageKey);
                    this.lockAcquired = false;
                }
            });
        } finally{
            this._debug('#_acquireLock', 'end');
        }
    }
    /**
     * Use instead of {@link #getSession} inside the library. It is
     * semantically usually what you want, as getting a session involves some
     * processing afterwards that requires only one client operating on the
     * session at once across multiple tabs or processes.
     */ async _useSession(fn) {
        this._debug('#_useSession', 'begin');
        try {
            // the use of __loadSession here is the only correct use of the function!
            const result = await this.__loadSession();
            return await fn(result);
        } finally{
            this._debug('#_useSession', 'end');
        }
    }
    /**
     * NEVER USE DIRECTLY!
     *
     * Always use {@link #_useSession}.
     */ async __loadSession() {
        this._debug('#__loadSession()', 'begin');
        if (!this.lockAcquired) {
            this._debug('#__loadSession()', 'used outside of an acquired lock!', new Error().stack);
        }
        try {
            let currentSession = null;
            const maybeSession = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$helpers$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["getItemAsync"])(this.storage, this.storageKey);
            this._debug('#getSession()', 'session from storage', maybeSession);
            if (maybeSession !== null) {
                if (this._isValidSession(maybeSession)) {
                    currentSession = maybeSession;
                } else {
                    this._debug('#getSession()', 'session from storage is not valid');
                    await this._removeSession();
                }
            }
            if (!currentSession) {
                return {
                    data: {
                        session: null
                    },
                    error: null
                };
            }
            // A session is considered expired before the access token _actually_
            // expires. When the autoRefreshToken option is off (or when the tab is
            // in the background), very eager users of getSession() -- like
            // realtime-js -- might send a valid JWT which will expire by the time it
            // reaches the server.
            const hasExpired = currentSession.expires_at ? currentSession.expires_at * 1000 - Date.now() < __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$constants$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["EXPIRY_MARGIN_MS"] : false;
            this._debug('#__loadSession()', `session has${hasExpired ? '' : ' not'} expired`, 'expires_at', currentSession.expires_at);
            if (!hasExpired) {
                if (this.userStorage) {
                    const maybeUser = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$helpers$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["getItemAsync"])(this.userStorage, this.storageKey + '-user');
                    if (maybeUser === null || maybeUser === void 0 ? void 0 : maybeUser.user) {
                        currentSession.user = maybeUser.user;
                    } else {
                        currentSession.user = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$helpers$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["userNotAvailableProxy"])();
                    }
                }
                // Wrap the user object with a warning proxy on the server
                // This warns when properties of the user are accessed, not when session.user itself is accessed
                if (this.storage.isServer && currentSession.user && !currentSession.user.__isUserNotAvailableProxy) {
                    const suppressWarningRef = {
                        value: this.suppressGetSessionWarning
                    };
                    currentSession.user = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$helpers$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["insecureUserWarningProxy"])(currentSession.user, suppressWarningRef);
                    // Update the client-level suppression flag when the proxy suppresses the warning
                    if (suppressWarningRef.value) {
                        this.suppressGetSessionWarning = true;
                    }
                }
                return {
                    data: {
                        session: currentSession
                    },
                    error: null
                };
            }
            const { data: session, error } = await this._callRefreshToken(currentSession.refresh_token);
            if (error) {
                return this._returnResult({
                    data: {
                        session: null
                    },
                    error
                });
            }
            return this._returnResult({
                data: {
                    session
                },
                error: null
            });
        } finally{
            this._debug('#__loadSession()', 'end');
        }
    }
    /**
     * Gets the current user details if there is an existing session. This method
     * performs a network request to the Supabase Auth server, so the returned
     * value is authentic and can be used to base authorization rules on.
     *
     * @param jwt Takes in an optional access token JWT. If no JWT is provided, the JWT from the current session is used.
     */ async getUser(jwt) {
        if (jwt) {
            return await this._getUser(jwt);
        }
        await this.initializePromise;
        const result = await this._acquireLock(this.lockAcquireTimeout, async ()=>{
            return await this._getUser();
        });
        if (result.data.user) {
            this.suppressGetSessionWarning = true;
        }
        return result;
    }
    async _getUser(jwt) {
        try {
            if (jwt) {
                return await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$fetch$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["_request"])(this.fetch, 'GET', `${this.url}/user`, {
                    headers: this.headers,
                    jwt: jwt,
                    xform: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$fetch$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["_userResponse"]
                });
            }
            return await this._useSession(async (result)=>{
                var _a, _b, _c;
                const { data, error } = result;
                if (error) {
                    throw error;
                }
                // returns an error if there is no access_token or custom authorization header
                if (!((_a = data.session) === null || _a === void 0 ? void 0 : _a.access_token) && !this.hasCustomAuthorizationHeader) {
                    return {
                        data: {
                            user: null
                        },
                        error: new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$errors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["AuthSessionMissingError"]()
                    };
                }
                return await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$fetch$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["_request"])(this.fetch, 'GET', `${this.url}/user`, {
                    headers: this.headers,
                    jwt: (_c = (_b = data.session) === null || _b === void 0 ? void 0 : _b.access_token) !== null && _c !== void 0 ? _c : undefined,
                    xform: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$fetch$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["_userResponse"]
                });
            });
        } catch (error) {
            if ((0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$errors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["isAuthError"])(error)) {
                if ((0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$errors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["isAuthSessionMissingError"])(error)) {
                    // JWT contains a `session_id` which does not correspond to an active
                    // session in the database, indicating the user is signed out.
                    await this._removeSession();
                    await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$helpers$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["removeItemAsync"])(this.storage, `${this.storageKey}-code-verifier`);
                }
                return this._returnResult({
                    data: {
                        user: null
                    },
                    error
                });
            }
            throw error;
        }
    }
    /**
     * Updates user data for a logged in user.
     */ async updateUser(attributes, options = {}) {
        await this.initializePromise;
        return await this._acquireLock(this.lockAcquireTimeout, async ()=>{
            return await this._updateUser(attributes, options);
        });
    }
    async _updateUser(attributes, options = {}) {
        try {
            return await this._useSession(async (result)=>{
                const { data: sessionData, error: sessionError } = result;
                if (sessionError) {
                    throw sessionError;
                }
                if (!sessionData.session) {
                    throw new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$errors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["AuthSessionMissingError"]();
                }
                const session = sessionData.session;
                let codeChallenge = null;
                let codeChallengeMethod = null;
                if (this.flowType === 'pkce' && attributes.email != null) {
                    ;
                    [codeChallenge, codeChallengeMethod] = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$helpers$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["getCodeChallengeAndMethod"])(this.storage, this.storageKey);
                }
                const { data, error: userError } = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$fetch$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["_request"])(this.fetch, 'PUT', `${this.url}/user`, {
                    headers: this.headers,
                    redirectTo: options === null || options === void 0 ? void 0 : options.emailRedirectTo,
                    body: Object.assign(Object.assign({}, attributes), {
                        code_challenge: codeChallenge,
                        code_challenge_method: codeChallengeMethod
                    }),
                    jwt: session.access_token,
                    xform: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$fetch$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["_userResponse"]
                });
                if (userError) {
                    throw userError;
                }
                session.user = data.user;
                await this._saveSession(session);
                await this._notifyAllSubscribers('USER_UPDATED', session);
                return this._returnResult({
                    data: {
                        user: session.user
                    },
                    error: null
                });
            });
        } catch (error) {
            await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$helpers$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["removeItemAsync"])(this.storage, `${this.storageKey}-code-verifier`);
            if ((0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$errors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["isAuthError"])(error)) {
                return this._returnResult({
                    data: {
                        user: null
                    },
                    error
                });
            }
            throw error;
        }
    }
    /**
     * Sets the session data from the current session. If the current session is expired, setSession will take care of refreshing it to obtain a new session.
     * If the refresh token or access token in the current session is invalid, an error will be thrown.
     * @param currentSession The current session that minimally contains an access token and refresh token.
     */ async setSession(currentSession) {
        await this.initializePromise;
        return await this._acquireLock(this.lockAcquireTimeout, async ()=>{
            return await this._setSession(currentSession);
        });
    }
    async _setSession(currentSession) {
        try {
            if (!currentSession.access_token || !currentSession.refresh_token) {
                throw new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$errors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["AuthSessionMissingError"]();
            }
            const timeNow = Date.now() / 1000;
            let expiresAt = timeNow;
            let hasExpired = true;
            let session = null;
            const { payload } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$helpers$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["decodeJWT"])(currentSession.access_token);
            if (payload.exp) {
                expiresAt = payload.exp;
                hasExpired = expiresAt <= timeNow;
            }
            if (hasExpired) {
                const { data: refreshedSession, error } = await this._callRefreshToken(currentSession.refresh_token);
                if (error) {
                    return this._returnResult({
                        data: {
                            user: null,
                            session: null
                        },
                        error: error
                    });
                }
                if (!refreshedSession) {
                    return {
                        data: {
                            user: null,
                            session: null
                        },
                        error: null
                    };
                }
                session = refreshedSession;
            } else {
                const { data, error } = await this._getUser(currentSession.access_token);
                if (error) {
                    return this._returnResult({
                        data: {
                            user: null,
                            session: null
                        },
                        error
                    });
                }
                session = {
                    access_token: currentSession.access_token,
                    refresh_token: currentSession.refresh_token,
                    user: data.user,
                    token_type: 'bearer',
                    expires_in: expiresAt - timeNow,
                    expires_at: expiresAt
                };
                await this._saveSession(session);
                await this._notifyAllSubscribers('SIGNED_IN', session);
            }
            return this._returnResult({
                data: {
                    user: session.user,
                    session
                },
                error: null
            });
        } catch (error) {
            if ((0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$errors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["isAuthError"])(error)) {
                return this._returnResult({
                    data: {
                        session: null,
                        user: null
                    },
                    error
                });
            }
            throw error;
        }
    }
    /**
     * Returns a new session, regardless of expiry status.
     * Takes in an optional current session. If not passed in, then refreshSession() will attempt to retrieve it from getSession().
     * If the current session's refresh token is invalid, an error will be thrown.
     * @param currentSession The current session. If passed in, it must contain a refresh token.
     */ async refreshSession(currentSession) {
        await this.initializePromise;
        return await this._acquireLock(this.lockAcquireTimeout, async ()=>{
            return await this._refreshSession(currentSession);
        });
    }
    async _refreshSession(currentSession) {
        try {
            return await this._useSession(async (result)=>{
                var _a;
                if (!currentSession) {
                    const { data, error } = result;
                    if (error) {
                        throw error;
                    }
                    currentSession = (_a = data.session) !== null && _a !== void 0 ? _a : undefined;
                }
                if (!(currentSession === null || currentSession === void 0 ? void 0 : currentSession.refresh_token)) {
                    throw new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$errors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["AuthSessionMissingError"]();
                }
                const { data: session, error } = await this._callRefreshToken(currentSession.refresh_token);
                if (error) {
                    return this._returnResult({
                        data: {
                            user: null,
                            session: null
                        },
                        error: error
                    });
                }
                if (!session) {
                    return this._returnResult({
                        data: {
                            user: null,
                            session: null
                        },
                        error: null
                    });
                }
                return this._returnResult({
                    data: {
                        user: session.user,
                        session
                    },
                    error: null
                });
            });
        } catch (error) {
            if ((0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$errors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["isAuthError"])(error)) {
                return this._returnResult({
                    data: {
                        user: null,
                        session: null
                    },
                    error
                });
            }
            throw error;
        }
    }
    /**
     * Gets the session data from a URL string
     */ async _getSessionFromURL(params, callbackUrlType) {
        try {
            if (!(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$helpers$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["isBrowser"])()) throw new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$errors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["AuthImplicitGrantRedirectError"]('No browser detected.');
            // If there's an error in the URL, it doesn't matter what flow it is, we just return the error.
            if (params.error || params.error_description || params.error_code) {
                // The error class returned implies that the redirect is from an implicit grant flow
                // but it could also be from a redirect error from a PKCE flow.
                throw new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$errors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["AuthImplicitGrantRedirectError"](params.error_description || 'Error in URL with unspecified error_description', {
                    error: params.error || 'unspecified_error',
                    code: params.error_code || 'unspecified_code'
                });
            }
            // Checks for mismatches between the flowType initialised in the client and the URL parameters
            switch(callbackUrlType){
                case 'implicit':
                    if (this.flowType === 'pkce') {
                        throw new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$errors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["AuthPKCEGrantCodeExchangeError"]('Not a valid PKCE flow url.');
                    }
                    break;
                case 'pkce':
                    if (this.flowType === 'implicit') {
                        throw new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$errors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["AuthImplicitGrantRedirectError"]('Not a valid implicit grant flow url.');
                    }
                    break;
                default:
            }
            // Since this is a redirect for PKCE, we attempt to retrieve the code from the URL for the code exchange
            if (callbackUrlType === 'pkce') {
                this._debug('#_initialize()', 'begin', 'is PKCE flow', true);
                if (!params.code) throw new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$errors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["AuthPKCEGrantCodeExchangeError"]('No code detected.');
                const { data, error } = await this._exchangeCodeForSession(params.code);
                if (error) throw error;
                const url = new URL(window.location.href);
                url.searchParams.delete('code');
                window.history.replaceState(window.history.state, '', url.toString());
                return {
                    data: {
                        session: data.session,
                        redirectType: null
                    },
                    error: null
                };
            }
            const { provider_token, provider_refresh_token, access_token, refresh_token, expires_in, expires_at, token_type } = params;
            if (!access_token || !expires_in || !refresh_token || !token_type) {
                throw new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$errors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["AuthImplicitGrantRedirectError"]('No session defined in URL');
            }
            const timeNow = Math.round(Date.now() / 1000);
            const expiresIn = parseInt(expires_in);
            let expiresAt = timeNow + expiresIn;
            if (expires_at) {
                expiresAt = parseInt(expires_at);
            }
            const actuallyExpiresIn = expiresAt - timeNow;
            if (actuallyExpiresIn * 1000 <= __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$constants$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["AUTO_REFRESH_TICK_DURATION_MS"]) {
                console.warn(`@supabase/gotrue-js: Session as retrieved from URL expires in ${actuallyExpiresIn}s, should have been closer to ${expiresIn}s`);
            }
            const issuedAt = expiresAt - expiresIn;
            if (timeNow - issuedAt >= 120) {
                console.warn('@supabase/gotrue-js: Session as retrieved from URL was issued over 120s ago, URL could be stale', issuedAt, expiresAt, timeNow);
            } else if (timeNow - issuedAt < 0) {
                console.warn('@supabase/gotrue-js: Session as retrieved from URL was issued in the future? Check the device clock for skew', issuedAt, expiresAt, timeNow);
            }
            const { data, error } = await this._getUser(access_token);
            if (error) throw error;
            const session = {
                provider_token,
                provider_refresh_token,
                access_token,
                expires_in: expiresIn,
                expires_at: expiresAt,
                refresh_token,
                token_type: token_type,
                user: data.user
            };
            // Remove tokens from URL
            window.location.hash = '';
            this._debug('#_getSessionFromURL()', 'clearing window.location.hash');
            return this._returnResult({
                data: {
                    session,
                    redirectType: params.type
                },
                error: null
            });
        } catch (error) {
            if ((0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$errors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["isAuthError"])(error)) {
                return this._returnResult({
                    data: {
                        session: null,
                        redirectType: null
                    },
                    error
                });
            }
            throw error;
        }
    }
    /**
     * Checks if the current URL contains parameters given by an implicit oauth grant flow (https://www.rfc-editor.org/rfc/rfc6749.html#section-4.2)
     *
     * If `detectSessionInUrl` is a function, it will be called with the URL and params to determine
     * if the URL should be processed as a Supabase auth callback. This allows users to exclude
     * URLs from other OAuth providers (e.g., Facebook Login) that also return access_token in the fragment.
     */ _isImplicitGrantCallback(params) {
        if (typeof this.detectSessionInUrl === 'function') {
            return this.detectSessionInUrl(new URL(window.location.href), params);
        }
        return Boolean(params.access_token || params.error_description);
    }
    /**
     * Checks if the current URL and backing storage contain parameters given by a PKCE flow
     */ async _isPKCECallback(params) {
        const currentStorageContent = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$helpers$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["getItemAsync"])(this.storage, `${this.storageKey}-code-verifier`);
        return !!(params.code && currentStorageContent);
    }
    /**
     * Inside a browser context, `signOut()` will remove the logged in user from the browser session and log them out - removing all items from localstorage and then trigger a `"SIGNED_OUT"` event.
     *
     * For server-side management, you can revoke all refresh tokens for a user by passing a user's JWT through to `auth.api.signOut(JWT: string)`.
     * There is no way to revoke a user's access token jwt until it expires. It is recommended to set a shorter expiry on the jwt for this reason.
     *
     * If using `others` scope, no `SIGNED_OUT` event is fired!
     */ async signOut(options = {
        scope: 'global'
    }) {
        await this.initializePromise;
        return await this._acquireLock(this.lockAcquireTimeout, async ()=>{
            return await this._signOut(options);
        });
    }
    async _signOut({ scope } = {
        scope: 'global'
    }) {
        return await this._useSession(async (result)=>{
            var _a;
            const { data, error: sessionError } = result;
            if (sessionError && !(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$errors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["isAuthSessionMissingError"])(sessionError)) {
                return this._returnResult({
                    error: sessionError
                });
            }
            const accessToken = (_a = data.session) === null || _a === void 0 ? void 0 : _a.access_token;
            if (accessToken) {
                const { error } = await this.admin.signOut(accessToken, scope);
                if (error) {
                    // ignore 404s since user might not exist anymore
                    // ignore 401s since an invalid or expired JWT should sign out the current session
                    if (!((0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$errors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["isAuthApiError"])(error) && (error.status === 404 || error.status === 401 || error.status === 403) || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$errors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["isAuthSessionMissingError"])(error))) {
                        return this._returnResult({
                            error
                        });
                    }
                }
            }
            if (scope !== 'others') {
                await this._removeSession();
                await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$helpers$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["removeItemAsync"])(this.storage, `${this.storageKey}-code-verifier`);
            }
            return this._returnResult({
                error: null
            });
        });
    }
    onAuthStateChange(callback) {
        const id = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$helpers$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["generateCallbackId"])();
        const subscription = {
            id,
            callback,
            unsubscribe: ()=>{
                this._debug('#unsubscribe()', 'state change callback with id removed', id);
                this.stateChangeEmitters.delete(id);
            }
        };
        this._debug('#onAuthStateChange()', 'registered callback with id', id);
        this.stateChangeEmitters.set(id, subscription);
        (async ()=>{
            await this.initializePromise;
            await this._acquireLock(this.lockAcquireTimeout, async ()=>{
                this._emitInitialSession(id);
            });
        })();
        return {
            data: {
                subscription
            }
        };
    }
    async _emitInitialSession(id) {
        return await this._useSession(async (result)=>{
            var _a, _b;
            try {
                const { data: { session }, error } = result;
                if (error) throw error;
                await ((_a = this.stateChangeEmitters.get(id)) === null || _a === void 0 ? void 0 : _a.callback('INITIAL_SESSION', session));
                this._debug('INITIAL_SESSION', 'callback id', id, 'session', session);
            } catch (err) {
                await ((_b = this.stateChangeEmitters.get(id)) === null || _b === void 0 ? void 0 : _b.callback('INITIAL_SESSION', null));
                this._debug('INITIAL_SESSION', 'callback id', id, 'error', err);
                console.error(err);
            }
        });
    }
    /**
     * Sends a password reset request to an email address. This method supports the PKCE flow.
     *
     * @param email The email address of the user.
     * @param options.redirectTo The URL to send the user to after they click the password reset link.
     * @param options.captchaToken Verification token received when the user completes the captcha on the site.
     */ async resetPasswordForEmail(email, options = {}) {
        let codeChallenge = null;
        let codeChallengeMethod = null;
        if (this.flowType === 'pkce') {
            ;
            [codeChallenge, codeChallengeMethod] = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$helpers$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["getCodeChallengeAndMethod"])(this.storage, this.storageKey, true // isPasswordRecovery
            );
        }
        try {
            return await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$fetch$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["_request"])(this.fetch, 'POST', `${this.url}/recover`, {
                body: {
                    email,
                    code_challenge: codeChallenge,
                    code_challenge_method: codeChallengeMethod,
                    gotrue_meta_security: {
                        captcha_token: options.captchaToken
                    }
                },
                headers: this.headers,
                redirectTo: options.redirectTo
            });
        } catch (error) {
            await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$helpers$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["removeItemAsync"])(this.storage, `${this.storageKey}-code-verifier`);
            if ((0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$errors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["isAuthError"])(error)) {
                return this._returnResult({
                    data: null,
                    error
                });
            }
            throw error;
        }
    }
    /**
     * Gets all the identities linked to a user.
     */ async getUserIdentities() {
        var _a;
        try {
            const { data, error } = await this.getUser();
            if (error) throw error;
            return this._returnResult({
                data: {
                    identities: (_a = data.user.identities) !== null && _a !== void 0 ? _a : []
                },
                error: null
            });
        } catch (error) {
            if ((0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$errors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["isAuthError"])(error)) {
                return this._returnResult({
                    data: null,
                    error
                });
            }
            throw error;
        }
    }
    async linkIdentity(credentials) {
        if ('token' in credentials) {
            return this.linkIdentityIdToken(credentials);
        }
        return this.linkIdentityOAuth(credentials);
    }
    async linkIdentityOAuth(credentials) {
        var _a;
        try {
            const { data, error } = await this._useSession(async (result)=>{
                var _a, _b, _c, _d, _e;
                const { data, error } = result;
                if (error) throw error;
                const url = await this._getUrlForProvider(`${this.url}/user/identities/authorize`, credentials.provider, {
                    redirectTo: (_a = credentials.options) === null || _a === void 0 ? void 0 : _a.redirectTo,
                    scopes: (_b = credentials.options) === null || _b === void 0 ? void 0 : _b.scopes,
                    queryParams: (_c = credentials.options) === null || _c === void 0 ? void 0 : _c.queryParams,
                    skipBrowserRedirect: true
                });
                return await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$fetch$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["_request"])(this.fetch, 'GET', url, {
                    headers: this.headers,
                    jwt: (_e = (_d = data.session) === null || _d === void 0 ? void 0 : _d.access_token) !== null && _e !== void 0 ? _e : undefined
                });
            });
            if (error) throw error;
            if ((0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$helpers$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["isBrowser"])() && !((_a = credentials.options) === null || _a === void 0 ? void 0 : _a.skipBrowserRedirect)) {
                window.location.assign(data === null || data === void 0 ? void 0 : data.url);
            }
            return this._returnResult({
                data: {
                    provider: credentials.provider,
                    url: data === null || data === void 0 ? void 0 : data.url
                },
                error: null
            });
        } catch (error) {
            if ((0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$errors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["isAuthError"])(error)) {
                return this._returnResult({
                    data: {
                        provider: credentials.provider,
                        url: null
                    },
                    error
                });
            }
            throw error;
        }
    }
    async linkIdentityIdToken(credentials) {
        return await this._useSession(async (result)=>{
            var _a;
            try {
                const { error: sessionError, data: { session } } = result;
                if (sessionError) throw sessionError;
                const { options, provider, token, access_token, nonce } = credentials;
                const res = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$fetch$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["_request"])(this.fetch, 'POST', `${this.url}/token?grant_type=id_token`, {
                    headers: this.headers,
                    jwt: (_a = session === null || session === void 0 ? void 0 : session.access_token) !== null && _a !== void 0 ? _a : undefined,
                    body: {
                        provider,
                        id_token: token,
                        access_token,
                        nonce,
                        link_identity: true,
                        gotrue_meta_security: {
                            captcha_token: options === null || options === void 0 ? void 0 : options.captchaToken
                        }
                    },
                    xform: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$fetch$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["_sessionResponse"]
                });
                const { data, error } = res;
                if (error) {
                    return this._returnResult({
                        data: {
                            user: null,
                            session: null
                        },
                        error
                    });
                } else if (!data || !data.session || !data.user) {
                    return this._returnResult({
                        data: {
                            user: null,
                            session: null
                        },
                        error: new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$errors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["AuthInvalidTokenResponseError"]()
                    });
                }
                if (data.session) {
                    await this._saveSession(data.session);
                    await this._notifyAllSubscribers('USER_UPDATED', data.session);
                }
                return this._returnResult({
                    data,
                    error
                });
            } catch (error) {
                await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$helpers$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["removeItemAsync"])(this.storage, `${this.storageKey}-code-verifier`);
                if ((0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$errors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["isAuthError"])(error)) {
                    return this._returnResult({
                        data: {
                            user: null,
                            session: null
                        },
                        error
                    });
                }
                throw error;
            }
        });
    }
    /**
     * Unlinks an identity from a user by deleting it. The user will no longer be able to sign in with that identity once it's unlinked.
     */ async unlinkIdentity(identity) {
        try {
            return await this._useSession(async (result)=>{
                var _a, _b;
                const { data, error } = result;
                if (error) {
                    throw error;
                }
                return await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$fetch$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["_request"])(this.fetch, 'DELETE', `${this.url}/user/identities/${identity.identity_id}`, {
                    headers: this.headers,
                    jwt: (_b = (_a = data.session) === null || _a === void 0 ? void 0 : _a.access_token) !== null && _b !== void 0 ? _b : undefined
                });
            });
        } catch (error) {
            if ((0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$errors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["isAuthError"])(error)) {
                return this._returnResult({
                    data: null,
                    error
                });
            }
            throw error;
        }
    }
    /**
     * Generates a new JWT.
     * @param refreshToken A valid refresh token that was returned on login.
     */ async _refreshAccessToken(refreshToken) {
        const debugName = `#_refreshAccessToken(${refreshToken.substring(0, 5)}...)`;
        this._debug(debugName, 'begin');
        try {
            const startedAt = Date.now();
            // will attempt to refresh the token with exponential backoff
            return await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$helpers$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["retryable"])(async (attempt)=>{
                if (attempt > 0) {
                    await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$helpers$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["sleep"])(200 * Math.pow(2, attempt - 1)); // 200, 400, 800, ...
                }
                this._debug(debugName, 'refreshing attempt', attempt);
                return await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$fetch$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["_request"])(this.fetch, 'POST', `${this.url}/token?grant_type=refresh_token`, {
                    body: {
                        refresh_token: refreshToken
                    },
                    headers: this.headers,
                    xform: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$fetch$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["_sessionResponse"]
                });
            }, (attempt, error)=>{
                const nextBackOffInterval = 200 * Math.pow(2, attempt);
                return error && (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$errors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["isAuthRetryableFetchError"])(error) && // retryable only if the request can be sent before the backoff overflows the tick duration
                Date.now() + nextBackOffInterval - startedAt < __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$constants$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["AUTO_REFRESH_TICK_DURATION_MS"];
            });
        } catch (error) {
            this._debug(debugName, 'error', error);
            if ((0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$errors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["isAuthError"])(error)) {
                return this._returnResult({
                    data: {
                        session: null,
                        user: null
                    },
                    error
                });
            }
            throw error;
        } finally{
            this._debug(debugName, 'end');
        }
    }
    _isValidSession(maybeSession) {
        const isValidSession = typeof maybeSession === 'object' && maybeSession !== null && 'access_token' in maybeSession && 'refresh_token' in maybeSession && 'expires_at' in maybeSession;
        return isValidSession;
    }
    async _handleProviderSignIn(provider, options) {
        const url = await this._getUrlForProvider(`${this.url}/authorize`, provider, {
            redirectTo: options.redirectTo,
            scopes: options.scopes,
            queryParams: options.queryParams
        });
        this._debug('#_handleProviderSignIn()', 'provider', provider, 'options', options, 'url', url);
        // try to open on the browser
        if ((0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$helpers$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["isBrowser"])() && !options.skipBrowserRedirect) {
            window.location.assign(url);
        }
        return {
            data: {
                provider,
                url
            },
            error: null
        };
    }
    /**
     * Recovers the session from LocalStorage and refreshes the token
     * Note: this method is async to accommodate for AsyncStorage e.g. in React native.
     */ async _recoverAndRefresh() {
        var _a, _b;
        const debugName = '#_recoverAndRefresh()';
        this._debug(debugName, 'begin');
        try {
            const currentSession = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$helpers$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["getItemAsync"])(this.storage, this.storageKey);
            if (currentSession && this.userStorage) {
                let maybeUser = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$helpers$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["getItemAsync"])(this.userStorage, this.storageKey + '-user');
                if (!this.storage.isServer && Object.is(this.storage, this.userStorage) && !maybeUser) {
                    // storage and userStorage are the same storage medium, for example
                    // window.localStorage if userStorage does not have the user from
                    // storage stored, store it first thereby migrating the user object
                    // from storage -> userStorage
                    maybeUser = {
                        user: currentSession.user
                    };
                    await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$helpers$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["setItemAsync"])(this.userStorage, this.storageKey + '-user', maybeUser);
                }
                currentSession.user = (_a = maybeUser === null || maybeUser === void 0 ? void 0 : maybeUser.user) !== null && _a !== void 0 ? _a : (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$helpers$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["userNotAvailableProxy"])();
            } else if (currentSession && !currentSession.user) {
                // user storage is not set, let's check if it was previously enabled so
                // we bring back the storage as it should be
                if (!currentSession.user) {
                    // test if userStorage was previously enabled and the storage medium was the same, to move the user back under the same key
                    const separateUser = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$helpers$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["getItemAsync"])(this.storage, this.storageKey + '-user');
                    if (separateUser && (separateUser === null || separateUser === void 0 ? void 0 : separateUser.user)) {
                        currentSession.user = separateUser.user;
                        await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$helpers$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["removeItemAsync"])(this.storage, this.storageKey + '-user');
                        await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$helpers$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["setItemAsync"])(this.storage, this.storageKey, currentSession);
                    } else {
                        currentSession.user = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$helpers$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["userNotAvailableProxy"])();
                    }
                }
            }
            this._debug(debugName, 'session from storage', currentSession);
            if (!this._isValidSession(currentSession)) {
                this._debug(debugName, 'session is not valid');
                if (currentSession !== null) {
                    await this._removeSession();
                }
                return;
            }
            const expiresWithMargin = ((_b = currentSession.expires_at) !== null && _b !== void 0 ? _b : Infinity) * 1000 - Date.now() < __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$constants$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["EXPIRY_MARGIN_MS"];
            this._debug(debugName, `session has${expiresWithMargin ? '' : ' not'} expired with margin of ${__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$constants$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["EXPIRY_MARGIN_MS"]}s`);
            if (expiresWithMargin) {
                if (this.autoRefreshToken && currentSession.refresh_token) {
                    const { error } = await this._callRefreshToken(currentSession.refresh_token);
                    if (error) {
                        console.error(error);
                        if (!(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$errors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["isAuthRetryableFetchError"])(error)) {
                            this._debug(debugName, 'refresh failed with a non-retryable error, removing the session', error);
                            await this._removeSession();
                        }
                    }
                }
            } else if (currentSession.user && currentSession.user.__isUserNotAvailableProxy === true) {
                // If we have a proxy user, try to get the real user data
                try {
                    const { data, error: userError } = await this._getUser(currentSession.access_token);
                    if (!userError && (data === null || data === void 0 ? void 0 : data.user)) {
                        currentSession.user = data.user;
                        await this._saveSession(currentSession);
                        await this._notifyAllSubscribers('SIGNED_IN', currentSession);
                    } else {
                        this._debug(debugName, 'could not get user data, skipping SIGNED_IN notification');
                    }
                } catch (getUserError) {
                    console.error('Error getting user data:', getUserError);
                    this._debug(debugName, 'error getting user data, skipping SIGNED_IN notification', getUserError);
                }
            } else {
                // no need to persist currentSession again, as we just loaded it from
                // local storage; persisting it again may overwrite a value saved by
                // another client with access to the same local storage
                await this._notifyAllSubscribers('SIGNED_IN', currentSession);
            }
        } catch (err) {
            this._debug(debugName, 'error', err);
            console.error(err);
            return;
        } finally{
            this._debug(debugName, 'end');
        }
    }
    async _callRefreshToken(refreshToken) {
        var _a, _b;
        if (!refreshToken) {
            throw new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$errors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["AuthSessionMissingError"]();
        }
        // refreshing is already in progress
        if (this.refreshingDeferred) {
            return this.refreshingDeferred.promise;
        }
        const debugName = `#_callRefreshToken(${refreshToken.substring(0, 5)}...)`;
        this._debug(debugName, 'begin');
        try {
            this.refreshingDeferred = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$helpers$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["Deferred"]();
            const { data, error } = await this._refreshAccessToken(refreshToken);
            if (error) throw error;
            if (!data.session) throw new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$errors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["AuthSessionMissingError"]();
            await this._saveSession(data.session);
            await this._notifyAllSubscribers('TOKEN_REFRESHED', data.session);
            const result = {
                data: data.session,
                error: null
            };
            this.refreshingDeferred.resolve(result);
            return result;
        } catch (error) {
            this._debug(debugName, 'error', error);
            if ((0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$errors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["isAuthError"])(error)) {
                const result = {
                    data: null,
                    error
                };
                if (!(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$errors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["isAuthRetryableFetchError"])(error)) {
                    await this._removeSession();
                }
                (_a = this.refreshingDeferred) === null || _a === void 0 ? void 0 : _a.resolve(result);
                return result;
            }
            (_b = this.refreshingDeferred) === null || _b === void 0 ? void 0 : _b.reject(error);
            throw error;
        } finally{
            this.refreshingDeferred = null;
            this._debug(debugName, 'end');
        }
    }
    async _notifyAllSubscribers(event, session, broadcast = true) {
        const debugName = `#_notifyAllSubscribers(${event})`;
        this._debug(debugName, 'begin', session, `broadcast = ${broadcast}`);
        try {
            if (this.broadcastChannel && broadcast) {
                this.broadcastChannel.postMessage({
                    event,
                    session
                });
            }
            const errors = [];
            const promises = Array.from(this.stateChangeEmitters.values()).map(async (x)=>{
                try {
                    await x.callback(event, session);
                } catch (e) {
                    errors.push(e);
                }
            });
            await Promise.all(promises);
            if (errors.length > 0) {
                for(let i = 0; i < errors.length; i += 1){
                    console.error(errors[i]);
                }
                throw errors[0];
            }
        } finally{
            this._debug(debugName, 'end');
        }
    }
    /**
     * set currentSession and currentUser
     * process to _startAutoRefreshToken if possible
     */ async _saveSession(session) {
        this._debug('#_saveSession()', session);
        // _saveSession is always called whenever a new session has been acquired
        // so we can safely suppress the warning returned by future getSession calls
        this.suppressGetSessionWarning = true;
        await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$helpers$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["removeItemAsync"])(this.storage, `${this.storageKey}-code-verifier`);
        // Create a shallow copy to work with, to avoid mutating the original session object if it's used elsewhere
        const sessionToProcess = Object.assign({}, session);
        const userIsProxy = sessionToProcess.user && sessionToProcess.user.__isUserNotAvailableProxy === true;
        if (this.userStorage) {
            if (!userIsProxy && sessionToProcess.user) {
                // If it's a real user object, save it to userStorage.
                await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$helpers$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["setItemAsync"])(this.userStorage, this.storageKey + '-user', {
                    user: sessionToProcess.user
                });
            } else if (userIsProxy) {
            // If it's the proxy, it means user was not found in userStorage.
            // We should ensure no stale user data for this key exists in userStorage if we were to save null,
            // or simply not save the proxy. For now, we don't save the proxy here.
            // If there's a need to clear userStorage if user becomes proxy, that logic would go here.
            }
            // Prepare the main session data for primary storage: remove the user property before cloning
            // This is important because the original session.user might be the proxy
            const mainSessionData = Object.assign({}, sessionToProcess);
            delete mainSessionData.user; // Remove user (real or proxy) before cloning for main storage
            const clonedMainSessionData = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$helpers$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["deepClone"])(mainSessionData);
            await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$helpers$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["setItemAsync"])(this.storage, this.storageKey, clonedMainSessionData);
        } else {
            // No userStorage is configured.
            // In this case, session.user should ideally not be a proxy.
            // If it were, structuredClone would fail. This implies an issue elsewhere if user is a proxy here
            const clonedSession = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$helpers$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["deepClone"])(sessionToProcess); // sessionToProcess still has its original user property
            await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$helpers$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["setItemAsync"])(this.storage, this.storageKey, clonedSession);
        }
    }
    async _removeSession() {
        this._debug('#_removeSession()');
        this.suppressGetSessionWarning = false;
        await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$helpers$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["removeItemAsync"])(this.storage, this.storageKey);
        await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$helpers$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["removeItemAsync"])(this.storage, this.storageKey + '-code-verifier');
        await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$helpers$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["removeItemAsync"])(this.storage, this.storageKey + '-user');
        if (this.userStorage) {
            await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$helpers$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["removeItemAsync"])(this.userStorage, this.storageKey + '-user');
        }
        await this._notifyAllSubscribers('SIGNED_OUT', null);
    }
    /**
     * Removes any registered visibilitychange callback.
     *
     * {@see #startAutoRefresh}
     * {@see #stopAutoRefresh}
     */ _removeVisibilityChangedCallback() {
        this._debug('#_removeVisibilityChangedCallback()');
        const callback = this.visibilityChangedCallback;
        this.visibilityChangedCallback = null;
        try {
            if (callback && (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$helpers$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["isBrowser"])() && (window === null || window === void 0 ? void 0 : window.removeEventListener)) {
                window.removeEventListener('visibilitychange', callback);
            }
        } catch (e) {
            console.error('removing visibilitychange callback failed', e);
        }
    }
    /**
     * This is the private implementation of {@link #startAutoRefresh}. Use this
     * within the library.
     */ async _startAutoRefresh() {
        await this._stopAutoRefresh();
        this._debug('#_startAutoRefresh()');
        const ticker = setInterval(()=>this._autoRefreshTokenTick(), __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$constants$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["AUTO_REFRESH_TICK_DURATION_MS"]);
        this.autoRefreshTicker = ticker;
        if (ticker && typeof ticker === 'object' && typeof ticker.unref === 'function') {
            // ticker is a NodeJS Timeout object that has an `unref` method
            // https://nodejs.org/api/timers.html#timeoutunref
            // When auto refresh is used in NodeJS (like for testing) the
            // `setInterval` is preventing the process from being marked as
            // finished and tests run endlessly. This can be prevented by calling
            // `unref()` on the returned object.
            ticker.unref();
        // @ts-expect-error TS has no context of Deno
        } else if (typeof Deno !== 'undefined' && typeof Deno.unrefTimer === 'function') {
            // similar like for NodeJS, but with the Deno API
            // https://deno.land/api@latest?unstable&s=Deno.unrefTimer
            // @ts-expect-error TS has no context of Deno
            Deno.unrefTimer(ticker);
        }
        // run the tick immediately, but in the next pass of the event loop so that
        // #_initialize can be allowed to complete without recursively waiting on
        // itself
        const timeout = setTimeout(async ()=>{
            await this.initializePromise;
            await this._autoRefreshTokenTick();
        }, 0);
        this.autoRefreshTickTimeout = timeout;
        if (timeout && typeof timeout === 'object' && typeof timeout.unref === 'function') {
            timeout.unref();
        // @ts-expect-error TS has no context of Deno
        } else if (typeof Deno !== 'undefined' && typeof Deno.unrefTimer === 'function') {
            // @ts-expect-error TS has no context of Deno
            Deno.unrefTimer(timeout);
        }
    }
    /**
     * This is the private implementation of {@link #stopAutoRefresh}. Use this
     * within the library.
     */ async _stopAutoRefresh() {
        this._debug('#_stopAutoRefresh()');
        const ticker = this.autoRefreshTicker;
        this.autoRefreshTicker = null;
        if (ticker) {
            clearInterval(ticker);
        }
        const timeout = this.autoRefreshTickTimeout;
        this.autoRefreshTickTimeout = null;
        if (timeout) {
            clearTimeout(timeout);
        }
    }
    /**
     * Starts an auto-refresh process in the background. The session is checked
     * every few seconds. Close to the time of expiration a process is started to
     * refresh the session. If refreshing fails it will be retried for as long as
     * necessary.
     *
     * If you set the {@link GoTrueClientOptions#autoRefreshToken} you don't need
     * to call this function, it will be called for you.
     *
     * On browsers the refresh process works only when the tab/window is in the
     * foreground to conserve resources as well as prevent race conditions and
     * flooding auth with requests. If you call this method any managed
     * visibility change callback will be removed and you must manage visibility
     * changes on your own.
     *
     * On non-browser platforms the refresh process works *continuously* in the
     * background, which may not be desirable. You should hook into your
     * platform's foreground indication mechanism and call these methods
     * appropriately to conserve resources.
     *
     * {@see #stopAutoRefresh}
     */ async startAutoRefresh() {
        this._removeVisibilityChangedCallback();
        await this._startAutoRefresh();
    }
    /**
     * Stops an active auto refresh process running in the background (if any).
     *
     * If you call this method any managed visibility change callback will be
     * removed and you must manage visibility changes on your own.
     *
     * See {@link #startAutoRefresh} for more details.
     */ async stopAutoRefresh() {
        this._removeVisibilityChangedCallback();
        await this._stopAutoRefresh();
    }
    /**
     * Runs the auto refresh token tick.
     */ async _autoRefreshTokenTick() {
        this._debug('#_autoRefreshTokenTick()', 'begin');
        try {
            await this._acquireLock(0, async ()=>{
                try {
                    const now = Date.now();
                    try {
                        return await this._useSession(async (result)=>{
                            const { data: { session } } = result;
                            if (!session || !session.refresh_token || !session.expires_at) {
                                this._debug('#_autoRefreshTokenTick()', 'no session');
                                return;
                            }
                            // session will expire in this many ticks (or has already expired if <= 0)
                            const expiresInTicks = Math.floor((session.expires_at * 1000 - now) / __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$constants$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["AUTO_REFRESH_TICK_DURATION_MS"]);
                            this._debug('#_autoRefreshTokenTick()', `access token expires in ${expiresInTicks} ticks, a tick lasts ${__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$constants$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["AUTO_REFRESH_TICK_DURATION_MS"]}ms, refresh threshold is ${__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$constants$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["AUTO_REFRESH_TICK_THRESHOLD"]} ticks`);
                            if (expiresInTicks <= __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$constants$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["AUTO_REFRESH_TICK_THRESHOLD"]) {
                                await this._callRefreshToken(session.refresh_token);
                            }
                        });
                    } catch (e) {
                        console.error('Auto refresh tick failed with error. This is likely a transient error.', e);
                    }
                } finally{
                    this._debug('#_autoRefreshTokenTick()', 'end');
                }
            });
        } catch (e) {
            if (e.isAcquireTimeout || e instanceof __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$locks$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["LockAcquireTimeoutError"]) {
                this._debug('auto refresh token tick lock not available');
            } else {
                throw e;
            }
        }
    }
    /**
     * Registers callbacks on the browser / platform, which in-turn run
     * algorithms when the browser window/tab are in foreground. On non-browser
     * platforms it assumes always foreground.
     */ async _handleVisibilityChange() {
        this._debug('#_handleVisibilityChange()');
        if (!(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$helpers$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["isBrowser"])() || !(window === null || window === void 0 ? void 0 : window.addEventListener)) {
            if (this.autoRefreshToken) {
                // in non-browser environments the refresh token ticker runs always
                this.startAutoRefresh();
            }
            return false;
        }
        try {
            this.visibilityChangedCallback = async ()=>{
                try {
                    await this._onVisibilityChanged(false);
                } catch (error) {
                    this._debug('#visibilityChangedCallback', 'error', error);
                }
            };
            window === null || window === void 0 ? void 0 : window.addEventListener('visibilitychange', this.visibilityChangedCallback);
            // now immediately call the visbility changed callback to setup with the
            // current visbility state
            await this._onVisibilityChanged(true); // initial call
        } catch (error) {
            console.error('_handleVisibilityChange', error);
        }
    }
    /**
     * Callback registered with `window.addEventListener('visibilitychange')`.
     */ async _onVisibilityChanged(calledFromInitialize) {
        const methodName = `#_onVisibilityChanged(${calledFromInitialize})`;
        this._debug(methodName, 'visibilityState', document.visibilityState);
        if (document.visibilityState === 'visible') {
            if (this.autoRefreshToken) {
                // in browser environments the refresh token ticker runs only on focused tabs
                // which prevents race conditions
                this._startAutoRefresh();
            }
            if (!calledFromInitialize) {
                // called when the visibility has changed, i.e. the browser
                // transitioned from hidden -> visible so we need to see if the session
                // should be recovered immediately... but to do that we need to acquire
                // the lock first asynchronously
                await this.initializePromise;
                await this._acquireLock(this.lockAcquireTimeout, async ()=>{
                    if (document.visibilityState !== 'visible') {
                        this._debug(methodName, 'acquired the lock to recover the session, but the browser visibilityState is no longer visible, aborting');
                        // visibility has changed while waiting for the lock, abort
                        return;
                    }
                    // recover the session
                    await this._recoverAndRefresh();
                });
            }
        } else if (document.visibilityState === 'hidden') {
            if (this.autoRefreshToken) {
                this._stopAutoRefresh();
            }
        }
    }
    /**
     * Generates the relevant login URL for a third-party provider.
     * @param options.redirectTo A URL or mobile address to send the user to after they are confirmed.
     * @param options.scopes A space-separated list of scopes granted to the OAuth application.
     * @param options.queryParams An object of key-value pairs containing query parameters granted to the OAuth application.
     */ async _getUrlForProvider(url, provider, options) {
        const urlParams = [
            `provider=${encodeURIComponent(provider)}`
        ];
        if (options === null || options === void 0 ? void 0 : options.redirectTo) {
            urlParams.push(`redirect_to=${encodeURIComponent(options.redirectTo)}`);
        }
        if (options === null || options === void 0 ? void 0 : options.scopes) {
            urlParams.push(`scopes=${encodeURIComponent(options.scopes)}`);
        }
        if (this.flowType === 'pkce') {
            const [codeChallenge, codeChallengeMethod] = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$helpers$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["getCodeChallengeAndMethod"])(this.storage, this.storageKey);
            const flowParams = new URLSearchParams({
                code_challenge: `${encodeURIComponent(codeChallenge)}`,
                code_challenge_method: `${encodeURIComponent(codeChallengeMethod)}`
            });
            urlParams.push(flowParams.toString());
        }
        if (options === null || options === void 0 ? void 0 : options.queryParams) {
            const query = new URLSearchParams(options.queryParams);
            urlParams.push(query.toString());
        }
        if (options === null || options === void 0 ? void 0 : options.skipBrowserRedirect) {
            urlParams.push(`skip_http_redirect=${options.skipBrowserRedirect}`);
        }
        return `${url}?${urlParams.join('&')}`;
    }
    async _unenroll(params) {
        try {
            return await this._useSession(async (result)=>{
                var _a;
                const { data: sessionData, error: sessionError } = result;
                if (sessionError) {
                    return this._returnResult({
                        data: null,
                        error: sessionError
                    });
                }
                return await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$fetch$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["_request"])(this.fetch, 'DELETE', `${this.url}/factors/${params.factorId}`, {
                    headers: this.headers,
                    jwt: (_a = sessionData === null || sessionData === void 0 ? void 0 : sessionData.session) === null || _a === void 0 ? void 0 : _a.access_token
                });
            });
        } catch (error) {
            if ((0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$errors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["isAuthError"])(error)) {
                return this._returnResult({
                    data: null,
                    error
                });
            }
            throw error;
        }
    }
    async _enroll(params) {
        try {
            return await this._useSession(async (result)=>{
                var _a, _b;
                const { data: sessionData, error: sessionError } = result;
                if (sessionError) {
                    return this._returnResult({
                        data: null,
                        error: sessionError
                    });
                }
                const body = Object.assign({
                    friendly_name: params.friendlyName,
                    factor_type: params.factorType
                }, params.factorType === 'phone' ? {
                    phone: params.phone
                } : params.factorType === 'totp' ? {
                    issuer: params.issuer
                } : {});
                const { data, error } = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$fetch$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["_request"])(this.fetch, 'POST', `${this.url}/factors`, {
                    body,
                    headers: this.headers,
                    jwt: (_a = sessionData === null || sessionData === void 0 ? void 0 : sessionData.session) === null || _a === void 0 ? void 0 : _a.access_token
                });
                if (error) {
                    return this._returnResult({
                        data: null,
                        error
                    });
                }
                if (params.factorType === 'totp' && data.type === 'totp' && ((_b = data === null || data === void 0 ? void 0 : data.totp) === null || _b === void 0 ? void 0 : _b.qr_code)) {
                    data.totp.qr_code = `data:image/svg+xml;utf-8,${data.totp.qr_code}`;
                }
                return this._returnResult({
                    data,
                    error: null
                });
            });
        } catch (error) {
            if ((0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$errors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["isAuthError"])(error)) {
                return this._returnResult({
                    data: null,
                    error
                });
            }
            throw error;
        }
    }
    async _verify(params) {
        return this._acquireLock(this.lockAcquireTimeout, async ()=>{
            try {
                return await this._useSession(async (result)=>{
                    var _a;
                    const { data: sessionData, error: sessionError } = result;
                    if (sessionError) {
                        return this._returnResult({
                            data: null,
                            error: sessionError
                        });
                    }
                    const body = Object.assign({
                        challenge_id: params.challengeId
                    }, 'webauthn' in params ? {
                        webauthn: Object.assign(Object.assign({}, params.webauthn), {
                            credential_response: params.webauthn.type === 'create' ? (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$webauthn$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__$3c$locals$3e$__["serializeCredentialCreationResponse"])(params.webauthn.credential_response) : (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$webauthn$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__$3c$locals$3e$__["serializeCredentialRequestResponse"])(params.webauthn.credential_response)
                        })
                    } : {
                        code: params.code
                    });
                    const { data, error } = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$fetch$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["_request"])(this.fetch, 'POST', `${this.url}/factors/${params.factorId}/verify`, {
                        body,
                        headers: this.headers,
                        jwt: (_a = sessionData === null || sessionData === void 0 ? void 0 : sessionData.session) === null || _a === void 0 ? void 0 : _a.access_token
                    });
                    if (error) {
                        return this._returnResult({
                            data: null,
                            error
                        });
                    }
                    await this._saveSession(Object.assign({
                        expires_at: Math.round(Date.now() / 1000) + data.expires_in
                    }, data));
                    await this._notifyAllSubscribers('MFA_CHALLENGE_VERIFIED', data);
                    return this._returnResult({
                        data,
                        error
                    });
                });
            } catch (error) {
                if ((0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$errors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["isAuthError"])(error)) {
                    return this._returnResult({
                        data: null,
                        error
                    });
                }
                throw error;
            }
        });
    }
    async _challenge(params) {
        return this._acquireLock(this.lockAcquireTimeout, async ()=>{
            try {
                return await this._useSession(async (result)=>{
                    var _a;
                    const { data: sessionData, error: sessionError } = result;
                    if (sessionError) {
                        return this._returnResult({
                            data: null,
                            error: sessionError
                        });
                    }
                    const response = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$fetch$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["_request"])(this.fetch, 'POST', `${this.url}/factors/${params.factorId}/challenge`, {
                        body: params,
                        headers: this.headers,
                        jwt: (_a = sessionData === null || sessionData === void 0 ? void 0 : sessionData.session) === null || _a === void 0 ? void 0 : _a.access_token
                    });
                    if (response.error) {
                        return response;
                    }
                    const { data } = response;
                    if (data.type !== 'webauthn') {
                        return {
                            data,
                            error: null
                        };
                    }
                    switch(data.webauthn.type){
                        case 'create':
                            return {
                                data: Object.assign(Object.assign({}, data), {
                                    webauthn: Object.assign(Object.assign({}, data.webauthn), {
                                        credential_options: Object.assign(Object.assign({}, data.webauthn.credential_options), {
                                            publicKey: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$webauthn$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__$3c$locals$3e$__["deserializeCredentialCreationOptions"])(data.webauthn.credential_options.publicKey)
                                        })
                                    })
                                }),
                                error: null
                            };
                        case 'request':
                            return {
                                data: Object.assign(Object.assign({}, data), {
                                    webauthn: Object.assign(Object.assign({}, data.webauthn), {
                                        credential_options: Object.assign(Object.assign({}, data.webauthn.credential_options), {
                                            publicKey: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$webauthn$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__$3c$locals$3e$__["deserializeCredentialRequestOptions"])(data.webauthn.credential_options.publicKey)
                                        })
                                    })
                                }),
                                error: null
                            };
                    }
                });
            } catch (error) {
                if ((0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$errors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["isAuthError"])(error)) {
                    return this._returnResult({
                        data: null,
                        error
                    });
                }
                throw error;
            }
        });
    }
    /**
     * {@see GoTrueMFAApi#challengeAndVerify}
     */ async _challengeAndVerify(params) {
        // both _challenge and _verify independently acquire the lock, so no need
        // to acquire it here
        const { data: challengeData, error: challengeError } = await this._challenge({
            factorId: params.factorId
        });
        if (challengeError) {
            return this._returnResult({
                data: null,
                error: challengeError
            });
        }
        return await this._verify({
            factorId: params.factorId,
            challengeId: challengeData.id,
            code: params.code
        });
    }
    /**
     * {@see GoTrueMFAApi#listFactors}
     */ async _listFactors() {
        var _a;
        // use #getUser instead of #_getUser as the former acquires a lock
        const { data: { user }, error: userError } = await this.getUser();
        if (userError) {
            return {
                data: null,
                error: userError
            };
        }
        const data = {
            all: [],
            phone: [],
            totp: [],
            webauthn: []
        };
        // loop over the factors ONCE
        for (const factor of (_a = user === null || user === void 0 ? void 0 : user.factors) !== null && _a !== void 0 ? _a : []){
            data.all.push(factor);
            if (factor.status === 'verified') {
                ;
                data[factor.factor_type].push(factor);
            }
        }
        return {
            data,
            error: null
        };
    }
    /**
     * {@see GoTrueMFAApi#getAuthenticatorAssuranceLevel}
     */ async _getAuthenticatorAssuranceLevel(jwt) {
        var _a, _b, _c, _d;
        if (jwt) {
            try {
                const { payload } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$helpers$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["decodeJWT"])(jwt);
                let currentLevel = null;
                if (payload.aal) {
                    currentLevel = payload.aal;
                }
                let nextLevel = currentLevel;
                const { data: { user }, error: userError } = await this.getUser(jwt);
                if (userError) {
                    return this._returnResult({
                        data: null,
                        error: userError
                    });
                }
                const verifiedFactors = (_b = (_a = user === null || user === void 0 ? void 0 : user.factors) === null || _a === void 0 ? void 0 : _a.filter((factor)=>factor.status === 'verified')) !== null && _b !== void 0 ? _b : [];
                if (verifiedFactors.length > 0) {
                    nextLevel = 'aal2';
                }
                const currentAuthenticationMethods = payload.amr || [];
                return {
                    data: {
                        currentLevel,
                        nextLevel,
                        currentAuthenticationMethods
                    },
                    error: null
                };
            } catch (error) {
                if ((0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$errors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["isAuthError"])(error)) {
                    return this._returnResult({
                        data: null,
                        error
                    });
                }
                throw error;
            }
        }
        const { data: { session }, error: sessionError } = await this.getSession();
        if (sessionError) {
            return this._returnResult({
                data: null,
                error: sessionError
            });
        }
        if (!session) {
            return {
                data: {
                    currentLevel: null,
                    nextLevel: null,
                    currentAuthenticationMethods: []
                },
                error: null
            };
        }
        const { payload } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$helpers$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["decodeJWT"])(session.access_token);
        let currentLevel = null;
        if (payload.aal) {
            currentLevel = payload.aal;
        }
        let nextLevel = currentLevel;
        const verifiedFactors = (_d = (_c = session.user.factors) === null || _c === void 0 ? void 0 : _c.filter((factor)=>factor.status === 'verified')) !== null && _d !== void 0 ? _d : [];
        if (verifiedFactors.length > 0) {
            nextLevel = 'aal2';
        }
        const currentAuthenticationMethods = payload.amr || [];
        return {
            data: {
                currentLevel,
                nextLevel,
                currentAuthenticationMethods
            },
            error: null
        };
    }
    /**
     * Retrieves details about an OAuth authorization request.
     * Only relevant when the OAuth 2.1 server is enabled in Supabase Auth.
     *
     * Returns authorization details including client info, scopes, and user information.
     * If the response includes only a redirect_url field, it means consent was already given - the caller
     * should handle the redirect manually if needed.
     */ async _getAuthorizationDetails(authorizationId) {
        try {
            return await this._useSession(async (result)=>{
                const { data: { session }, error: sessionError } = result;
                if (sessionError) {
                    return this._returnResult({
                        data: null,
                        error: sessionError
                    });
                }
                if (!session) {
                    return this._returnResult({
                        data: null,
                        error: new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$errors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["AuthSessionMissingError"]()
                    });
                }
                return await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$fetch$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["_request"])(this.fetch, 'GET', `${this.url}/oauth/authorizations/${authorizationId}`, {
                    headers: this.headers,
                    jwt: session.access_token,
                    xform: (data)=>({
                            data,
                            error: null
                        })
                });
            });
        } catch (error) {
            if ((0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$errors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["isAuthError"])(error)) {
                return this._returnResult({
                    data: null,
                    error
                });
            }
            throw error;
        }
    }
    /**
     * Approves an OAuth authorization request.
     * Only relevant when the OAuth 2.1 server is enabled in Supabase Auth.
     */ async _approveAuthorization(authorizationId, options) {
        try {
            return await this._useSession(async (result)=>{
                const { data: { session }, error: sessionError } = result;
                if (sessionError) {
                    return this._returnResult({
                        data: null,
                        error: sessionError
                    });
                }
                if (!session) {
                    return this._returnResult({
                        data: null,
                        error: new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$errors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["AuthSessionMissingError"]()
                    });
                }
                const response = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$fetch$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["_request"])(this.fetch, 'POST', `${this.url}/oauth/authorizations/${authorizationId}/consent`, {
                    headers: this.headers,
                    jwt: session.access_token,
                    body: {
                        action: 'approve'
                    },
                    xform: (data)=>({
                            data,
                            error: null
                        })
                });
                if (response.data && response.data.redirect_url) {
                    // Automatically redirect in browser unless skipBrowserRedirect is true
                    if ((0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$helpers$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["isBrowser"])() && !(options === null || options === void 0 ? void 0 : options.skipBrowserRedirect)) {
                        window.location.assign(response.data.redirect_url);
                    }
                }
                return response;
            });
        } catch (error) {
            if ((0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$errors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["isAuthError"])(error)) {
                return this._returnResult({
                    data: null,
                    error
                });
            }
            throw error;
        }
    }
    /**
     * Denies an OAuth authorization request.
     * Only relevant when the OAuth 2.1 server is enabled in Supabase Auth.
     */ async _denyAuthorization(authorizationId, options) {
        try {
            return await this._useSession(async (result)=>{
                const { data: { session }, error: sessionError } = result;
                if (sessionError) {
                    return this._returnResult({
                        data: null,
                        error: sessionError
                    });
                }
                if (!session) {
                    return this._returnResult({
                        data: null,
                        error: new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$errors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["AuthSessionMissingError"]()
                    });
                }
                const response = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$fetch$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["_request"])(this.fetch, 'POST', `${this.url}/oauth/authorizations/${authorizationId}/consent`, {
                    headers: this.headers,
                    jwt: session.access_token,
                    body: {
                        action: 'deny'
                    },
                    xform: (data)=>({
                            data,
                            error: null
                        })
                });
                if (response.data && response.data.redirect_url) {
                    // Automatically redirect in browser unless skipBrowserRedirect is true
                    if ((0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$helpers$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["isBrowser"])() && !(options === null || options === void 0 ? void 0 : options.skipBrowserRedirect)) {
                        window.location.assign(response.data.redirect_url);
                    }
                }
                return response;
            });
        } catch (error) {
            if ((0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$errors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["isAuthError"])(error)) {
                return this._returnResult({
                    data: null,
                    error
                });
            }
            throw error;
        }
    }
    /**
     * Lists all OAuth grants that the authenticated user has authorized.
     * Only relevant when the OAuth 2.1 server is enabled in Supabase Auth.
     */ async _listOAuthGrants() {
        try {
            return await this._useSession(async (result)=>{
                const { data: { session }, error: sessionError } = result;
                if (sessionError) {
                    return this._returnResult({
                        data: null,
                        error: sessionError
                    });
                }
                if (!session) {
                    return this._returnResult({
                        data: null,
                        error: new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$errors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["AuthSessionMissingError"]()
                    });
                }
                return await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$fetch$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["_request"])(this.fetch, 'GET', `${this.url}/user/oauth/grants`, {
                    headers: this.headers,
                    jwt: session.access_token,
                    xform: (data)=>({
                            data,
                            error: null
                        })
                });
            });
        } catch (error) {
            if ((0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$errors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["isAuthError"])(error)) {
                return this._returnResult({
                    data: null,
                    error
                });
            }
            throw error;
        }
    }
    /**
     * Revokes a user's OAuth grant for a specific client.
     * Only relevant when the OAuth 2.1 server is enabled in Supabase Auth.
     */ async _revokeOAuthGrant(options) {
        try {
            return await this._useSession(async (result)=>{
                const { data: { session }, error: sessionError } = result;
                if (sessionError) {
                    return this._returnResult({
                        data: null,
                        error: sessionError
                    });
                }
                if (!session) {
                    return this._returnResult({
                        data: null,
                        error: new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$errors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["AuthSessionMissingError"]()
                    });
                }
                await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$fetch$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["_request"])(this.fetch, 'DELETE', `${this.url}/user/oauth/grants`, {
                    headers: this.headers,
                    jwt: session.access_token,
                    query: {
                        client_id: options.clientId
                    },
                    noResolveJson: true
                });
                return {
                    data: {},
                    error: null
                };
            });
        } catch (error) {
            if ((0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$errors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["isAuthError"])(error)) {
                return this._returnResult({
                    data: null,
                    error
                });
            }
            throw error;
        }
    }
    async fetchJwk(kid, jwks = {
        keys: []
    }) {
        // try fetching from the supplied jwks
        let jwk = jwks.keys.find((key)=>key.kid === kid);
        if (jwk) {
            return jwk;
        }
        const now = Date.now();
        // try fetching from cache
        jwk = this.jwks.keys.find((key)=>key.kid === kid);
        // jwk exists and jwks isn't stale
        if (jwk && this.jwks_cached_at + __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$constants$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["JWKS_TTL"] > now) {
            return jwk;
        }
        // jwk isn't cached in memory so we need to fetch it from the well-known endpoint
        const { data, error } = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$fetch$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["_request"])(this.fetch, 'GET', `${this.url}/.well-known/jwks.json`, {
            headers: this.headers
        });
        if (error) {
            throw error;
        }
        if (!data.keys || data.keys.length === 0) {
            return null;
        }
        this.jwks = data;
        this.jwks_cached_at = now;
        // Find the signing key
        jwk = data.keys.find((key)=>key.kid === kid);
        if (!jwk) {
            return null;
        }
        return jwk;
    }
    /**
     * Extracts the JWT claims present in the access token by first verifying the
     * JWT against the server's JSON Web Key Set endpoint
     * `/.well-known/jwks.json` which is often cached, resulting in significantly
     * faster responses. Prefer this method over {@link #getUser} which always
     * sends a request to the Auth server for each JWT.
     *
     * If the project is not using an asymmetric JWT signing key (like ECC or
     * RSA) it always sends a request to the Auth server (similar to {@link
     * #getUser}) to verify the JWT.
     *
     * @param jwt An optional specific JWT you wish to verify, not the one you
     *            can obtain from {@link #getSession}.
     * @param options Various additional options that allow you to customize the
     *                behavior of this method.
     */ async getClaims(jwt, options = {}) {
        try {
            let token = jwt;
            if (!token) {
                const { data, error } = await this.getSession();
                if (error || !data.session) {
                    return this._returnResult({
                        data: null,
                        error
                    });
                }
                token = data.session.access_token;
            }
            const { header, payload, signature, raw: { header: rawHeader, payload: rawPayload } } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$helpers$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["decodeJWT"])(token);
            if (!(options === null || options === void 0 ? void 0 : options.allowExpired)) {
                // Reject expired JWTs should only happen if jwt argument was passed
                (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$helpers$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["validateExp"])(payload.exp);
            }
            const signingKey = !header.alg || header.alg.startsWith('HS') || !header.kid || !('crypto' in globalThis && 'subtle' in globalThis.crypto) ? null : await this.fetchJwk(header.kid, (options === null || options === void 0 ? void 0 : options.keys) ? {
                keys: options.keys
            } : options === null || options === void 0 ? void 0 : options.jwks);
            // If symmetric algorithm or WebCrypto API is unavailable, fallback to getUser()
            if (!signingKey) {
                const { error } = await this.getUser(token);
                if (error) {
                    throw error;
                }
                // getUser succeeds so the claims in the JWT can be trusted
                return {
                    data: {
                        claims: payload,
                        header,
                        signature
                    },
                    error: null
                };
            }
            const algorithm = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$helpers$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["getAlgorithm"])(header.alg);
            // Convert JWK to CryptoKey
            const publicKey = await crypto.subtle.importKey('jwk', signingKey, algorithm, true, [
                'verify'
            ]);
            // Verify the signature
            const isValid = await crypto.subtle.verify(algorithm, publicKey, signature, (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$base64url$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["stringToUint8Array"])(`${rawHeader}.${rawPayload}`));
            if (!isValid) {
                throw new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$errors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["AuthInvalidJwtError"]('Invalid JWT signature');
            }
            // If verification succeeds, decode and return claims
            return {
                data: {
                    claims: payload,
                    header,
                    signature
                },
                error: null
            };
        } catch (error) {
            if ((0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$errors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["isAuthError"])(error)) {
                return this._returnResult({
                    data: null,
                    error
                });
            }
            throw error;
        }
    }
}
GoTrueClient.nextInstanceID = {};
const __TURBOPACK__default__export__ = GoTrueClient;
 //# sourceMappingURL=GoTrueClient.js.map
}),
"[project]/node_modules/.bun/@supabase+auth-js@2.95.3/node_modules/@supabase/auth-js/dist/module/AuthAdminApi.js [middleware] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>__TURBOPACK__default__export__
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$GoTrueAdminApi$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.bun/@supabase+auth-js@2.95.3/node_modules/@supabase/auth-js/dist/module/GoTrueAdminApi.js [middleware] (ecmascript)");
;
const AuthAdminApi = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$GoTrueAdminApi$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["default"];
const __TURBOPACK__default__export__ = AuthAdminApi;
 //# sourceMappingURL=AuthAdminApi.js.map
}),
"[project]/node_modules/.bun/@supabase+auth-js@2.95.3/node_modules/@supabase/auth-js/dist/module/AuthClient.js [middleware] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>__TURBOPACK__default__export__
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$GoTrueClient$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.bun/@supabase+auth-js@2.95.3/node_modules/@supabase/auth-js/dist/module/GoTrueClient.js [middleware] (ecmascript)");
;
const AuthClient = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$GoTrueClient$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["default"];
const __TURBOPACK__default__export__ = AuthClient;
 //# sourceMappingURL=AuthClient.js.map
}),
"[project]/node_modules/.bun/@supabase+auth-js@2.95.3/node_modules/@supabase/auth-js/dist/module/index.js [middleware] (ecmascript) <locals>", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$GoTrueAdminApi$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.bun/@supabase+auth-js@2.95.3/node_modules/@supabase/auth-js/dist/module/GoTrueAdminApi.js [middleware] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$GoTrueClient$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.bun/@supabase+auth-js@2.95.3/node_modules/@supabase/auth-js/dist/module/GoTrueClient.js [middleware] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$AuthAdminApi$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.bun/@supabase+auth-js@2.95.3/node_modules/@supabase/auth-js/dist/module/AuthAdminApi.js [middleware] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$AuthClient$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.bun/@supabase+auth-js@2.95.3/node_modules/@supabase/auth-js/dist/module/AuthClient.js [middleware] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$types$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.bun/@supabase+auth-js@2.95.3/node_modules/@supabase/auth-js/dist/module/lib/types.js [middleware] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$errors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.bun/@supabase+auth-js@2.95.3/node_modules/@supabase/auth-js/dist/module/lib/errors.js [middleware] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$locks$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.bun/@supabase+auth-js@2.95.3/node_modules/@supabase/auth-js/dist/module/lib/locks.js [middleware] (ecmascript)"); //# sourceMappingURL=index.js.map
;
;
;
;
;
;
;
;
}),
"[project]/node_modules/.bun/@supabase+auth-js@2.95.3/node_modules/@supabase/auth-js/dist/module/AuthClient.js [middleware] (ecmascript) <export default as AuthClient>", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "AuthClient",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$AuthClient$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["default"]
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$bun$2f40$supabase$2b$auth$2d$js$40$2$2e$95$2e$3$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$AuthClient$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.bun/@supabase+auth-js@2.95.3/node_modules/@supabase/auth-js/dist/module/AuthClient.js [middleware] (ecmascript)");
}),
];

//# sourceMappingURL=f5c73_%40supabase_auth-js_dist_module_23850b0e._.js.map