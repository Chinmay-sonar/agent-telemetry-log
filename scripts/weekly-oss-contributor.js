/**
 * Weekly Autonomous Open-Source Contributor Sentinel
 * Discovers, tracks, and assists in upstream open-source contributions
 * across AI agent and developer tool ecosystems.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fetchGitHubIssues } from './oss-scout.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');

// Tracked active upstream open-source contributions authored by @Chinmay-sonar
const ACTIVE_CONTRIBUTIONS = [
  {
    repo: 'SolokitStudio/agent-skills',
    prNumber: 6,
    prUrl: 'https://github.com/SolokitStudio/agent-skills/pull/6',
    title: 'docs: document Windsurf manual installation paths and usage',
    issueClosed: '#5',
    category: 'AI Agent Ecosystem',
    date: '2026-11-18'
  }
];

export async function runWeeklyOSSContributor() {
  const now = new Date();
  const dateStr = now.toISOString().split('T')[0];
  console.log(`[+] Executing Weekly Open-Source Contributor Pipeline for ${dateStr}...`);

  // 1. Scout High-Leverage Opportunities
  console.log('[+] Scouting fresh upstream issues for weekly contribution cycle...');
  const scoutedAI = await fetchGitHubIssues('is:issue is:open label:"good first issue" agent');
  const scoutedTS = await fetchGitHubIssues('is:issue is:open label:"good first issue" language:typescript');
  const scoutedPY = await fetchGitHubIssues('is:issue is:open label:"good first issue" language:python');

  // 2. Compile Weekly Upstream Intelligence Brief
  let md = `# 🌐 Weekly Open-Source Upstream Contribution Brief\n\n`;
  md += `**Cycle Date:** \`${dateStr}\`  \n`;
  md += `**Engineer / Contributor:** Chinmay Sonar (@Chinmay-sonar)  \n`;
  md += `**Engine:** Autonomous Upstream Contributor v2.0\n\n`;
  md += `> Dedicated pipeline tracking external public contributions, building in public, and driving ecosystem collaboration.\n\n`;
  md += `---\n\n`;

  md += `## 🚀 Active & Merged Upstream Open-Source Pull Requests\n\n`;
  md += `| Repository | Pull Request | Contribution Focus | Target Issue | Status |\n`;
  md += `| :--- | :--- | :--- | :---: | :---: |\n`;

  for (const item of ACTIVE_CONTRIBUTIONS) {
    md += `| [**${item.repo}**](https://github.com/${item.repo}) | [**#${item.prNumber}: ${item.title}**](${item.prUrl}) | ${item.category} | ${item.issueClosed} | 🟢 **OPEN / UNDER REVIEW** |\n`;
  }
  md += `\n---\n\n`;

  md += `## 🎯 Curated Weekly Open-Source Targets\n\n`;
  
  const categories = [
    { name: '🧠 Multi-Agent & AI Systems', items: scoutedAI },
    { name: '⚡ TypeScript & Web Ecosystem', items: scoutedTS },
    { name: '🐍 Python & Data Tooling', items: scoutedPY }
  ];

  for (const cat of categories) {
    md += `### ${cat.name}\n\n`;
    if (!cat.items || cat.items.length === 0) {
      md += `*No unassigned targets found this cycle.*\n\n`;
      continue;
    }
    for (const item of cat.items.slice(0, 3)) {
      const repoName = (item.repository_url || '').replace('https://api.github.com/repos/', '');
      md += `- [**${repoName}**](https://github.com/${repoName}) -> [#${item.number}: ${item.title}](${item.html_url})\n`;
    }
    md += `\n`;
  }

  md += `---\n\n`;
  md += `### 💡 Why Contributing Upstream Matters\n\n`;
  md += `1. **Ecosystem Credibility:** Proves you write code that meets external maintainers' quality gates and review standards.\n`;
  md += `2. **Public Graph Diversity:** Lifts your GitHub activity feed out of personal repos into major open-source organizations.\n`;
  md += `3. **Learning in Public:** Real-world collaborative engineering on production codebases.\n`;

  const briefPath = path.join(REPO_ROOT, 'telemetry', 'weekly-oss-brief.md');
  fs.writeFileSync(briefPath, md, 'utf-8');
  console.log(`[+] Wrote weekly OSS brief to: ${briefPath}`);
  return briefPath;
}

// CLI Execution
if (process.argv[1] && process.argv[1].endsWith('weekly-oss-contributor.js')) {
  runWeeklyOSSContributor().catch(err => {
    console.error('[FATAL] Weekly contributor failed:', err);
    process.exit(1);
  });
}
