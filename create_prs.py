#!/usr/bin/env python3
"""
Batch PR creator for Truxify GSSOC cron run.
Creates issues and PRs sequentially for each candidate.
"""
import subprocess, json, os, time, sys

GH_TOKEN = os.environ.get("GH_TOKEN", "")
REPO = "KanishJebaMathewM/Truxify"
WORKSPACE = "/workspace/truxify"
os.chdir(WORKSPACE)
os.environ["GITHUB_TOKEN"] = GH_TOKEN

def gh(cmd, data=None):
    """Run gh CLI command, return parsed JSON output."""
    c = cmd.split()
    if data:
        inp = json.dumps(data)
        r = subprocess.run(c, input=inp.encode(), capture_output=True)
    else:
        r = subprocess.run(c, capture_output=True)
    if r.returncode != 0:
        err = r.stderr.decode()[:200]
        print(f"  GH ERROR: {err}")
        return None
    out = r.stdout.decode()
    if out.strip().startswith('{') or out.strip().startswith('['):
        try:
            return json.loads(out)
        except:
            pass
    return out.strip()

def file_write(path, content):
    with open(path, "w") as f:
        f.write(content)

def run(cmd):
    r = subprocess.run(cmd, shell=True, capture_output=True, cwd=WORKSPACE)
    if r.returncode != 0:
        print(f"  CMD ERROR: {r.stderr.decode()[:200]}")
        return False
    return True

def create_issue(title, body, labels):
    """Create GitHub issue and return issue number."""
    data = {
        "title": title,
        "body": body,
        "labels": labels
    }
    result = gh(f"gh issue create --repo {REPO} --json number,title", data)
    # Use CLI directly
    r = subprocess.run(
        f"gh issue create --repo {REPO} --title {title!r} --body {body!r} {' '.join('--label '+l for l in labels)}".split(),
        capture_output=True, cwd=WORKSPACE
    )
    if r.returncode != 0:
        print(f"  Issue create failed: {r.stderr.decode()[:100]}")
        # Try via API
        r2 = subprocess.run(
            ["gh", "api", f"repos/{REPO}/issues", "-f", f"title={title}", "-f", f"body={body}", "-f", f"labels={','.join(labels)}"],
            capture_output=True, cwd=WORKSPACE, env={**os.environ, "GH_TOKEN": GH_TOKEN}
        )
        if r2.returncode == 0:
            data = json.loads(r2.stdout)
            print(f"  Created issue #{data['number']} via API")
            return int(data['number'])
        return None
    out = r.stdout.decode().strip()
    # Extract number from URL
    num = out.split('/')[-1]
    print(f"  Created issue #{num}")
    return int(num)

def create_pr(title, body, branch, files):
    """Create a branch, write files, commit, push, open PR."""
    # Create branch from upstream/main
    run(f"git checkout upstream/main -b {branch}")
    
    # Write all files
    for path, content in files.items():
        fpath = os.path.join(WORKSPACE, path)
        os.makedirs(os.path.dirname(fpath), exist_ok=True)
        with open(fpath, "w") as f:
            f.write(content)
        run(f"git add {path}")
    
    # Commit
    run(f"git commit -m '{title}'")
    
    # Push branch
    run(f"git push origin {branch} --force-with-lease")
    
    # Create PR
    body_esc = body.replace("'", "'\"'\"'")
    r = subprocess.run(
        ["gh", "pr", "create", "--repo", REPO, "--title", title, "--body", body_esc, "--base", "main"],
        capture_output=True, cwd=WORKSPACE, env={**os.environ, "GH_TOKEN": GH_TOKEN}
    )
    if r.returncode != 0:
        print(f"  PR create failed: {r.stderr.decode()[:200]}")
        return False
    out = r.stdout.decode().strip()
    print(f"  Opened PR: {out}")
    return True

# PR candidates
PRs = [
    {
        "title": "fix(api): removed duplicate crypto import in otpHashing.js",
        "body": """## Summary\nFixed a mid-file duplicate `import crypto from 'crypto'` declaration in `backend/api/src/lib/otpHashing.js` that caused a `SyntaxError: Identifier 'crypto' has already been declared` when Node.js tried to parse the module.\n\n## Root Cause\nThe file had two `import crypto from 'crypto'` declarations: one at the top (correct) and one mid-file before the `constantTimeEqualHex` function (incorrect). This caused the module to fail to load entirely.\n\n## Fix\nRemoved the duplicate mid-file import statement. The top-level import is sufficient for all functions in the file.\n\n## Testing\n- `node --check src/lib/otpHashing.js` passes with no errors\n- `npx eslint src/lib/otpHashing.js` passes with no errors\n\n## GSSOC Note\nThis fix enables the `constantTimeEqualHex` function to be properly exported and used by callers of the otpHashing module.\n\nCloses #XXX\n""",
        "branch": "fix/otp-hashing-duplicate-import",
        "files": {
            "backend/api/src/lib/otpHashing.js": '''import crypto from 'crypto';

/**
 * Hash an OTP with scrypt and a per-OTP random salt. The salt is
 * stored alongside the digest, so the stored value cannot be brute-forced
 * offline the way an unsalted SHA-256 of a 6-digit code can be.
 *
 * @param {string|number} otp
 * @param {string} [saltHex] - existing salt (for verification), or undefined
 *   to generate a fresh 16-byte salt.
 * @returns {{hash: string, salt: string}} hex-encoded scrypt digest (64 bytes)
 *   and hex-encoded salt.
 */
export function hashOtp(otp, saltHex) {
  if (otp === null || otp === undefined || (typeof otp === 'string' && otp.trim() === '')) {
    throw new TypeError('OTP must be a non-empty value');
  }
  const salt = saltHex || crypto.randomBytes(16).toString('hex');
  const key = crypto.scryptSync(String(otp), salt, 64);
  return { hash: key.toString('hex'), salt };
}

/**
 * Timing-safe comparison of a submitted OTP against a stored record.
 *
 * Records written after the salted-hash migration carry an `otp_salt`; those
 * are compared with scrypt. Pre-migration rows (no salt) are compared with
 * SHA-256 so in-flight OTPs keep working for their remaining TTL window.
 *
 * @param {string|number} otp
 * @param {{otp_hash?: string, otp_salt?: string}|null} otpRecord
 * @returns {boolean}
 */
export function verifyOtpHash(otp, otpRecord) {
  if (!otpRecord) return false;
  if (otpRecord.otp_salt) {
    const { hash: submittedHash } = hashOtp(otp, otpRecord.otp_salt);
    const expected = String(otpRecord.otp_hash || '');
    if (!/^[a-f0-9]{128}$/.test(expected)) return false;
    return crypto.timingSafeEqual(Buffer.from(submittedHash, 'hex'), Buffer.from(expected, 'hex'));
  }
  if (otpRecord.otp_hash && /^[a-f0-9]{64}$/.test(otpRecord.otp_hash)) {
    const submittedHash = crypto.createHash('sha256').update(String(otp)).digest('hex');
    return crypto.timingSafeEqual(Buffer.from(submittedHash, 'hex'), Buffer.from(otpRecord.otp_hash, 'hex'));
  }
  return false;
}


// === Spec 12: ===
// === Spec 12: constant-time hex compare ===
export function constantTimeEqualHex(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  if (a.length !== b.length) return false;
  try { return crypto.timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex')); }
  catch (_) { return false; }
}
'''
        }
    }
]

for i, pr in enumerate(PRs):
    print(f"\n[{i+1}/{len(PRs)}] {pr['title']}")
    # Sync to upstream main
    run("git checkout upstream/main --detach 2>/dev/null || git checkout upstream/main")
    # Create branch
    branch = pr['branch']
    run(f"git checkout upstream/main -b {branch} 2>&1")
    
    # Write files
    for path, content in pr['files'].items():
        fpath = os.path.join(WORKSPACE, path)
        os.makedirs(os.path.dirname(fpath), exist_ok=True)
        with open(fpath, "w") as f:
            f.write(content)
        run(f"git add {path}")
    
    # Commit
    msg = pr['title']
    run(f"git commit -m {repr(msg)}")
    
    # Push
    push = run(f"git push origin {branch} --force-with-lease 2>&1")
    if not push:
        print(f"  Push failed, trying again...")
        continue
    
    # Create PR
    body = pr['body']
    r = subprocess.run(
        ["gh", "pr", "create", "--repo", REPO, "--title", msg, "--body", body, "--base", "main"],
        capture_output=True, cwd=WORKSPACE, env={**os.environ, "GH_TOKEN": GH_TOKEN}
    )
    if r.returncode == 0:
        pr_url = r.stdout.decode().strip()
        pr_num = pr_url.split('/')[-1]
        print(f"  PR #{pr_num}: {pr_url}")
        # Update body with PR number
        new_body = body.replace("Closes #XXX", f"Closes #{pr_num}")
    else:
        print(f"  PR failed: {r.stderr.decode()[:200]}")
    
    time.sleep(3)

print("\nDone!")
