export type ErrorCategory = 'network' | 'auth' | 'gameplay' | 'server';

export interface UserFriendlyError {
    message: string;
    description?: string;
    icon?: string;
}

const ERROR_MAP: Record<string | number, UserFriendlyError> = {
    // HTTP Status Codes
    401: {
        message: "Session Expired",
        description: "Please log in again to continue your adventure.",
    },
    403: {
        message: "Access Denied",
        description: "You're not allowed in this part of the arena!",
    },
    404: {
        message: "Not Found",
        description: "We couldn't find what you were looking for.",
    },
    429: {
        message: "Slow Down!",
        description: "You're moving faster than the candies! Please wait a moment.",
    },
    500: {
        message: "Arena Maintenance",
        description: "Our server had a bit of a tumble. We're getting it back up!",
    },

    // Internal Codes (Axios/Internal)
    'ECONNABORTED': {
        message: "Connection Timeout",
        description: "The arena is taking too long to respond. Check your internet!",
    },
    'NETWORK_ERROR': {
        message: "Can't Reach Arena",
        description: "Please check your internet connection and try again.",
    },

    // Custom Backend Codes
    'INTERNAL_SERVER_ERROR': {
        message: "Something went wrong",
        description: "The arena had a little tumble, but we're fixing it!",
    }
};

export const getFriendlyError = (error: any): UserFriendlyError => {
    // 1. Check for axios dynamic error code (ECONNABORTED etc)
    if (error.code && ERROR_MAP[error.code]) {
        return ERROR_MAP[error.code];
    }

    // 2. Check for network error (no response)
    if (!error.response) {
        return ERROR_MAP['NETWORK_ERROR'];
    }

    // 3. Check for specific backend code in response
    const backendCode = error.response.data?.error_code;
    if (backendCode && ERROR_MAP[backendCode]) {
        return ERROR_MAP[backendCode];
    }

    // 4. Fallback to status code
    const status = error.response.status;
    if (status && ERROR_MAP[status]) {
        return ERROR_MAP[status];
    }

    // Final Fallback
    return {
        message: "Unexpected Glitch",
        description: "Something unexpected happened. Please try again later.",
    };
};
