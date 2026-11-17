/**
 * Autonomous Open-Source Intelligence Scout
 * Discovers high-leverage 'good first issue' and 'help wanted' opportunities
 * across the AI agent, TypeScript, and Python developer ecosystems.
 */

import fs from 'node:fs';
import path from 'node:path';

const SEARCH_QUERIES = [
  {
    category: '🧠 AI & Agent Systems',
    query: 'is:issue is:open label:"good first issue" agent'
  },
  {
    category: '⚡ TypeScript & Web Ecosystem',
    query: 'is:issue is:open label:"good first issue" language:typescript'
  },
  {
    category: '🐍 Python & Machine Learning',
    query: 'is:issue is:open label:"good first issue" language:python'
  }
];

export async function fetchGitHubIssues(query, token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN) {
  const url = `https://api.github.com/search/issues?q=${encodeURIComponent(query)}&sort=created&order=desc&per_page=5`;
  const headers = {
    'Accept': 'application/vnd.github.v3+json',
    'User-Agent': 'Chinmay-Sonar-OSS-Scout'
  };

  if (token) {
    headers['Authorization'] = `token ${token}`;
  }

  try {
    const res = await fetch(url, { headers });
    if (!res.ok) {
      console.warn(`[WARN] GitHub API returned status ${res.status} for query: ${query}`);
      return [];
    }
    const data = await res.json();
    return data.items || [];
  } catch (err) {
    console.error(`[ERROR] Failed to fetch issues for query: ${query}`, err.message);
    return [];
  }
}

export async function scoutAllCategories(token) {
  const results = {};
  for (const { category, query } of SEARCH_QUERIES) {
    const items = await fetchGitHubIssues(query, token);
    results[category] = items.map(item => {
      const repoUrl = item.repository_url || '';
      const repoName = repoUrl.replace('https://api.github.com/repos/', '');
      return {
        id: item.id,
        number: item.number,
        title: item.title,
        html_url: item.html_url,
        repo: repoName,
        repo_url: `https://github.com/${repoName}`,
        labels: (item.labels || []).map(l => l.name),
        comments: item.comments,
        created_at: item.created_at
      };
    });
  }
  return results;
}

export function formatIntelMarkdown(scoutData, dateStr) {
  let md = `# 🛰️ Daily Open-Source Intelligence Report\n\n`;
  md += `**Date:** \`${dateStr}\`  \n`;
  md += `**Autonomous Scout Engine:** v2.0 (Multi-Vector Ecosystem Discovery)\n\n`;
  md += `> Curated active 'good first issue' targets for open-source engineering, PR submissions, and collaborative problem-solving.\n\n`;
  md += `---\n\n`;

  for (const [category, issues] of Object.entries(scoutData)) {
    md += `### ${category}\n\n`;
    if (!issues || issues.length === 0) {
      md += `*No active unassigned issues matched criteria in this cycle.*\n\n`;
      continue;
    }

    md += `| Repository | Issue | Labels | PR Action Angle |\n`;
    md += `| :--- | :--- | :--- | :--- |\n`;

    for (const issue of issues.slice(0, 3)) {
      const labels = issue.labels.slice(0, 2).map(l => `\`${l}\``).join(' ') || '`help wanted`';
      const cleanTitle = issue.title.replace(/\|/g, '-').slice(0, 70);
      let angle = 'Bug fix & regression test';
      if (cleanTitle.toLowerCase().includes('doc') || cleanTitle.toLowerCase().includes('readme')) {
        angle = 'Docs & typing clarification';
      } else if (cleanTitle.toLowerCase().includes('test')) {
        angle = 'Automated unit test coverage';
      } else if (cleanTitle.toLowerCase().includes('type') || cleanTitle.toLowerCase().includes('interface')) {
        angle = 'TypeScript interface definition';
      }

      md += `| [**${issue.repo}**](${issue.repo_url}) | [#${issue.number}: ${cleanTitle}](${issue.html_url}) | ${labels} | ${angle} |\n`;
    }
    md += `\n`;
  }

  md += `---\n\n`;
  md += `### 🛠️ Execution Protocol for Target PRs\n\n`;
  md += `1. **Fork & Branch:** \`gh repo fork <target-repo> --clone && cd <repo> && git checkout -b fix/issue-<number>\`\n`;
  md += `2. **Implement & Test:** Run native test suites (\`npm test\` / \`pytest\`) and add regression specs.\n`;
  md += `3. **Submit PR:** \`gh pr create --title "fix: <summary>" --body "Closes #<number>"\`\n`;
  md += `\n*Telemetry generated autonomously by Chinmay Sonar Agent Infrastructure.*\n`;

  return md;
}

// CLI execution
if (process.argv[1] && process.argv[1].endsWith('oss-scout.js')) {
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  console.log('[+] Scouting live open-source issue ecosystems...');
  const data = await scoutAllCategories(token);
  const now = new Date().toISOString().split('T')[0];
  const markdown = formatIntelMarkdown(data, now);
  console.log(markdown);
}
