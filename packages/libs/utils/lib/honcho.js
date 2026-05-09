import jwt from 'jsonwebtoken';

/**
 * 返回当前 UTC ISO 时间字符串。
 *
 * @returns {string} 当前时间的 ISO 8601 字符串，例如 "2026-05-09T12:34:56.789Z"
 */
export function utcNowIso() {
  return new Date().toISOString();
}

/**
 * 解析并校验 ISO 时间字符串。
 *
 * @param {string} value - ISO 8601 时间字符串
 * @returns {Date} 解析后的 Date 对象
 * @throws {Error} 当 value 不是合法时间字符串时抛出异常
 */
export function parseIsoDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error('Invalid ISO datetime');
  }
  return date;
}

/**
 * 创建 Honcho JWT。
 *
 * 对齐 Python 中的 JWTParams 字段：
 * - t: 创建时间
 * - exp: 过期时间
 * - ad: 是否为管理员令牌
 * - w: workspace name
 * - p: peer name
 * - s: session name
 *
 * 注意：
 * - exp 使用 ISO 8601 字符串，不是标准 JWT 的数字时间戳
 * - 所有值为 undefined 或 null 的字段都不会写入 payload
 *
 * @param {string} secret - JWT 签名密钥，对应 AUTH_JWT_SECRET
 * @param {Object} [options={}] - JWT 参数对象
 * @param {string} [options.t] - 创建时间
 *   - 类型: string
 *   - 格式: ISO 8601 字符串
 *   - 默认值: 当前 UTC 时间，即 new Date().toISOString()
 * @param {string} [options.exp] - 过期时间
 *   - 类型: string
 *   - 格式: ISO 8601 字符串
 *   - 默认值: undefined
 *   - 可选参数
 *   - 注意: 不是标准 JWT exp claim
 * @param {boolean} [options.ad] - 是否为管理员令牌
 *   - 类型: boolean
 *   - 可选值: true | false
 *   - 默认值: undefined
 *   - 可选参数，不传时不会写入 payload
 *   - true 表示 admin JWT
 *   - false 表示显式非 admin JWT
 * @param {string} [options.w] - workspace name
 *   - 类型: string
 *   - 默认值: undefined
 *   - 可选参数
 * @param {string} [options.p] - peer name
 *   - 类型: string
 *   - 默认值: undefined
 *   - 可选参数
 * @param {string} [options.s] - session name
 *   - 类型: string
 *   - 默认值: undefined
 *   - 可选参数
 * @returns {string} 签名后的 JWT 字符串
 * @throws {Error} 当 secret 为空时抛出异常
 */
export function createHonchoJwt(secret, { t, exp, ad, w, p, s } = {}) {
  if (!secret) {
    throw new Error('AUTH_JWT_SECRET is not set, cannot create JWT.');
  }

  const payload = {
    t: t ?? utcNowIso(),
    exp,
    ad,
    w,
    p,
    s,
  };

  const cleanedPayload = Object.fromEntries(
    Object.entries(payload).filter(([, value]) => value !== undefined && value !== null),
  );

  return jwt.sign(cleanedPayload, Buffer.from(secret, 'utf-8'), {
    algorithm: 'HS256',
    noTimestamp: true,
  });
}

/**
 * 创建管理员 JWT。
 *
 * 对齐 Python 逻辑：
 * JWTParams(t="", ad=True)
 *
 * @param {string} secret - JWT 签名密钥，对应 AUTH_JWT_SECRET
 * @returns {string} 管理员 JWT 字符串
 * @throws {Error} 当 secret ���空时抛出异常
 */
export function createAdminJwt(secret) {
  return createHonchoJwt(secret, {
    t: '',
    ad: true,
  });
}

/**
 * 验证 Honcho JWT 并返回解析后的参数。
 *
 * 注意：
 * - 会先校验 JWT 签名
 * - exp 按照 Honcho 的自定义逻辑处理
 * - exp 必须是 ISO 8601 字符串
 * - 如果 exp 早于当前时间，则抛出 "JWT expired"
 *
 * @param {string} secret - JWT 签名密钥，对应 AUTH_JWT_SECRET
 * @param {string} token - 待验证的 JWT 字符串
 * @returns {{
 *   t: string,
 *   exp: string | null,
 *   ad: boolean | null,
 *   w: string | null,
 *   p: string | null,
 *   s: string | null
 * }} 解析后的 JWT 参数对象
 * @throws {Error} 当 secret 为空时抛出异常
 * @throws {Error} 当 token 无效时抛出 "Invalid JWT"
 * @throws {Error} 当 token 已过期时抛出 "JWT expired"
 */
export function verifyHonchoJwt(secret, token) {
  if (!secret) {
    throw new Error('AUTH_JWT_SECRET is not set, cannot verify JWT.');
  }

  try {
    const decoded = jwt.verify(token, Buffer.from(secret, 'utf-8'), {
      algorithms: ['HS256'],
    });

    const params = {
      t: utcNowIso(),
      exp: null,
      ad: null,
      w: null,
      p: null,
      s: null,
    };

    if ('t' in decoded) {
      params.t = decoded.t;
    }

    if ('exp' in decoded) {
      params.exp = decoded.exp;
      if (params.exp) {
        const expTime = parseIsoDate(params.exp);
        const currentTime = new Date();
        if (expTime < currentTime) {
          throw new Error('JWT expired');
        }
      }
    }

    if ('ad' in decoded) {
      params.ad = decoded.ad;
    }

    if ('w' in decoded) {
      params.w = decoded.w;
    }

    if ('p' in decoded) {
      params.p = decoded.p;
    }

    if ('s' in decoded) {
      params.s = decoded.s;
    }

    return params;
  } catch (err) {
    if (err.message === 'JWT expired') {
      throw err;
    }
    throw new Error('Invalid JWT');
  }
}
