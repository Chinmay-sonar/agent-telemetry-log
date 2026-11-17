/**
 * Interactive Open-Source Contribution Helper
 * CLI tool for developers to scout, fork, and prepare high-impact PRs.
 */

import { scoutAllCategories } from './oss-scout.js';
import { execSync } from 'node:child_process';

const args = process.argv.slice(2);
const command = args[0] || 'help';

async function main() {
  if (command === 'scout') {
    console.log('\n🔍 Scanning for high-impact open-source issues...\n');
    const categories = await scoutAllCategories();
    for (const [cat, issues] of Object.entries(categories)) {
      console.log(`\n=== ${cat} ===`);
      if (issues.length === 0) {
        console.log('  No matching issues found.');
        continue;
      }
      issues.slice(0, 3).forEach((iss, idx) => {
        console.log(`\n  ${idx + 1}. [${iss.repo}] ${iss.title}`);
        console.log(`     Link: ${iss.html_url}`);
        console.log(`     Labels: ${(iss.labels || []).join(', ')}`);
      });
    }
    console.log('\n✅ Scout scan complete.\n');
  } else if (command === 'fork') {
    const targetRepo = args[1];
    if (!targetRepo) {
      console.error('Error: Please specify target repo (e.g. owner/repo).');
      process.exit(1);
    }
    console.log(`[+] Forking upstream repository: ${targetRepo}...`);
    try {
      execSync(`gh repo fork ${targetRepo} --clone=false`, { stdio: 'inherit' });
      console.log(`\n🎉 Successfully forked ${targetRepo}!`);
      console.log(`Next step: git clone https://github.com/Chinmay-sonar/${targetRepo.split('/')[1]}.git`);
    } catch (err) {
      console.error('Failed to fork repository:', err.message);
    }
  } else {
    console.log(`
🛰️ OSS Contribution Helper Commands:
  node scripts/oss-contribute.js scout          - Scan live open-source issues
  node scripts/oss-contribute.js fork <owner/repo> - Fork target repo to your account
`);
  }
}

main().catch(console.error);
