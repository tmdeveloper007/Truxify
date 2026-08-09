#!/usr/bin/env python3
"""Create PRs using git diff patches - most reliable approach."""
import subprocess
import os
import json
import urllib.request
import urllib.error

GH_TOKEN = os.environ.get("GH_TOKEN", "")
OWNER = "KanishJebaMathewM"
REPO = "Truxify"
FORK_OWNER = "tmdeveloper007"
WORKSPACE = "/workspace/truxify"
os.chdir(WORKSPACE)

def run(cmd, check=True, capture=True):
    result = subprocess.run(cmd, shell=True, capture_output=capture, text=True, cwd=WORKSPACE)
    if check and result.returncode != 0:
        print(f"  ERROR: {result.stderr[-300:]}")
    return result

# =====================================================================
# Create patch files for each issue
# =====================================================================

issues = [
    (8591, ["backend/api/src/controllers/deviceController.js"]),
    (8592, ["backend/api/src/repositories/orderRepository.js"]),
    (8593, ["backend/api/src/routes/healthRoutes.js"]),
    (8594, ["backend/ml/main.py"]),
    (8595, ["backend/ml/gat/dataset_loader.py"]),
    (8596, ["backend/ml/imitation/dataset_builder.py"]),
    (8597, ["backend/api/src/lib/escapeLike.js"]),
    (8599, ["backend/api/src/middleware/cors.js"]),
    (8600, ["backend/api/src/lib/circuitBreaker.js"]),
    (8611, ["backend/api/src/lib/reverseGeocode.js"]),
    (8601, ["backend/api/test/unit/otpHashing.test.js"]),
    (8602, ["backend/api/test/unit/sentry.test.js"]),
    (8603, ["backend/api/test/unit/validate.test.js"]),
    (8605, ["backend/api/test/unit/notificationService.test.js"]),
    (8606, ["backend/api/test/unit/escalationHandler.test.js"]),
    (8609, ["docs/REVERSE_GEOCODING.md"]),
    (8610, ["backend/api/test/unit/multicall3Service.test.js"]),
    (8614, ["backend/api/test/unit/apiResponse.test.js"]),
    (8616, ["backend/api/test/unit/redisLock.test.js"]),
]

# Generate patches
print("Generating patches...", flush=True)
for issue_num, files in issues:
    patch = run(f"git diff main -- {' '.join(files)}", check=False, capture=True).stdout
    patch_file = f"/tmp/patch_{issue_num}.diff"
    with open(patch_file, "w") as f:
        f.write(patch)
    print(f"  Issue #{issue_num}: {len(patch)} bytes, {len(files)} files", flush=True)

print(f"Generated {len(issues)} patches\n", flush=True)

# =====================================================================
# PR configs
# =====================================================================

pr_configs = {
    8591: ("fix : add missing errorResponse import to deviceController",
           "Added import of errorResponse from utils/apiResponse.js to deviceController.js. The errorResponse function was being called at line 64 but was not imported, causing a ReferenceError at runtime.",
           "fix: added missing errorResponse import to deviceController"),
    8592: ("fix : remove duplicate neq branch in updateOrderWithFilter",
           "Removed the unreachable duplicate else if (f.op === 'neq') branch from orderRepository.js updateOrderWithFilter(). The second neq branch incorrectly used .not() with 'neq' as the PostgREST operator.",
           "fix: removed duplicate neq branch in updateOrderWithFilter"),
    8593: ("fix : fix out-of-scope result reference in checkEscrow nested try-catch",
           "Restructured the checkEscrow() function in healthRoutes.js to use a single try-catch instead of nested try-catch blocks. The outer catch was referencing 'result' which was out of scope.",
           "fix: fixed out-of-scope result in checkEscrow nested try-catch"),
    8594: ("fix : remove unauthenticated /sentry-debug endpoint from ML main.py",
           "Removed the unauthenticated /sentry-debug GET endpoint from backend/ml/main.py that always raised ZeroDivisionError.",
           "fix: removed unauthenticated /sentry-debug endpoint from ML main"),
    8595: ("fix : replace JS-style comment in gat/dataset_loader.py",
           "Replaced the C++ style // comment with Python # comment in backend/ml/gat/dataset_loader.py. The // comment caused a SyntaxError in Python.",
           "fix: replaced JS-style comment with Python comment in gat dataset_loader"),
    8596: ("fix : replace JS-style comment in imitation/dataset_builder.py",
           "Replaced the C++ style // comment with Python # comment in backend/ml/imitation/dataset_builder.py. The // comment caused a SyntaxError in Python.",
           "fix: replaced JS-style comment with Python comment in imitation dataset_builder"),
    8597: ("fix : add null/undefined input guard to escapeLike function",
           "Added an early null/undefined guard at the start of escapeLike() in backend/api/src/lib/escapeLike.js. Passing null or undefined now safely returns the original value instead of throwing a TypeError.",
           "fix: added null/undefined input guard to escapeLike"),
    8599: ("fix : add caught error variable to bare catch block in cors.js",
           "Changed bare catch {} to catch (_) { in backend/api/src/middleware/cors.js to make the intentionally-unused error variable explicit.",
           "fix: added explicit catch variable in cors middleware"),
    8600: ("fix : add defensive err instanceof Error check in circuitBreaker onFailure",
           "Added instanceof Error check before accessing err.message in circuitBreaker.js onFailure(). This prevents potential crashes when a non-Error value is thrown.",
           "fix: added defensive instanceof Error check in circuitBreaker onFailure"),
    8611: ("fix : add rate-limit retry with Retry-After header support in reverseGeocode",
           "Added retry logic to reverseGeocode() for 429 Too Many Requests. The function now respects the Retry-After header, waiting before retrying once.",
           "fix: added rate-limit retry with Retry-After header support in reverseGeocode"),
    8601: ("test : added edge case unit tests for otpHashing.js",
           "Added unit tests for hashOtp null/undefined/empty-string TypeError throws.",
           "test: added edge case unit tests for otpHashing"),
    8602: ("test : added unit tests for sentry.js middleware shouldIgnoreError",
           "Added unit tests for shouldIgnoreError covering ECONNRESET, ECONNREFUSED, unknown error codes, and missing code property.",
           "test: added shouldIgnoreError unit tests to sentry middleware"),
    8603: ("test : added unit tests for validate.js formatValidationIssues",
           "Added unit tests for formatValidationIssues covering single-field errors, nested paths, empty paths, and empty issues.",
           "test: added formatValidationIssues unit tests to validate middleware"),
    8605: ("test : added edge case unit tests for notificationService FCM handling",
           "Added unit tests for getFcmTokenForUser(null), sendFcmNotification with empty token.",
           "test: added FCM edge case unit tests for notificationService"),
    8606: ("test : added unit tests for blockchain escalationHandler.js",
           "Created escalationHandler.test.js covering alert escalation levels, duplicate detection, and generateAlertId uniqueness.",
           "test: added unit tests for blockchain escalationHandler"),
    8609: ("docs : added API documentation for reverseGeocode utility",
           "Created docs/REVERSE_GEOCODING.md documenting function signature, caching, Nominatim API, error handling, and testing notes.",
           "docs: added API documentation for reverseGeocode utility"),
    8610: ("test : added unit tests for multicall3Service error handling",
           "Created multicall3Service.test.js covering individual call revert detection, empty batch handling, and partial success responses.",
           "test: added error handling unit tests for multicall3Service"),
    8614: ("test : added paginated edge case unit tests for apiResponse.js",
           "Added unit tests for paginated() with page 0, page > totalPages, and total=0 edge cases.",
           "test: added paginated edge case tests to apiResponse"),
    8616: ("test : added lock expiry and release unit tests for redisLock.js",
           "Added unit tests for acquireLock when lock is held and releaseLock when lock not held.",
           "test: added lock expiry and release tests to redisLock"),
}

def create_pr(issue_num):
    branch = f"#{issue_num}"
    patch_file = f"/tmp/patch_{issue_num}.diff"

    title, body_text, commit_msg = pr_configs[issue_num]
    print(f"\nIssue #{issue_num}: {title[:60]}", flush=True)

    # Clean up any existing branch
    run(f"git branch -D {branch} 2>/dev/null || true", check=False)
    run(f"git push origin --delete {branch} 2>/dev/null || true", check=False)

    # Create fresh branch from upstream main
    run(f"git checkout -b {branch} upstream/main", check=False)

    # Apply patch
    r = run(f"git apply --stat {patch_file}", check=False)
    if r.returncode != 0:
        print(f"  Patch stat failed: {r.stderr[:200]}")
        run("git checkout main", check=False)
        return None

    r = run(f"git apply {patch_file}", check=False)
    if r.returncode != 0:
        print(f"  Patch apply failed: {r.stderr[:200]}")
        run("git checkout main", check=False)
        return None

    # Commit
    r = run(f"git add -A && git commit -m '{commit_msg}'", check=False)
    if r.returncode != 0:
        print(f"  Commit failed: {r.stderr[:200]}")
        run("git checkout main", check=False)
        return None

    # Push
    r = run(f"git push origin {branch} 2>&1", check=False)
    if r.returncode != 0:
        print(f"  Push failed: {r.stderr[:200]}")
        run("git checkout main", check=False)
        return None

    # Build PR title
    pr_title = title
    if pr_title.startswith("fix :"):
        pr_title = "fix : added " + pr_title[7:]
    elif pr_title.startswith("test :"):
        pr_title = "test : added " + pr_title[8:]
    elif pr_title.startswith("docs :"):
        pr_title = "docs : added " + pr_title[7:]

    pr_body = f"""Closes #{issue_num}.

Summary of What Has Been Done:
{body_text}

This PR is submitted as part of GirlScript Summer of Code (GSSOC).

Note: Please assign this PR to the `tmdeveloper007` account."""

    payload = json.dumps({
        "title": pr_title,
        "head": f"{FORK_OWNER}:{branch}",
        "base": "main",
        "body": pr_body
    }).encode()

    req = urllib.request.Request(
        f"https://api.github.com/repos/{OWNER}/{REPO}/pulls",
        data=payload,
        headers={
            "Authorization": f"token {GH_TOKEN}",
            "Content-Type": "application/json",
            "Accept": "application/vnd.github.v3+json"
        },
        method="POST"
    )

    try:
        with urllib.request.urlopen(req) as resp:
            pr_data = json.loads(resp.read())
            pr_num = pr_data.get("number", "?")
            print(f"  PR #{pr_num}: {pr_data.get('html_url', '')}", flush=True)
            run("git checkout main", check=False)
            return pr_num
    except urllib.error.HTTPError as e:
        err_body = e.read().decode()
        print(f"  FAILED: {e.code} - {err_body[:200]}")
        run("git checkout main", check=False)
        return None

# =====================================================================
# Run
# =====================================================================

results = {}
for issue_num, files in issues:
    pr_num = create_pr(issue_num)
    results[issue_num] = pr_num

print("\n\n=== SUMMARY ===", flush=True)
for issue_num in sorted(results.keys()):
    pr_num = results[issue_num]
    status = f"PR #{pr_num}" if pr_num else "FAILED"
    print(f"  Issue #{issue_num}: {status}", flush=True)

created = len([p for p in results.values() if p])
print(f"\nTotal PRs created: {created}/{len(issues)}", flush=True)
