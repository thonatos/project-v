import {
  checkToken,
  PROXY,
  SCOPES,
  api,
  getScopeParam,
  printCommands,
  readConfig,
  writeConfig,
  CONFIG_FILE,
} from './lib.js';

// 获取当前 commands
async function fetchCommands() {
  console.log('获取当前 commands...\n');

  if (PROXY) {
    console.log(`使用代理: ${PROXY}\n`);
  }

  const config = {};

  for (const scope of SCOPES) {
    const scopeParam = getScopeParam(scope.type);
    const commands = await api('getMyCommands', scopeParam);
    config[scope.type] = commands;
    console.log(`${scope.name} (${scope.type}): ${commands.length} 个命令`);
    printCommands(commands);
  }

  writeConfig(config);
  console.log(`\n已保存到 ${CONFIG_FILE}`);
}

// 更新 commands
async function updateCommands() {
  const config = readConfig();

  if (!config) {
    console.error(`配置文件 ${CONFIG_FILE} 不存在，请先运行 fetch`);
    process.exit(1);
  }

  if (PROXY) {
    console.log(`使用代理: ${PROXY}\n`);
  }

  console.log('读取配置文件并更新 commands...\n');

  for (const scope of SCOPES) {
    const commands = config[scope.type] || [];
    const scopeParam = getScopeParam(scope.type);

    console.log(`设置 ${scope.name} (${scope.type}): ${commands.length} 个命令`);
    printCommands(commands);

    if (commands.length > 0) {
      await api('setMyCommands', { ...scopeParam, commands });
    } else {
      // 空命令列表则删除该 scope 的 commands
      await api('deleteMyCommands', scopeParam);
    }
    console.log('  ✓ 已更新');
  }

  console.log('\n完成！');
}

// CLI 入口
async function main() {
  const command = process.argv[2];

  if (!command || (command !== 'fetch' && command !== 'update')) {
    console.log('用法:');
    console.log('  node cli.js fetch   - 获取当前 Bot commands 并保存到配置文件');
    console.log('  node cli.js update  - 从配置文件读取并更新 Bot commands');
    process.exit(1);
  }

  checkToken();

  if (command === 'fetch') {
    await fetchCommands();
  } else {
    await updateCommands();
  }
}

main().catch(console.error);
