export function parseCookies(header = '') {
  const cookies = {};
  for (const part of String(header).split(';')) {
    const index = part.indexOf('=');
    if (index < 0) continue;
    const name = part.slice(0, index).trim();
    if (!name) continue;
    let value = part.slice(index + 1).trim();
    try {
      value = decodeURIComponent(value);
    } catch {
      // keep the raw value
    }
    cookies[name] = value;
  }
  return cookies;
}

export function serializeCookie(name, value, options = {}) {
  let cookie = `${name}=${encodeURIComponent(value)}`;
  if (options.maxAge !== undefined) cookie += `; Max-Age=${Math.floor(options.maxAge)}`;
  cookie += `; Path=${options.path || '/'}`;
  if (options.httpOnly !== false) cookie += '; HttpOnly';
  cookie += `; SameSite=${options.sameSite || 'Lax'}`;
  if (options.secure) cookie += '; Secure';
  return cookie;
}
