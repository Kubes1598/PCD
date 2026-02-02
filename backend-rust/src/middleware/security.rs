//! Security headers middleware

use axum::{
    body::Body,
    http::{header, Request, Response},
    middleware::Next,
};

/// Add security headers to all responses
pub async fn security_headers(
    request: Request<Body>,
    next: Next,
) -> Response<Body> {
    let mut response = next.run(request).await;
    
    let headers = response.headers_mut();

    // Prevent XSS attacks
    headers.insert(
        header::X_CONTENT_TYPE_OPTIONS,
        "nosniff".parse().unwrap(),
    );

    // Prevent clickjacking
    headers.insert(
        header::X_FRAME_OPTIONS,
        "DENY".parse().unwrap(),
    );

    // Enable XSS filter
    headers.insert(
        "X-XSS-Protection",
        "1; mode=block".parse().unwrap(),
    );

    // Referrer policy
    headers.insert(
        header::REFERRER_POLICY,
        "strict-origin-when-cross-origin".parse().unwrap(),
    );

    // Content Security Policy
    headers.insert(
        header::CONTENT_SECURITY_POLICY,
        "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'".parse().unwrap(),
    );

    // Strict Transport Security (HTTPS only)
    headers.insert(
        header::STRICT_TRANSPORT_SECURITY,
        "max-age=31536000; includeSubDomains".parse().unwrap(),
    );

    // Permissions Policy
    headers.insert(
        "Permissions-Policy",
        "camera=(), microphone=(), geolocation=()".parse().unwrap(),
    );

    response
}
