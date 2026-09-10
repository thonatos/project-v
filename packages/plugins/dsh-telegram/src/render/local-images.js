// 从模型正文里提取「本地图片路径」。
//
// 背景：agent 生成图片后几乎不会用 attachment 产物登记，而是把路径写进正文，且写法
// 只从明确的富媒体语法中提取图片：markdown `![alt](/path.png)` 与本地图片链接
// `[下载](./path.png)`。行内代码和裸路径只是文件引用，不能推断为“发送图片”。
//
// 只认扩展名为图片的路径；http(s)/data/协议相对等远程或内联数据一律跳过。安全不依赖
// 这里的宽松匹配——最终由 runtime 的 realpath/workspace 包含校验兜底，越界路径读不到。

const IMAGE_EXT = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.svg']);

// markdown 图片：![alt](path "title")，捕获 path。
const IMAGE_MD = /!\[[^\]]*\]\(\s*([^)\s]+)(?:\s+"[^"]*")?\s*\)/g;
// dsh Web 会把这种本地图片链接显示为附件预览；Telegram 侧也将其提升为原生 photo。
const LINK_MD = /\[([^\]]*)\]\(\s*([^)\s]+)(?:\s+"[^"]*")?\s*\)/g;

function isRemote(path) {
  return /^[a-z][a-z0-9+.-]*:\/\//i.test(path) || path.startsWith('data:') || path.startsWith('//');
}

function hasImageExt(path) {
  const dot = path.lastIndexOf('.');
  if (dot < 0) return false;
  return IMAGE_EXT.has(path.slice(dot).toLowerCase());
}

function localImagePath(raw) {
  if (!raw || isRemote(raw)) return null;
  const decoded = decode(raw.trim());
  return hasImageExt(decoded) && !isRemote(decoded) ? decoded : null;
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
// 分阶段消费两种结构化语法，避免普通链接再次被 markdown 图片规则匹配。
export function extractLocalImagePaths(text) {
  const input = typeof text === 'string' ? text : '';
  const seen = new Set();
  const paths = [];
  const add = (raw) => {
    const decoded = localImagePath(raw);
    if (!decoded) return;
    if (seen.has(decoded)) return;
    seen.add(decoded);
    paths.push(decoded);
  };
  const consume = (regex) => {
    input.replace(regex, (_full, captured) => {
      add(captured);
      return _full;
    });
  };
  consume(IMAGE_MD);
  input.replace(LINK_MD, (_full, _label, path) => {
    add(path);
    return _full;
  });
  return paths;
}

export function extractLocalImageLinks(text) {
  const paths = [];
  for (const match of String(text ?? '').matchAll(LINK_MD)) {
    const path = localImagePath(match[2]);
    if (path && !paths.includes(path)) paths.push(path);
  }
  return paths;
}

// 把指向本地图片的普通 markdown 链接降为标签文本，作为 Telegram photo caption。
// 远程图片和非图片链接保持原样，不改变正常链接行为。
export function stripLocalImageLinks(text) {
  return String(text ?? '').replace(LINK_MD, (full, label, path) => (localImagePath(path) ? label : full));
}
