const fs = require('fs');
const path = require('path');

try {
  // ビルド時刻を生成
  const buildTime = new Date().toISOString();

  // lib/build-time.tsを生成
  const buildTimeFile = path.join(__dirname, '..', 'lib', 'build-time.ts');
  const content = `// ビルド時に自動生成されるデプロイ時刻
// このファイルは自動生成されるため、手動で編集しないでください
export const BUILD_TIME = "${buildTime}";
`;

  // ディレクトリが存在することを確認
  const libDir = path.dirname(buildTimeFile);
  if (!fs.existsSync(libDir)) {
    fs.mkdirSync(libDir, { recursive: true });
  }

  fs.writeFileSync(buildTimeFile, content, 'utf8');
  console.log(`✓ Build time generated: ${buildTime}`);
} catch (error) {
  console.error('✗ Failed to generate build time:', error);
  process.exit(1);
}

