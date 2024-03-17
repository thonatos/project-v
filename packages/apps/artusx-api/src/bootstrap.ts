import fs from 'fs-extra';
import path from 'path';
import dotenv from 'dotenv';
import { Application } from '@artusx/utils';

dotenv.config();

export const main = async () => {
  const app = await Application.start({
    root: path.resolve(__dirname),
    configDir: 'config',
  });

  // ensure cache dir
  const cacheDir = app.config.cache.cacheDir;
  fs.ensureDirSync(cacheDir);

  // empty cache dir
  fs.emptyDirSync(cacheDir);

  return app;
};
