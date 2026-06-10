---
name: build-secure-php74
description: Build, modify, debug, or review production PHP 7.4 applications with secure defaults. Use for PHP features, forms, authentication, sessions, database access, file uploads, access control, security headers, logging, error handling, or security reviews where OWASP-aligned implementation and PHP 7.4 compatibility are required.
---

# Build Secure PHP 7.4

Implement the requested behavior completely while preserving the repository's architecture. Apply security controls where the affected trust boundary requires them, and keep all code compatible with PHP 7.4.

## Workflow

1. Read the nearest `AGENTS.md`, configuration, entry points, and affected modules.
2. Trace request inputs, authorization decisions, persistence, file access, output rendering, logging, and error paths.
3. Reuse existing patterns and helpers. Separate configuration, authentication, business logic, persistence, and presentation.
4. Implement the smallest complete change. Do not add unrelated infrastructure or refactor unrelated code.
5. Review the affected trust boundaries using the checklist below.
6. Run the repository's tests and PHP syntax checks for every changed PHP file.
7. Report changed behavior, verification performed, and any residual risk.

## PHP 7.4 Compatibility

- Use syntax and standard-library APIs available in PHP 7.4.
- Do not use attributes, enums, union or intersection types, constructor property promotion, named arguments, `match`, nullsafe operators, fibers, or other PHP 8+ features.
- Use `declare(strict_types=1);` when consistent with the repository.
- Prefer explicit types and small focused methods without breaking existing public contracts.

## Security Checklist

Apply each relevant control server-side:

- Validate input against an allowlist, expected type, length, range, and format. Treat client-side validation as usability only.
- Use PDO or MySQLi prepared statements. Never concatenate untrusted values into SQL.
- Escape HTML output with `htmlspecialchars($value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8')` at the rendering boundary.
- Require unpredictable CSRF tokens for state-changing browser requests and compare them with `hash_equals`.
- Enforce authentication and role or ownership authorization on every sensitive operation. Never rely on hidden UI controls.
- Store passwords with `password_hash` and verify them with `password_verify`. Regenerate the session ID after login or privilege changes.
- Configure session cookies as `HttpOnly`, `Secure` in HTTPS environments, and `SameSite=Lax` or stricter. Reject insecure production configuration.
- For uploads, enforce size limits, extension allowlists, MIME detection with `finfo`, generated filenames, and storage outside the public document root.
- Prevent path traversal by resolving paths against an allowed base directory and rejecting paths outside it.
- Set CSP, HSTS on HTTPS production traffic, `X-Frame-Options`, `X-Content-Type-Options`, and `Referrer-Policy` centrally.
- Read secrets and environment-specific values from environment variables or protected configuration. Never commit credentials.
- Minimize collected data and redact passwords, tokens, session IDs, and sensitive personal data from logs.
- Log authentication events and critical changes with timestamp, IP address, user agent, actor, action, and result. Use append-only or access-restricted log storage where the deployment supports it.

## Error Handling

- Route uncaught exceptions and PHP errors through the application's centralized handler.
- Return generic user-facing errors and appropriate HTTP status codes.
- Log diagnostic details securely without exposing stack traces, filesystem paths, SQL, secrets, or internal identifiers to users.
- Fail closed when authentication, authorization, CSRF validation, configuration, or file validation cannot be completed.

## Verification

- Run the existing test suite or the narrowest relevant tests.
- Run `php -l` on each changed PHP file.
- Test success, invalid input, unauthorized access, CSRF failure, and relevant boundary cases.
- For database changes, verify prepared statements, transaction behavior, and rollback paths.
- For upload changes, test oversized files, mismatched MIME or extension, malicious filenames, and direct-access prevention.
- Do not claim a check passed unless it was executed. State clearly when tooling or environment limitations prevent verification.
