import path from 'node:path';
import { bootstrap } from '@artusx/utils';
import fs from 'fs-extra';

const ROOT_DIR = path.resolve(__dirname);

bootstrap({ root: ROOT_DIR }).then((app) => {
  const cacheDir = app.config.cache.cacheDir;

  // ensure cache dir
  fs.ensureDirSync(cacheDir);

  // empty cache dir
  fs.emptyDirSync(cacheDir);
});
