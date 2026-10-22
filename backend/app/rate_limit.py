from collections import defaultdict, deque
import math
import time


AUTH_ROUTE_LIMITS: dict[str, tuple[int, int]] = {
    "/api/auth/register": (5, 15 * 60),
    "/api/auth/login": (10, 15 * 60),
    "/api/auth/mfa/complete": (5, 15 * 60),
    "/api/auth/totp/setup": (5, 15 * 60),
    "/api/auth/totp/enable": (5, 15 * 60),
    "/api/auth/totp/disable": (5, 15 * 60),
    "/api/auth/password-reset": (3, 15 * 60),
    "/api/auth/password-reset/complete": (5, 15 * 60),
    "/api/auth/email-verification/request": (3, 15 * 60),
    "/api/auth/email-verification/complete": (5, 15 * 60),
}

_attempts: dict[tuple[str, str], deque[float]] = defaultdict(deque)
_request_count = 0


def check_auth_rate_limit(path: str, client_host: str, now: float | None = None) -> int | None:
    """Return retry seconds when a caller exceeded the route's sliding-window limit."""
    global _request_count
    policy = AUTH_ROUTE_LIMITS.get(path)
    if policy is None:
        return None

    limit, window = policy
    current = time.monotonic() if now is None else now
    key = (path, client_host)
    bucket = _attempts[key]
    cutoff = current - window
    while bucket and bucket[0] <= cutoff:
        bucket.popleft()

    if len(bucket) >= limit:
        return max(1, math.ceil(window - (current - bucket[0])))

    bucket.append(current)
    _request_count += 1
    if _request_count % 512 == 0:
        for stale_key, stale_bucket in list(_attempts.items()):
            stale_window = AUTH_ROUTE_LIMITS[stale_key[0]][1]
            stale_cutoff = current - stale_window
            while stale_bucket and stale_bucket[0] <= stale_cutoff:
                stale_bucket.popleft()
            if not stale_bucket:
                del _attempts[stale_key]
    return None
