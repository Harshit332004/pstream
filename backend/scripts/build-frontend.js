const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '../..');
const frontendDir = path.join(projectRoot, 'frontend');
const frontendDist = path.join(frontendDir, 'dist');
const backendPublic = path.resolve(__dirname, '../public');

console.log('Building frontend...');
try {
  execSync('npm run build', {
    cwd: frontendDir,
    stdio: 'inherit',
    env: { ...process.env, NODE_ENV: 'production' }
  });
  console.log('Frontend built successfully.');

  console.log(`Cleaning target directory: ${backendPublic}`);
  fs.rmSync(backendPublic, { recursive: true, force: true });
  
  console.log(`Copying built frontend from ${frontendDist} to ${backendPublic}...`);
  fs.cpSync(frontendDist, backendPublic, { recursive: true });
  console.log('Frontend build copied successfully to backend public directory!');
} catch (error) {
  console.error('Error building frontend:', error);
  process.exit(1);
}
