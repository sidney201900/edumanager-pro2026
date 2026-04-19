import fs from 'fs';
import path from 'path';

const dir = 'c:\\Users\\Professor\\Desktop\\portalaluno\\src';

const replacements = [
  { regex: /#6366f1/ig, replace: "var(--color-primary)" },
  { regex: /#818cf8/ig, replace: "var(--color-primary-light)" },
  { regex: /#4f46e5/ig, replace: "var(--color-primary-dark)" },
  { regex: /#06b6d4/ig, replace: "var(--color-accent)" },
  { regex: /#22d3ee/ig, replace: "var(--color-accent-light)" },
  { regex: /#34d399/ig, replace: "var(--color-success)" },
  { regex: /#fbbf24/ig, replace: "var(--color-warning)" },
  { regex: /#f87171/ig, replace: "var(--color-danger)" },
  { regex: /'#1a1a1a'/ig, replace: "'var(--color-text)'" },
  { regex: /rgba\(99,\s*102,\s*241,\s*0\.1[25]\)/ig, replace: "var(--bg-primary-alpha)" },
  { regex: /rgba\(6,\s*182,\s*212,\s*0\.15?\)/ig, replace: "var(--bg-accent-alpha)" },
  { regex: /rgba\(239,\s*68,\s*68,\s*0\.1[25]\)/ig, replace: "var(--bg-danger-alpha)" },
  { regex: /rgba\(16,\s*185,\s*129,\s*0\.1[25]\)/ig, replace: "var(--bg-success-alpha)" },
  { regex: /rgba\(245,\s*158,\s*11,\s*0\.1[25]\)/ig, replace: "var(--bg-warning-alpha)" },
  { regex: /rgba\(245,\s*158,\s*11,\s*0\.2\)/ig, replace: "var(--bg-warning-alpha)" },
  { regex: /rgba\(234,\s*179,\s*8,\s*0\.1\)/ig, replace: "var(--bg-warning-alpha)" },
  { regex: /rgba\(0,\s*0,\s*0,\s*0\.[67]\)/ig, replace: "var(--overlay-bg)" },
  { regex: /rgba\(239,\s*68,\s*68,\s*0\.3\)/ig, replace: "var(--border-danger-alpha)" },
  { regex: /rgba\(16,\s*185,\s*129,\s*0\.3\)/ig, replace: "var(--border-success-alpha)" },
  // gradients:
  { regex: /linear-gradient\(180deg, #0c1222 0%, #131b2e 50%, #0f172a 100%\)/g, replace: "var(--gradient-sidebar)" },
  { regex: /linear-gradient\(135deg, #0c1222 0%, #1a1040 50%, #0f172a 100%\)/g, replace: "var(--gradient-login)" },
  { regex: /linear-gradient\(135deg, rgba\(245,158,11,0\.2\) 0%, rgba\(234,179,8,0\.1\) 100%\)/g, replace: "var(--gradient-warning)" },
  // header:
  { regex: /rgba\(15, 23, 42, 0\.9\)/g, replace: "var(--header-bg)" },
];

function processDir(dirPath) {
  const files = fs.readdirSync(dirPath);
  for (const file of files) {
    const fullPath = path.join(dirPath, file);
    if (fs.statSync(fullPath).isDirectory()) {
      processDir(fullPath);
    } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      let changed = false;
      for (const { regex, replace } of replacements) {
        if (regex.test(content)) {
          content = content.replace(regex, replace);
          changed = true;
        }
      }
      
      // special cases for template strings
      if (content.includes("`rgba(${avg >= 7 ? '16,185,129' : avg >= 5 ? '245,158,11' : '239,68,68'}, 0.15)`")) {
          content = content.replace(
              "`rgba(${avg >= 7 ? '16,185,129' : avg >= 5 ? '245,158,11' : '239,68,68'}, 0.15)`",
              "avg >= 7 ? 'var(--bg-success-alpha)' : avg >= 5 ? 'var(--bg-warning-alpha)' : 'var(--bg-danger-alpha)'"
          );
          changed = true;
      }
      
      if (changed) {
        fs.writeFileSync(fullPath, content);
        console.log(`Updated ${file}`);
      }
    }
  }
}

processDir(dir);
