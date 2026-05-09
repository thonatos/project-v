import { ProxyAgent } from 'undici';
import fs from 'fs';

// 常量
export const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
export const PROXY = process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
export const API = TOKEN ? `https://api.telegram.org/bot${TOKEN}` : '';
export const CONFIG_FILE = 'commands-config.json';

// scope 定义
export const SCOPES = [
  { type: 'default', name: '默认' },
  { type: 'all_private_chats', name: '私聊' },
  { type: 'all_group_chats', name: '群聊' },
  { type: 'all_chat_administrators', name: '管理员' },
];

// 代理 agent
export const proxyAgent = PROXY ? new ProxyAgent(PROXY) : undefined;

// 检查环境变量
export function checkToken() {
  if (!TOKEN) {
    console.error('请设置环境变量 TELEGRAM_BOT_TOKEN');
    process.exit(1);
  }
}

// Telegram API 调用
export async function api(method, params = {}) {
  const url = `${API}/${method}`;
  const options = {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  };
  if (proxyAgent) {
    options.dispatcher = proxyAgent;
  }
  const res = await fetch(url, options);
  const data = await res.json();
  if (!data.ok) {
    throw new Error(`API 错误: ${JSON.stringify(data)}`);
  }
  return data.result;
}

// 获取 scope 参数
export function getScopeParam(scopeType) {
  return scopeType === 'default' ? {} : { scope: { type: scopeType } };
}

// 打印命令列表
export function printCommands(commands) {
  commands.forEach((c) => console.log(`  /${c.command} - ${c.description}`));
}

// 读取配置文件
export function readConfig() {
  if (!fs.existsSync(CONFIG_FILE)) {
    return null;
  }
  return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
}

// 写入配置文件
export function writeConfig(config) {
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
}
