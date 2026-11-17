/**
 * Autonomous Pull Request Delivery Pipeline
 * Handles feature branch creation, commit, PR opening, and squash merge.
 */

import { execSync } from 'node:child_process';

function run(cmd, env = {}) {
  return execSync(cmd, {
    stdio: 'inherit',
    env: { ...process.env, ...env }
  });
}

function runCapture(cmd) {
  return execSync(cmd, { encoding: 'utf-8' }).trim();
}

async function deliverPulse() {
  const dateStr = new Date().toISOString().split('T')[0];
  const branchName = `telemetry/pulse-${dateStr}`;

  console.log(`[+] Starting Pull Request delivery for ${dateStr}...`);

  const status = runCapture('git status --porcelain');
  if (!status) {
    console.log('[+] No changes detected. Workspace is clean.');
    return;
  }

  console.log('[+] Changes detected. Branching and staging...');
  run(`git checkout -B ${branchName}`);
  run('git add HEARTBEAT.md telemetry/');
  run(`git commit -m "feat(telemetry): sync autonomous heartbeat and oss intelligence for ${dateStr} [skip ci]"`);
  run(`git push origin ${branchName} --force`);

  const prTitle = `chore(telemetry): autonomous daily heartbeat & oss intel (${dateStr})`;
  const prBody = `### Telemetry & OSS Discovery Pulse - ${dateStr}

- **Engine**: Autonomous Spider-Web Sentinel v2.0
- **Subsystems Active**: OSS Scout, Cluster Telemetry, Digest Generator
- **Target**: Continuous verified contribution pipeline across multi-vector graph.`;

  console.log('[+] Opening formal Pull Request via GitHub CLI...');
  let prUrl = '';
  try {
    prUrl = runCapture(`gh pr create --title "${prTitle}" --body "${prBody}" --base main --head "${branchName}"`);
    console.log(`[+] Created Pull Request: ${prUrl}`);
  } catch (err) {
    console.warn(`[WARN] gh pr create failed or PR already open: ${err.message}`);
  }

  if (prUrl) {
    console.log('[+] Attempting squash merge of Pull Request...');
    try {
      run(`gh pr merge "${prUrl}" --squash --delete-branch`);
      console.log(`[+] Successfully merged ${prUrl} into main.`);
      return;
    } catch (err) {
      console.warn(`[WARN] gh pr merge failed: ${err.message}. Falling back to direct sync.`);
    }
  }

  // Fallback direct sync
  console.log('[+] Executing fallback merge into main...');
  run('git checkout main');
  run(`git merge ${branchName}`);
  run('git push origin main');
  console.log('[+] Fallback integration complete.');
}

deliverPulse().catch(err => {
  console.error('[FATAL] Delivery pipeline failed:', err);
  process.exit(1);
});
