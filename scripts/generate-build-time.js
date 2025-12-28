const fs = require('fs');
const path = require('path');

// ビルド時刻を生成
const buildTime = new Date().toISOString();

// lib/build-time.tsを生成
const buildTimeFile = path.join(__dirname, '..', 'lib', 'build-time.ts');
const content = `// ビルド時に自動生成されるデプロイ時刻
// このファイルは自動生成されるため、手動で編集しないでください
export const BUILD_TIME = "${buildTime}";
`;

fs.writeFileSync(buildTimeFile, content, 'utf8');
console.log(`Build time generated: ${buildTime}`);

