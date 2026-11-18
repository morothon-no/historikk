"use strict";
// Public/synthetic fixtures. Test approvals are local function arguments, never repository settings.
const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("node:fs/promises"),
  path = require("node:path");
const { execFileSync } = require("node:child_process");
const {
  checkPolicy,
  policyChanges,
  critical,
} = require("../../../scripts/check-public-policy.cjs");
const { temp, copyPublic } = require("../../helpers/public-package.cjs");
const files = [
  "deploy/admin-serverless/check-deployment.cjs",
  "deploy/admin-serverless/wrangler.jsonc",
];
async function put(root, file, text) {
  const dest = path.join(root, file);
  await fs.mkdir(path.dirname(dest), { recursive: true });
  await fs.writeFile(dest, text);
}
test("manual deployment workflow, guard and target configuration require explicit external approval; ordinary tests do not", async () => {
  for (const file of [".github/workflows/deploy-admin-worker.yml", ...files])
    assert.equal(critical(file), true, file);
  assert.equal(critical("tests/manual-worker-deploy.cjs"), false);
  for (const changed of [
    ".github/workflows/deploy-admin-worker.yml",
    ...files,
  ]) {
    const base = await temp(),
      candidate = await temp(),
      head = "a".repeat(40);
    try {
      await copyPublic(base);
      await copyPublic(candidate);
      for (const file of files) {
        await put(base, file, "synthetic baseline\n");
        await put(candidate, file, "synthetic baseline\n");
      }
      await put(candidate, changed, "synthetic changed control\n");
      assert.deepEqual(await policyChanges(base, candidate), [changed]);
      await put(
        candidate,
        "deployment-approval.json",
        JSON.stringify({ reviewedHeadSha: head, approved: true }),
      );
      for (const reviewedHeadSha of ["", "b".repeat(40)])
        await assert.rejects(
          checkPolicy({
            baseRoot: base,
            candidateRoot: candidate,
            headSha: head,
            reviewedHeadSha,
          }),
          /Security policy changes require maintainer approval of this exact PR head/,
        );
      const accepted = await checkPolicy({
        baseRoot: base,
        candidateRoot: candidate,
        headSha: head,
        reviewedHeadSha: head,
      });
      assert.equal(accepted.securityReviewRequired, true);
      assert.equal(accepted.visiblePeople, 43);
    } finally {
      await fs.rm(base, { recursive: true, force: true });
      await fs.rm(candidate, { recursive: true, force: true });
    }
  }
});
test("sparse public jobs detect deployment-control changes from Git metadata while both files remain absent", async () => {
  const base = await temp(),
    candidate = await temp();
  const git = (root, args) =>
    execFileSync("git", ["-C", root, ...args], {
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    });
  try {
    for (const root of [base, candidate]) {
      await copyPublic(root);
      git(root, ["init", "-q", "-b", "main"]);
      git(root, ["config", "user.name", "Synthetic policy fixture"]);
      git(root, ["config", "user.email", "synthetic@example.invalid"]);
      for (const file of files)
        await put(
          root,
          file,
          root === candidate
            ? "synthetic changed metadata\n"
            : "synthetic original metadata\n",
        );
      git(root, ["add", "--", ...files]);
      git(root, ["commit", "-qm", "Synthetic protected deployment controls"]);
      // Same visibility as actual Pages sparse checkout: only tree metadata is available.
      for (const file of files) await fs.unlink(path.join(root, file));
      assert.equal(
        await fs.stat(path.join(root, "data")).then(
          () => true,
          () => false,
        ),
        false,
      );
    }
    const head = git(candidate, ["rev-parse", "HEAD"]).trim(),
      opts = {
        baseRoot: base,
        candidateRoot: candidate,
        headSha: head,
        requireGit: true,
      };
    assert.deepEqual(
      await policyChanges(base, candidate, { requireGit: true }),
      files,
    );
    await assert.rejects(checkPolicy(opts), /exact PR head/);
    assert.equal(
      (await checkPolicy({ ...opts, reviewedHeadSha: head }))
        .securityReviewRequired,
      true,
    );
    for (const root of [base, candidate])
      for (const file of files)
        await assert.rejects(fs.access(path.join(root, file)), /ENOENT/);
  } finally {
    await fs.rm(base, { recursive: true, force: true });
    await fs.rm(candidate, { recursive: true, force: true });
  }
});
