/**
 * Wraps a promise with a timeout.
 * @param {Promise} promise - The promise to wrap.
 * @param {number} ms - Timeout in milliseconds.
 * @param {string} label - Optional label for the error message.
 * @returns {Promise}
 */
export const withTimeout = (promise, ms, label = "Operation") => {
    let timeoutId;
    const timeoutPromise = new Promise((_, reject) => {
        timeoutId = setTimeout(() => {
            reject(new Error(`${label} timed out after ${ms}ms`));
        }, ms);
    });

    return Promise.race([
        promise.then((res) => {
            clearTimeout(timeoutId);
            return res;
        }),
        timeoutPromise
    ]);
};
