#!/usr/bin/env python3
"""
Auto-resolve merge conflicts for open PRs on tmdeveloper007/Truxify.

tmdeveloper007/Truxify is a fork of KanishJebaMathewM/Truxify.
PRs on this fork target either:
  - tmdeveloper007/Truxify:main (internal PRs)
  - KanishJebaMathewM/Truxify:main (upstream PRs)

For each open PR with merge conflicts:
  1. Fetch the PR's head branch and base branch.
  2. Rebase the head onto the latest base.
  3. Auto-resolve conflicts by preferring the PR's changes.
  4. Force-push the rebased branch to update the PR.
  5. Post a comment on the PR about what was done.

If rebase fails entirely, SKIP the PR — do NOT close it.
"""

import json
import os
import subprocess
import urllib.request
import urllib.error

GH_TOKEN = os.environ.get("GH_TOKEN", "")
HEADERS = {
    "Authorization": f"token {GH_TOKEN}",
    "Accept": "application/vnd.github.v3+json",
    "X-GitHub-Api-Version": "2022-11-28"
}
FORK_OWNER = "tmdeveloper007"
FORK_NAME = "Truxify"
UPSTREAM_OWNER = "KanishJebaMathewM"
UPSTREAM_NAME = "Truxify"


def api(method, path, data=None, params=None):
    url = f"https://api.github.com{path}"
    if params:
        url += "?" + "&".join(f"{k}={v}" for k, v in params.items())
    body = json.dumps(data).encode() if data else None
    req = urllib.request.Request(url, data=body, headers=HEADERS, method=method)
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.loads(resp.read())
    except urllib.error.HTTPError as e:
        body_bytes = e.read()
        print(f"  API ERROR {e.code} {url}: {body_bytes[:500]}")
        return None


def git_run(args, check=False, capture=True, cwd=None):
    cmd = ["git"] + args
    try:
        result = subprocess.run(
            cmd, cwd=cwd, capture_output=capture, text=True, check=check
        )
        return result
    except subprocess.CalledProcessError as e:
        if capture:
            print(f"  git {' '.join(args)} failed (code {e.returncode}): {e.stderr.strip()}")
        return None


def get_open_prs():
    """Fetch all open PRs on the fork."""
    print("Fetching all open PRs from tmdeveloper007/Truxify...")
    prs = []
    page = 1
    while True:
        data = api("GET", f"/repos/{FORK_OWNER}/{FORK_NAME}/pulls",
                   params={"state": "open", "per_page": 100, "page": page})
        if not data:
            break
        prs.extend(data)
        if len(data) < 100:
            break
        page += 1
    print(f"Found {len(prs)} open PR(s).")
    return prs


def get_conflicting_prs(prs):
    """Filter to PRs with dirty/unstable mergeable state."""
    conflicting = []
    for pr in prs:
        num = pr["number"]
        data = api("GET", f"/repos/{FORK_OWNER}/{FORK_NAME}/pulls/{num}")
        if not data:
            continue
        mergeable = data.get("mergeable")
        mergeable_state = data.get("mergeable_state", "unknown")
        is_dirty = (
            mergeable is False
            or mergeable_state in ("dirty", "unstable", "behind")
        )
        if is_dirty:
            print(f"  PR #{num}: CONFLICT (mergeable={mergeable}, state={mergeable_state})")
            conflicting.append({
                "number": num,
                "title": pr.get("title", ""),
                "head": pr["head"],
                "base": pr["base"],
                "head_sha": pr["head"]["sha"],
                "mergeable_state": mergeable_state,
            })
        else:
            print(f"  PR #{num}: clean (mergeable={mergeable}, state={mergeable_state})")
    return conflicting


def fetch_pr_branches(pr_info):
    """Ensure the head and base branches are available locally."""
    base_ref = pr_info["base"]["ref"]
    head_ref = pr_info["head"]["ref"]
    base_repo = pr_info["base"]["repo"]["full_name"]
    head_repo = pr_info["head"]["repo"]["full_name"]

    print(f"\n  Fetching branches for PR #{pr_info['number']}:")
    print(f"  Base: {base_repo}:{base_ref}")
    print(f"  Head: {head_repo}:{head_ref}")

    # Determine which remote has the base
    if base_repo == f"{FORK_OWNER}/{FORK_NAME}":
        # Base is on fork — already available via origin
        git_run(["fetch", "origin", f"refs/heads/{base_ref}:refs/remotes/origin/{base_ref}", "--quiet"])
        print(f"  Fetched base from origin: origin/{base_ref}")
    elif base_repo == f"{UPSTREAM_OWNER}/{UPSTREAM_NAME}":
        # Base is on upstream — add upstream remote and fetch
        upstream_url = f"https://x-access-token:{GH_TOKEN}@github.com/{base_repo}.git"
        git_run(["remote", "add", "upstream", upstream_url])
        git_run(["fetch", "upstream", base_ref, "--quiet"])
        print(f"  Fetched base from upstream: upstream/{base_ref}")
    else:
        # Unknown remote — try origin anyway
        git_run(["fetch", "origin", f"refs/heads/{base_ref}:refs/remotes/origin/{base_ref}", "--quiet"])

    # Ensure head branch is available
    if head_repo == f"{FORK_OWNER}/{FORK_NAME}":
        git_run(["fetch", "origin", f"refs/heads/{head_ref}:refs/remotes/origin/{head_ref}", "--quiet"])
        print(f"  Fetched head from origin: origin/{head_ref}")
    else:
        # Head is from a different fork
        head_remote_name = head_repo.replace("/", "__")
        head_url = f"https://x-access-token:{GH_TOKEN}@github.com/{head_repo}.git"
        git_run(["remote", "add", head_remote_name, head_url])
        git_run(["fetch", head_remote_name, head_ref, "--quiet"])
        print(f"  Fetched head from {head_remote_name}: {head_ref}")

    print(f"  Branches ready for rebase.")
    return base_ref, head_ref


def attempt_rebase(pr_info, base_ref, head_ref):
    """Rebase head onto base, auto-resolving conflicts by preferring PR changes."""
    pr_num = pr_info["number"]
    work_branch = f"cron-rebase-pr-{pr_num}"

    print(f"\n  Creating work branch '{work_branch}' from origin/{head_ref}...")

    # Clean up
    git_run(["checkout", "--force", "--detach"])
    git_run(["branch", "-D", work_branch])

    result = git_run(["checkout", "-b", work_branch, f"origin/{head_ref}"])
    if result is None or result.returncode != 0:
        print(f"  Cannot checkout origin/{head_ref} — skipping PR #{pr_num}")
        return "skipped"

    # Pull latest base into origin/base_ref
    git_run(["fetch", "origin", f"refs/heads/{base_ref}:refs/remotes/origin/{base_ref}"])

    # If base is from upstream, also update upstream remote
    base_repo = pr_info["base"]["repo"]["full_name"]
    base_remote = "origin"
    base_branch = f"origin/{base_ref}"
    if base_repo == f"{UPSTREAM_OWNER}/{UPSTREAM_NAME}":
        git_run(["fetch", "upstream", f"{base_ref}:refs/remotes/upstream/{base_ref}"])
        base_remote = "upstream"
        base_branch = f"upstream/{base_ref}"

    print(f"  Rebasing onto {base_branch}...")
    result = git_run(["rebase", base_branch], capture=False)

    if result and result.returncode != 0:
        print(f"  Rebase has conflicts — auto-resolving by preferring PR changes...")

        status = git_run(["status", "--porcelain"], capture=True)
        if not status:
            print(f"  Cannot read git status — skipping PR #{pr_num}")
            git_run(["rebase", "--abort"])
            return "skipped"

        conflicted = [
            l for l in status.stdout.strip().split("\n")
            if l.startswith("UU") or l.startswith("AA") or l.startswith("DD")
        ]

        if not conflicted:
            print(f"  No conflicted files found — skipping PR #{pr_num}")
            git_run(["rebase", "--abort"])
            return "skipped"

        files_resolved = 0
        for line in conflicted:
            parts = line.split(maxsplit=1)
            if len(parts) >= 2:
                file_path = parts[1]
                git_run(["git", "checkout", "--ours", file_path])
                git_run(["git", "add", file_path])
                files_resolved += 1

        print(f"  Auto-resolved {files_resolved} file(s) — continuing rebase...")
        result2 = git_run(["rebase", "--continue"], capture=False)
        if result2 and result2.returncode == 0:
            print(f"  Rebase succeeded with auto-resolved conflicts!")
            return "success"
        else:
            print(f"  Rebase --continue failed — skipping PR #{pr_num}")
            git_run(["rebase", "--abort"])
            return "skipped"

    elif result and result.returncode == 0:
        print(f"  Rebase succeeded cleanly!")
        return "success"

    return "skipped"


def force_push(pr_info, work_branch):
    """Force-push the rebased branch to update the PR."""
    pr_num = pr_info["number"]
    head_ref = pr_info["head"]["ref"]
    push_url = f"https://x-access-token:{GH_TOKEN}@github.com/{FORK_OWNER}/{FORK_NAME}.git"

    git_run(["remote", "set-url", "origin", push_url])
    result = git_run(
        ["push", "origin", f"HEAD:refs/heads/{head_ref}", "--force", "--quiet"]
    )
    if result and result.returncode == 0:
        print(f"  Force-push successful! PR #{pr_num} updated.")
        return True
    else:
        print(f"  Force-push failed — PR #{pr_num} was not updated.")
        return False


def post_comment(pr_num, message):
    """Post a comment on the PR."""
    data = {"body": message}
    result = api("POST", f"/repos/{FORK_OWNER}/{FORK_NAME}/issues/{pr_num}/comments", data=data)
    if result is not None:
        print(f"  Posted comment on PR #{pr_num}.")
    return result is not None


def main():
    print("=" * 60)
    print("TRUXIFY MERGE CONFLICT RESOLVER")
    print("  Fork: tmdeveloper007/Truxify")
    print("  Upstream: KanishJebaMathewM/Truxify")
    print("=" * 60)

    if not GH_TOKEN:
        print("ERROR: GH_TOKEN not set. Cannot authenticate.")
        return

    prs = get_open_prs()
    if not prs:
        print("No open PRs found.")
        return

    conflicting = get_conflicting_prs(prs)
    if not conflicting:
        print("\nNo PRs with merge conflicts found. All good!")
        return

    print(f"\n{'='*60}")
    print(f"Attempting to resolve {len(conflicting)} conflicting PR(s)...")
    print(f"{'='*60}")

    resolved = []
    skipped = []

    for pr_info in conflicting:
        pr_num = pr_info["number"]
        print(f"\n{'='*40}")
        print(f"Processing PR #{pr_num}: {pr_info['title']}")
        print(f"{'='*40}")

        try:
            base_ref, head_ref = fetch_pr_branches(pr_info)
            result = attempt_rebase(pr_info, base_ref, head_ref)

            if result == "success":
                work_branch = f"cron-rebase-pr-{pr_num}"
                pushed = force_push(pr_info, work_branch)
                if pushed:
                    resolved.append(pr_num)
                    post_comment(
                        pr_num,
                        f"## 🤖 Auto Conflict Resolution\n\n"
                        f"This PR had merge conflicts that have been **automatically resolved** "
                        f"by rebasing onto the latest target branch (`{base_ref}`).\n\n"
                        f"**What was done:**\n"
                        f"- Fetched the latest `{base_ref}`\n"
                        f"- Rebased this PR's branch onto the latest `{base_ref}`\n"
                        f"- Auto-resolved conflicts preferring the PR changes\n"
                        f"- Pushed the updated branch\n\n"
                        f"Please verify the changes look correct. If anything looks wrong, "
                        f"you can force-push a fix or close and reopen this PR."
                    )
                else:
                    skipped.append(pr_num)
            else:
                skipped.append(pr_num)
                print(f"  Skipping PR #{pr_num} — could not auto-resolve.")

        except Exception as e:
            print(f"  Unexpected error on PR #{pr_num}: {e}")
            skipped.append(pr_num)

    print(f"\n{'='*60}")
    print("SUMMARY")
    print(f"{'='*60}")
    print(f"  Total open PRs:              {len(prs)}")
    print(f"  Had conflicts:               {len(conflicting)}")
    print(f"  Resolved & pushed:           {len(resolved)} → PRs {resolved}")
    print(f"  Skipped (no auto-resolve):   {len(skipped)} → PRs {skipped}")
    print(f"\nNo PRs were closed.")


if __name__ == "__main__":
    main()
