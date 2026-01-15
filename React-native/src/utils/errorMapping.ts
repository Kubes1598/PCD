/**
 * Error Mapping - Frontend Production Ready
 * 
 * Maps backend error codes to user-friendly messages.
 * NEVER show technical errors to users!
 */

export type ErrorCategory = 'network' | 'auth' | 'gameplay' | 'server' | 'validation';

export interface UserFriendlyError {
    message: string;
    description?: string;
    icon?: string;
    errorCode?: string;
}

/**
 * Backend Error Codes → User-Friendly Messages
 * These codes match the backend error_codes.py
 */
const BACKEND_ERROR_MESSAGES: Record<string, UserFriendlyError> = {
    // Authentication Errors (1xxx)
    'AUTH_1001': {
        message: "Wrong Credentials",
        description: "Invalid email or password. Please try again.",
    },
    'AUTH_1002': {
        message: "Session Expired",
        description: "Please log in again to continue playing.",
    },
    'AUTH_1003': {
        message: "Session Invalid",
        description: "Please log in again.",
    },
    'AUTH_1004': {
        message: "Email Taken",
        description: "This email is already registered. Try logging in!",
    },
    'AUTH_1005': {
        message: "Username Taken",
        description: "This username is already taken. Try another!",
    },
    'AUTH_1006': {
        message: "Weak Password",
        description: "Password needs uppercase, lowercase, and numbers.",
    },
    'AUTH_1007': {
        message: "Invalid Email",
        description: "Please enter a valid email address.",
    },
    'AUTH_1008': {
        message: "Login Required",
        description: "Please log in to continue.",
    },

    // Game Errors (2xxx)
    'GAME_2001': {
        message: "Game Not Found",
        description: "This game may have ended or expired.",
    },
    'GAME_2002': {
        message: "Wait Your Turn!",
        description: "It's not your turn yet. Patience!",
    },
    'GAME_2003': {
        message: "Invalid Selection",
        description: "Please pick a valid candy.",
    },
    'GAME_2004': {
        message: "Game Over",
        description: "This game has already ended.",
    },
    'GAME_2005': {
        message: "Poison Already Set",
        description: "You've already chosen your poison candy!",
    },
    'GAME_2006': {
        message: "Invalid Action",
        description: "You can't do that right now.",
    },
    'GAME_2007': {
        message: "Not Your Game",
        description: "You're not a player in this game.",
    },
    'GAME_2008': {
        message: "Candy Unavailable",
        description: "This candy has already been picked.",
    },

    // Matchmaking Errors (3xxx)
    'MATCH_3001': {
        message: "Not Enough Coins!",
        description: "You need more coins to enter this arena.",
    },
    'MATCH_3002': {
        message: "Already Searching",
        description: "You're already looking for a match!",
    },
    'MATCH_3003': {
        message: "Invalid Arena",
        description: "Please select a valid arena.",
    },
    'MATCH_3004': {
        message: "No Match Found",
        description: "Couldn't find an opponent. Try again!",
    },

    // Rate Limiting (4xxx)
    'RATE_4001': {
        message: "Slow Down!",
        description: "You're clicking too fast. Take a breath!",
    },
    'RATE_4002': {
        message: "Too Many Requests",
        description: "Please wait a moment before trying again.",
    },

    // Validation Errors
    'VALID_4200': {
        message: "Invalid Input",
        description: "Please check your input and try again.",
    },
    'VALIDATION_ERROR': {
        message: "Invalid Input",
        description: "Please check your input and try again.",
    },

    // Server Errors (5xxx)
    'SERVER_5001': {
        message: "Something Went Wrong",
        description: "Our team has been notified. Try again!",
    },
    'SERVER_5002': {
        message: "Save Error",
        description: "Couldn't save your data. Please try again.",
    },
    'SERVER_5003': {
        message: "Temporary Issue",
        description: "Please try again in a moment.",
    },
    'SERVER_5004': {
        message: "Service Unavailable",
        description: "The arena is temporarily down for maintenance.",
    },
};

/**
 * HTTP Status Code → User-Friendly Messages
 */
const HTTP_ERROR_MESSAGES: Record<number, UserFriendlyError> = {
    400: {
        message: "Invalid Request",
        description: "Something was wrong with your request.",
    },
    401: {
        message: "Session Expired",
        description: "Please log in again to continue.",
    },
    403: {
        message: "Access Denied",
        description: "You're not allowed to do that.",
    },
    404: {
        message: "Not Found",
        description: "We couldn't find what you were looking for.",
    },
    422: {
        message: "Invalid Input",
        description: "Please check your input and try again.",
    },
    429: {
        message: "Slow Down!",
        description: "You're moving too fast! Please wait a moment.",
    },
    500: {
        message: "Server Error",
        description: "Something went wrong. We're working on it!",
    },
    502: {
        message: "Server Unavailable",
        description: "The arena is having issues. Try again soon!",
    },
    503: {
        message: "Maintenance",
        description: "The arena is temporarily under maintenance.",
    },
};

/**
 * Network/Axios Error Codes → User-Friendly Messages
 */
const NETWORK_ERROR_MESSAGES: Record<string, UserFriendlyError> = {
    'ECONNABORTED': {
        message: "Connection Timeout",
        description: "The connection took too long. Check your internet!",
    },
    'ENOTFOUND': {
        message: "Can't Reach Server",
        description: "Please check your internet connection.",
    },
    'NETWORK_ERROR': {
        message: "No Connection",
        description: "Please check your internet and try again.",
    },
    'ERR_NETWORK': {
        message: "No Connection",
        description: "Please check your internet and try again.",
    },
};

/**
 * Get user-friendly error message from any error.
 * 
 * Priority:
 * 1. Backend error_code in response
 * 2. Backend message in response (if user-friendly)
 * 3. Axios/network error codes
 * 4. HTTP status codes
 * 5. Generic fallback
 */
export const getFriendlyError = (error: any): UserFriendlyError => {
    // 1. Check for backend error_code in response
    const backendCode = error?.response?.data?.error_code;
    if (backendCode && BACKEND_ERROR_MESSAGES[backendCode]) {
        return {
            ...BACKEND_ERROR_MESSAGES[backendCode],
            errorCode: backendCode
        };
    }

    // 2. Check if backend sent a user-friendly message directly
    const backendMessage = error?.response?.data?.message;
    if (backendMessage && typeof backendMessage === 'string' && backendMessage.length < 200) {
        // Don't use if it looks like a technical error
        const technicalPatterns = ['error', 'exception', 'traceback', 'null', 'undefined', 'NaN'];
        const isTechnical = technicalPatterns.some(p => backendMessage.toLowerCase().includes(p));

        if (!isTechnical) {
            return {
                message: backendMessage,
                errorCode: backendCode
            };
        }
    }

    // 3. Check for Axios/network error codes (ECONNABORTED, etc.)
    if (error?.code && NETWORK_ERROR_MESSAGES[error.code]) {
        return NETWORK_ERROR_MESSAGES[error.code];
    }

    // 4. Check for network error (no response at all)
    if (!error?.response) {
        if (error?.message?.toLowerCase().includes('network')) {
            return NETWORK_ERROR_MESSAGES['NETWORK_ERROR'];
        }
        return NETWORK_ERROR_MESSAGES['ERR_NETWORK'];
    }

    // 5. Fallback to HTTP status code
    const status = error?.response?.status;
    if (status && HTTP_ERROR_MESSAGES[status]) {
        return {
            ...HTTP_ERROR_MESSAGES[status],
            errorCode: `HTTP_${status}`
        };
    }

    // 6. Final fallback
    return {
        message: "Unexpected Error",
        description: "Something went wrong. Please try again.",
        errorCode: "UNKNOWN"
    };
};

/**
 * Check if error requires re-authentication
 */
export const isAuthError = (error: any): boolean => {
    const status = error?.response?.status;
    const code = error?.response?.data?.error_code;

    return (
        status === 401 ||
        code === 'AUTH_1002' ||
        code === 'AUTH_1003' ||
        code === 'AUTH_1008'
    );
};

/**
 * Check if error is a rate limit error
 */
export const isRateLimitError = (error: any): boolean => {
    const status = error?.response?.status;
    const code = error?.response?.data?.error_code;

    return status === 429 || code === 'RATE_4001' || code === 'RATE_4002';
};
