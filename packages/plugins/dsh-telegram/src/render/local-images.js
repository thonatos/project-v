// 从模型正文里提取「本地图片路径」。
//
// 背景：agent 生成图片后几乎不会用 attachment 产物登记，而是把路径写进正文，且写法
// 多样：markdown `![alt](/path.png)`、反引号 `` `/path.png` ``、或裸露的
// `路径：/path.png`。这里把这些形态里指向本地图片文件的路径都抽出来，交给 runtime 做
// 路径安全校验（realpath + workspace 包含）后读取并作为独立媒体发送。
//
// 只认扩展名为图片的路径；http(s)/data/协议相对等远程或内联数据一律跳过。安全不依赖
// 这里的宽松匹配——最终由 runtime 的 realpath/workspace 包含校验兜底，越界路径读不到。

const IMAGE_EXT = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.svg']);

// markdown 图片：![alt](path "title")，捕获 path。
const IMAGE_MD = /!\[[^\]]*\]\(\s*([^)\s]+)(?:\s+"[^"]*")?\s*\)/g;
// 反引号行内代码：`path`。捕获内容，随后按扩展名判断是否图片路径。
const INLINE_CODE = /`([^`\n]+)`/g;
// 裸路径：以 / . ~ 开头（真实文件路径特征）、以图片扩展名结尾、不含空白与引号括号
// 反引号的连续 token。要求路径起始字符，避免把中文前缀（如「路径：」）一并吞入。
const BARE_PATH = /(?:^|[\s，。、：:="'(<])([~./][^\s`）)"'<>，。、：]*\.(?:png|jpe?g|gif|webp|bmp|svg))\b/gi;

function isRemote(path) {
  return /^[a-z][a-z0-9+.-]*:\/\//i.test(path) || path.startsWith('data:') || path.startsWith('//');
}

function hasImageExt(path) {
  const dot = path.lastIndexOf('.');
  if (dot < 0) return false;
  return IMAGE_EXT.has(path.slice(dot).toLowerCase());
}

function decode(raw) {
  try {
    return decodeURIComponent(raw);
  } catch {
    // 非法转义序列：按原样返回，交给后续路径校验拒绝。
    return raw;
  }
}

// 从一段正文提取候选本地图片路径（去重、保序）。返回原始 path 字符串，
// 解码 %xx 与安全校验（realpath / workspace 包含）由调用方完成。
// 分阶段：先抽 markdown 图片与反引号行内代码，再把这些片段从文本中挖空，最后从
// 残余文本里抽裸路径——避免裸路径正则重复截取已被结构化语法消费的片段。
export function extractLocalImagePaths(text) {
  const input = typeof text === 'string' ? text : '';
  const seen = new Set();
  const paths = [];
  const add = (raw) => {
    if (!raw || isRemote(raw)) return;
    const decoded = decode(raw.trim());
    if (!hasImageExt(decoded) || isRemote(decoded)) return;
    if (seen.has(decoded)) return;
    seen.add(decoded);
    paths.push(decoded);
  };
  let residual = input;
  const consume = (regex) => {
    residual = residual.replace(regex, (_full, captured) => {
      add(captured);
      return ' '.repeat(_full.length); // 挖空为等长空白，保留后续匹配的边界。
    });
  };
  consume(IMAGE_MD);
  consume(INLINE_CODE);
  for (const match of residual.matchAll(BARE_PATH)) add(match[1]);
  return paths;
}
