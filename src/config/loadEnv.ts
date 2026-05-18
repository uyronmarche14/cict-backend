import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

const nodeEnv = process.env.NODE_ENV || 'development';
const cwd = process.cwd();

const envFiles = [
  '.env',
  `.env.${nodeEnv}`,
  '.env.local',
  `.env.${nodeEnv}.local`,
];

for (const envFile of envFiles) {
  const fullPath = path.join(cwd, envFile);

  if (!fs.existsSync(fullPath)) {
    continue;
  }

  dotenv.config({
    path: fullPath,
    override: true,
  });
}
