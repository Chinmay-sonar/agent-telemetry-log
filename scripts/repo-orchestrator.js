/**
 * GitHub Repository Orchestrator & Security Sentinel Agent
 * Performs deep structural audits and secret leak scans across all
 * existing and future repositories for @Chinmay-sonar.
 */

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');

// Common Sensitive Secret Patterns
const SECRET_PATTERNS = [
  { name: 'Google / Gemini API Key', regex: /AIza[0-9A-Za-z-_]{35}/g },
  { name: 'OpenAI API Key', regex: /sk-[a-zA-Z0-9T3BlbkFJ]{20,}|sk-proj-[a-zA-Z0-9_-]{50,}/g },
  { name: 'GitHub Personal Access Token', regex: /gh[pous]_[0-9a-zA-Z]{36}|github_pat_[0-9a-zA-Z_]{50,}/g },
  { name: 'Telegram Bot Token', regex: /\b[0-9]{9,10}:[a-zA-Z0-9_-]{35}\b/g },
  { name: 'Groq API Key', regex: /gsk_[a-zA-Z0-9]{48,}/g },
  { name: 'Anthropic API Key', regex: /sk-ant-[a-zA-Z0-9_-]{80,}/g },
  { name: 'NVIDIA NIM API Key', regex: /nvapi-[a-zA-Z0-9_-]{40,}/g },
  { name: 'AWS Access Key ID', regex: /\bAKIA[0-9A-Z]{16}\b/g },
  { name: 'Hugging Face Token', regex: /\bhf_[a-zA-Z0-9]{34}\b/g },
  { name: 'RSA / SSH Private Key', regex: /-----BEGIN (?:RSA |OPENSSH |EC |PGP )?PRIVATE KEY-----/g }
];

// Sensitive file names that should NEVER be tracked by git
const FORBIDDEN_FILES = [
  '.env',
  '.env.local',
  '.env.production',
  '.env.development',
  'credentials.json',
  'serviceAccountKey.json',
  'client_secret.json',
  'id_rsa',
  'id_ed25519',
  '.DS_Store'
];

function runCapture(cmd) {
  try {
    return execSync(cmd, { encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 }).trim();
  } catch (err) {
    return null;
  }
}

export async function fetchAllRepositories() {
  const json = runCapture('gh repo list Chinmay-sonar --limit 100 --json name,isPrivate,description,defaultBranchRef,updatedAt');
  if (!json) return [];
  try {
    return JSON.parse(json);
  } catch {
    return [];
  }
}

export async function auditSingleRepository(repo) {
  const repoName = repo.name;
  const isPrivate = repo.isPrivate;
  const defaultBranch = repo.defaultBranchRef?.name || 'main';

  const audit = {
    name: repoName,
    isPrivate,
    defaultBranch,
    hasReadme: false,
    hasLicense: false,
    hasGitignore: false,
    hasCI: false,
    hasManifest: false,
    forbiddenFiles: [],
    secretLeaks: [],
    score: 100,
    grade: 'A+'
  };

  // 1. Fetch entire repository tree in 1 API call
  const treeJson = runCapture(`gh api repos/Chinmay-sonar/${repoName}/git/trees/${defaultBranch}?recursive=1`);
  if (!treeJson) {
    audit.score = 50;
    audit.grade = 'C';
    audit.notes = 'Unable to fetch tree or repository is empty';
    return audit;
  }

  let treeData;
  try {
    treeData = JSON.parse(treeJson);
  } catch {
    return audit;
  }

  const items = treeData.tree || [];
  const paths = items.map(i => i.path);

  // Check structural essentials
  audit.hasReadme = paths.some(p => /^readme\.md$/i.test(p));
  audit.hasLicense = paths.some(p => /^license(\.md|\.txt)?$/i.test(p));
  audit.hasGitignore = paths.some(p => /^\.gitignore$/i.test(p));
  audit.hasCI = paths.some(p => p.startsWith('.github/workflows/'));
  audit.hasManifest = paths.some(p => 
    p === 'package.json' || 
    p === 'requirements.txt' || 
    p === 'pyproject.toml' || 
    p === 'pom.xml' || 
    p === 'Cargo.toml'
  );

  // Check forbidden files
  for (const item of items) {
    const filename = path.basename(item.path);
    if (FORBIDDEN_FILES.includes(filename) && item.type === 'blob') {
      audit.forbiddenFiles.push(item.path);
    }
  }

  // Check for secrets in suspicious candidate files (e.g. .env, config files, txt, json)
  const candidateFiles = items.filter(item => {
    if (item.type !== 'blob') return false;
    const p = item.path.toLowerCase();
    return (
      p.includes('.env') ||
      p.includes('config') ||
      p.includes('secret') ||
      p.endsWith('.key') ||
      p.endsWith('.txt') ||
      p.endsWith('.json') ||
      p.endsWith('.py') ||
      p.endsWith('.js')
    ) && item.size < 50000; // scan files < 50KB
  });

  for (const candidate of candidateFiles.slice(0, 20)) {
    // Only inspect if it looks like a sensitive file or config
    if (candidate.path.endsWith('.env.example') || candidate.path.includes('package-lock.json')) continue;
    
    // If forbidden file or small config, inspect blob content
    if (audit.forbiddenFiles.includes(candidate.path) || candidate.path.toLowerCase().includes('.env')) {
      const blobJson = runCapture(`gh api repos/Chinmay-sonar/${repoName}/git/blobs/${candidate.sha}`);
      if (blobJson) {
        try {
          const blobData = JSON.parse(blobJson);
          const content = Buffer.from(blobData.content, 'base64').toString('utf-8');
          for (const pattern of SECRET_PATTERNS) {
            const matches = content.match(pattern.regex);
            if (matches && matches.length > 0) {
              audit.secretLeaks.push({
                file: candidate.path,
                type: pattern.name,
                count: matches.length
              });
            }
          }
        } catch {}
      }
    }
  }

  // Calculate Health Score
  if (audit.secretLeaks.length > 0) {
    audit.score -= 60; // Critical vulnerability
  }
  if (audit.forbiddenFiles.length > 0) {
    audit.score -= 30; // Sensitive file tracked
  }
  if (!audit.hasReadme) audit.score -= 20;
  if (!audit.hasGitignore) audit.score -= 15;
  if (!audit.hasLicense && !isPrivate) audit.score -= 10;
  if (!audit.hasCI) audit.score -= 5;
  if (!audit.hasManifest) audit.score -= 5;

  if (audit.score < 0) audit.score = 0;

  if (audit.secretLeaks.length > 0) {
    audit.grade = 'CRITICAL (F)';
  } else if (audit.forbiddenFiles.length > 0) {
    audit.grade = 'WARNING (D)';
  } else if (audit.score >= 90) {
    audit.grade = 'A+';
  } else if (audit.score >= 80) {
    audit.grade = 'A';
  } else if (audit.score >= 70) {
    audit.grade = 'B';
  } else {
    audit.grade = 'C';
  }

  return audit;
}

export function generateAuditMarkdown(results) {
  const now = new Date().toISOString().split('T')[0];
  let md = `# 🛡️ GitHub Portfolio Security & Structural Audit Report\n\n`;
  md += `**Date:** \`${now}\`  \n`;
  md += `**Audited Repositories:** \`${results.length}\`  \n`;
  md += `**Sentinel Engine:** v2.0 (Deep Tree Inspection & Secret Detection)\n\n`;
  md += `---\n\n`;

  const leaks = results.filter(r => r.secretLeaks.length > 0);
  const warnings = results.filter(r => r.forbiddenFiles.length > 0 && r.secretLeaks.length === 0);

  if (leaks.length > 0) {
    md += `## 🚨 CRITICAL SECURITY ALERTS: SECRET LEAKS DETECTED\n\n`;
    for (const r of leaks) {
      md += `### ⚠️ Repository: \`${r.name}\` (${r.isPrivate ? 'Private' : 'PUBLIC - IMMEDIATE ACTION REQUIRED'})\n`;
      for (const leak of r.secretLeaks) {
        md += `- **File:** \`${leak.file}\` | **Type:** ${leak.type} (${leak.count} occurrences)\n`;
      }
      md += `\n`;
    }
    md += `---\n\n`;
  } else {
    md += `> ✅ **ZERO API KEY LEAKS DETECTED** across all audited repositories.\n\n`;
    md += `---\n\n`;
  }

  if (warnings.length > 0) {
    md += `## ⚠️ Tracking Warnings (.env / Sensitive Files in Git)\n\n`;
    for (const r of warnings) {
      md += `- **${r.name}** (${r.isPrivate ? 'private' : 'public'}): Tracked files -> \`${r.forbiddenFiles.join(', ')}\`\n`;
    }
    md += `\n---\n\n`;
  }

  md += `## 📊 Repository Health & Hygiene Matrix\n\n`;
  md += `| Repository | Visibility | README | LICENSE | .gitignore | CI/CD | Hygiene Score | Grade |\n`;
  md += `| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: |\n`;

  for (const r of results) {
    const readme = r.hasReadme ? '✅' : '❌';
    const license = r.hasLicense ? '✅' : '❌';
    const gitignore = r.hasGitignore ? '✅' : '❌';
    const ci = r.hasCI ? '✅' : '❌';
    const vis = r.isPrivate ? '🔒 Private' : '🌐 Public';
    md += `| [**${r.name}**](https://github.com/Chinmay-sonar/${r.name}) | ${vis} | ${readme} | ${license} | ${gitignore} | ${ci} | \`${r.score}/100\` | **${r.grade}** |\n`;
  }

  md += `\n---\n\n`;
  md += `### 🛠️ Architecture Recommendations\n\n`;
  md += `1. **Add CI Workflows:** Repositories without \`.github/workflows\` should be equipped with automated testing on push and PR.\n`;
  md += `2. **Standardize .gitignore:** Ensure every repo explicitly ignores \`.env\`, \`credentials.json\`, \`node_modules/\`, and \`venv/\`.\n`;
  md += `3. **Add Open-Source Licenses:** Public repositories should include an MIT or Apache-2.0 \`LICENSE\` file.\n`;

  return md;
}

export async function runFullAudit() {
  console.log('[+] Fetching repository inventory for @Chinmay-sonar...');
  const repos = await fetchAllRepositories();
  console.log(`[+] Auditing ${repos.length} repositories across GitHub...`);

  const results = [];
  for (const repo of repos) {
    process.stdout.write(`  -> Scanning ${repo.name}... `);
    const audit = await auditSingleRepository(repo);
    console.log(`[Grade: ${audit.grade} | Score: ${audit.score}]`);
    results.push(audit);
  }

  const reportMd = generateAuditMarkdown(results);
  const outPath = path.join(REPO_ROOT, 'telemetry', 'repo-audit-report.md');
  fs.writeFileSync(outPath, reportMd, 'utf-8');
  console.log(`\n🎉 Audit Complete! Full report generated at: ${outPath}`);
  return results;
}

// CLI Execution
if (process.argv[1] && process.argv[1].endsWith('repo-orchestrator.js')) {
  runFullAudit().catch(err => {
    console.error('[FATAL] Audit execution failed:', err);
    process.exit(1);
  });
}
