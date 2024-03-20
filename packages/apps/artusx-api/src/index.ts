import fs from 'fs-extra';
import path from 'path';
import { bootstrap } from '@artusx/utils';

const ROOT_DIR = path.resolve(__dirname);

bootstrap({ root: ROOT_DIR }).then((app) => {
  const cacheDir = app.config.cache.cacheDir;

  // ensure cache dir
  fs.ensureDirSync(cacheDir);

  // empty cache dir
  fs.emptyDirSync(cacheDir);
});
