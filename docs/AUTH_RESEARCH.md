# ShikiLamp authentication research

Checked: 2026-07-13

## Conclusion

Shikimori currently documents OAuth 2 Authorization Code flow with a mandatory `client_secret`. Access tokens expire after one day and are renewed through a refresh token grant that also requires `client_secret`.

A public GitHub Pages plugin must not contain this secret. A user-friendly TV login therefore needs a small server-side OAuth relay. Manual access-token entry can remain only as a hidden developer/recovery option.

## Documented endpoints

- Application registration: `https://shikimori.io/oauth/applications`
- Authorization: `GET https://shikimori.io/oauth/authorize`
- Token exchange: `POST https://shikimori.io/oauth/token`
- Current user: `GET https://shikimori.io/api/users/whoami`
- Revocation endpoint observed experimentally: `POST https://shikimori.io/oauth/revoke`

## Documented authorization-code request

```text
https://shikimori.io/oauth/authorize
  ?client_id=CLIENT_ID
  &redirect_uri=REDIRECT_URI
  &response_type=code
  &scope=
```

The relay must additionally generate and send `state`, even though the short guide does not show it.

## Documented token exchange

```http
POST /oauth/token
Content-Type: application/x-www-form-urlencoded
User-Agent: APPLICATION_NAME

 grant_type=authorization_code
 client_id=CLIENT_ID
 client_secret=CLIENT_SECRET
 code=AUTHORIZATION_CODE
 redirect_uri=REDIRECT_URI
```

The `redirect_uri` used for token exchange must match the authorization request. A fake exchange returned `invalid_grant` with this requirement in the error description.

## Documented refresh

```http
POST /oauth/token
Content-Type: application/x-www-form-urlencoded
User-Agent: APPLICATION_NAME

 grant_type=refresh_token
 client_id=CLIENT_ID
 client_secret=CLIENT_SECRET
 refresh_token=REFRESH_TOKEN
```

Shikimori states that refresh returns a new access token and refresh token. Treat refresh tokens as rotating: persist the new pair atomically and invalidate the old pair after success.

## Token lifetime

Shikimori documentation states:

```text
Access Token is expired in 1 day.
```

Expected expired-token response:

```json
{
  "error": "invalid_token",
  "error_description": "The access token is invalid",
  "state": "unauthorized"
}
```

## CORS observations

Experimental preflight from `https://nikitansv.github.io`:

### `/oauth/token`

```text
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: POST
Access-Control-Allow-Headers: content-type,user-agent
```

### `/api/users/whoami`

```text
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, OPTIONS, POST, PUT, PATCH, DELETE
Access-Control-Allow-Headers: authorization,user-agent
```

CORS allows browser calls, but this does not make a client-side token exchange safe: embedding `client_secret` in `ShikiLamp.js` would disclose it publicly.

## Unsupported or undocumented capabilities

### Device Authorization Grant

Probed endpoints:

```text
POST /oauth/device/code          → 404
POST /oauth/device_authorization → 404
POST /oauth/device               → 404
```

No device flow is documented.

### PKCE

The published OAuth guide contains no `code_challenge`, `code_verifier`, or PKCE instructions. A request containing PKCE parameters redirects unauthenticated users to sign-in, which does not prove server-side PKCE validation. Do not rely on PKCE unless Shikimori documents it or it is verified end-to-end with a registered test application.

### OAuth discovery metadata

```text
/.well-known/openid-configuration        → 404
/.well-known/oauth-authorization-server  → 404
```

No machine-readable authorization-server metadata is exposed.

### Revocation

`POST /oauth/revoke` returned `200 {}` for an invalid token/client payload. This strongly indicates a Doorkeeper revocation endpoint, but it is not described by the public OAuth guide. Verify with a registered test application before treating revocation semantics as guaranteed.

## Recommended TV flow

Shikimori does not provide RFC 8628 device flow, so ShikiLamp must emulate TV pairing around normal Authorization Code flow:

1. TV calls relay `POST /v1/sessions`.
2. Relay creates:
   - random `session_id` (at least 128 bits),
   - independent `poll_secret` (at least 256 bits),
   - short human `user_code`,
   - OAuth `state` (at least 256 bits),
   - expiry (5–10 minutes).
3. TV receives QR URL and user code. It never receives OAuth client secret.
4. Phone opens relay verification URL.
5. Relay redirects phone to Shikimori `/oauth/authorize` with exact registered callback and `state`.
6. Callback validates `state`, exchanges code server-side, calls `/api/users/whoami`, and marks session authorized.
7. TV polls using `session_id` plus `poll_secret`.
8. Authorized result is delivered once; repeated reads return consumed.
9. Plugin stores token bundle locally in Lampa storage and schedules refresh before expiry.
10. Refresh goes through relay because it requires client secret.
11. Logout revokes token when supported and clears local state regardless of revocation result.

## Relay API recommendation

```text
POST   /v1/sessions
GET    /v1/verify/:user_code
GET    /v1/oauth/callback
POST   /v1/sessions/:session_id/poll
POST   /v1/tokens/refresh
POST   /v1/tokens/revoke
```

Use POST for polling so `poll_secret` is never placed in a URL or access log.

## Security requirements

- Keep `client_secret` only in Worker secret storage.
- Never put access/refresh token, authorization code, session secret, or poll secret in URL/query parameters.
- Validate exact `redirect_uri`; do not accept arbitrary callback URLs from clients.
- Generate and validate OAuth `state`; one-time use only.
- Expire sessions after 5–10 minutes.
- Make authorization code exchange and result consumption idempotent.
- Rate-limit session creation, user-code attempts, polling, refresh, and revoke.
- Store only hashes of `poll_secret` and user code where possible.
- Encrypt token material at rest if relay stores it beyond the callback transaction.
- Prefer one-time delivery of tokens; do not build a permanent account database for MVP.
- Rotate refresh token atomically after every successful refresh.
- Return generic errors for invalid user codes to prevent enumeration.
- Set `Cache-Control: no-store` on every auth response.
- Set strict CSP, `Referrer-Policy: no-referrer`, and `X-Content-Type-Options: nosniff` on verification pages.
- Restrict browser CORS to known ShikiLamp origins. TV clients still authenticate with session secrets.
- Redact `Authorization`, token bodies, codes, state, session IDs, and secrets from logs and diagnostics.
- Do not use localStorage on the phone verification page for OAuth material.

## Storage decision

Recommended MVP:

- Relay holds token pair only until the TV consumes it.
- TV stores access token, refresh token, expiry, and user profile locally through `Lampa.Storage`.
- Refresh token is sent to relay over HTTPS only when refresh is needed; relay exchanges it and returns the rotated pair.
- Relay does not retain a long-lived account record.

Trade-off: a compromised TV/local profile exposes its own token, but compromise of relay storage does not expose all users. This is preferable for a small public plugin.

## Required real end-to-end test

Technical probing cannot prove PKCE behavior, exact redirect matching policy, real token shape, refresh rotation, or revocation without a registered Shikimori OAuth application.

Before implementation completion:

1. Register `ShikiLamp` at `/oauth/applications`.
2. Set one exact HTTPS callback owned by the relay.
3. Run authorization with `state`.
4. Exchange a real authorization code.
5. Record token response field names and `expires_in` (without recording values).
6. Call `/api/users/whoami`.
7. Refresh once and verify whether both tokens rotate.
8. Verify old access token and old refresh token behavior after rotation.
9. Revoke current token and verify `whoami` returns 401.
10. Confirm callback mismatch is rejected.
11. Optionally test PKCE with the registered app; use it only if verification proves enforcement.

No secrets or token values should be committed or included in test fixtures.
