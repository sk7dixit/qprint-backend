
export const validPaymentTransitions = {
    PENDING_PAYMENT: ["PAID", "CANCELLED"],
    PAID: [],
    FAILED: [],
    CANCELLED: []
};

// Added PROCESSING_PAYMENT to support the controller flow
export const validPrintTransitions = {
    CREATED: ["PENDING_PAYMENT"],
    PENDING_PAYMENT: ["QUEUED", "PROCESSING_PAYMENT"],
    PROCESSING_PAYMENT: ["QUEUED"],
    QUEUED: ["PRINTING", "CANCELLED"],
    PRINTING: ["COMPLETED"],
    COMPLETED: [],
    CANCELLED: []
};

export function isValidTransition(current, next, map) {
    if (!map[current]) return false;
    return map[current].includes(next);
}
