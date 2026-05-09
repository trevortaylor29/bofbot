/**
 * Auth.js / NextAuth session via production host (no CORS in main process).
 * Flow: GET csrf → POST callback/credentials → reuse Cookie on /api/auth/session, /api/user/*
 */

/** Recognizable UA so server logs can distinguish desktop login attempts from web browsers. */
let DESKTOP_UA = "BofBot-Desktop";
try {
  const v = require("electron").app?.getVersion?.();
  if (v) DESKTOP_UA = `BofBot-Desktop/${v}`;
} catch {
  /* electron not available (tests) — fall back to base UA */
}

/**
 * @param {string} setCookieLine
 * @param {Record<string, string>} jar
 */
function applySetCookieLine(setCookieLine, jar) {
  const pair = setCookieLine.split(";")[0];
  const eq = pair.indexOf("=");
  if (eq === -1) return;
  const name = pair.slice(0, eq).trim();
  const value = pair.slice(eq + 1).trim();
  if (!name) return;
  jar[name] = value;
}

/** @param {Record<string, string>} jar */
function jarToCookieHeader(jar) {
  return Object.entries(jar)
    .map(([k, v]) => `${k}=${v}`)
    .join("; ");
}

/**
 * @param {import('node:fs').PathOrFileDescriptor} storePath
 */
function readJar(storePath, fs) {
  try {
    const raw = fs.readFileSync(storePath, "utf8");
    const data = JSON.parse(raw);
    return typeof data.cookieJar === "object" && data.cookieJar
      ? data.cookieJar
      : {};
  } catch {
    return {};
  }
}

/**
 * @param {import('node:fs').PathOrFileDescriptor} storePath
 * @param {Record<string, string>} jar
 */
function writeJar(storePath, fs, jar) {
  let prev = {};
  try {
    prev = JSON.parse(fs.readFileSync(storePath, "utf8"));
  } catch {
    /* empty */
  }
  prev.cookieJar = jar;
  fs.mkdirSync(require("path").dirname(storePath), { recursive: true });
  fs.writeFileSync(storePath, JSON.stringify(prev, null, 2), "utf8");
}

/**
 * @param {string} apiBase no trailing slash
 * @param {Record<string, string>} jar
 */
async function mergeSetCookiesFromResponse(res, jar) {
  const getSetCookie = res.headers.getSetCookie?.();
  if (getSetCookie && getSetCookie.length) {
    for (const line of getSetCookie) {
      applySetCookieLine(line, jar);
    }
    return;
  }
  const sc = res.headers.get("set-cookie");
  if (!sc) return;
  for (const line of sc.split(/,(?=[^;]+?=)/)) {
    applySetCookieLine(line.trim(), jar);
  }
}

/**
 * @param {object} opts
 * @param {string} opts.apiBase
 * @param {string} opts.storePath
 * @param {typeof import('fs')} opts.fs
 */
function createAuthApi({ apiBase, storePath, fs }) {
  let jar = readJar(storePath, fs);

  function persist() {
    writeJar(storePath, fs, jar);
  }

  async function login(email, password) {
    const csrfRes = await fetch(`${apiBase}/api/auth/csrf`, {
      redirect: "manual",
      headers: { "User-Agent": DESKTOP_UA },
    });
    await mergeSetCookiesFromResponse(csrfRes, jar);
    let csrfToken;
    try {
      const j = await csrfRes.json();
      csrfToken = j.csrfToken;
    } catch {
      csrfToken = null;
    }
    if (!csrfToken) {
      return { ok: false, error: "Could not load CSRF token from server." };
    }

    const body = new URLSearchParams({
      csrfToken,
      email: String(email).trim(),
      password: String(password),
      callbackUrl: `${apiBase}/dashboard`,
      json: "true",
    });

    let loginRes = await fetch(`${apiBase}/api/auth/callback/credentials`, {
      method: "POST",
      redirect: "manual",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": DESKTOP_UA,
        Cookie: jarToCookieHeader(jar),
      },
      body,
    });

    if (loginRes.status === 404) {
      loginRes = await fetch(`${apiBase}/api/auth/signin/credentials`, {
        method: "POST",
        redirect: "manual",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": DESKTOP_UA,
          Cookie: jarToCookieHeader(jar),
        },
        body,
      });
    }

    await mergeSetCookiesFromResponse(loginRes, jar);

    if (loginRes.status === 302 || loginRes.status === 200) {
      persist();
      const session = await getSession();
      if (session?.user) {
        return { ok: true, user: session.user };
      }
    }

    if (loginRes.status === 401 || loginRes.status === 400) {
      persist();
      return { ok: false, error: "Invalid email or password." };
    }

    persist();
    const session = await getSession();
    if (session?.user) {
      return { ok: true, user: session.user };
    }
    // HTTP status surfaces in support emails so we can distinguish "302 → no session"
    // from a 5xx without leaking endpoint URLs to end users.
    return {
      ok: false,
      error: `Sign-in failed (HTTP ${loginRes.status}). Check your email and password.`,
    };
  }

  function logout() {
    jar = {};
    persist();
    return { ok: true };
  }

  function loadJarFromDisk() {
    jar = readJar(storePath, fs);
  }

  async function getSession() {
    loadJarFromDisk();
    const h = jarToCookieHeader(jar);
    if (!h) return null;
    const res = await fetch(`${apiBase}/api/auth/session`, {
      headers: { Cookie: h, "User-Agent": DESKTOP_UA },
    });
    if (!res.ok) return null;
    try {
      const data = await res.json();
      return data;
    } catch {
      return null;
    }
  }

  async function getPlan() {
    loadJarFromDisk();
    const h = jarToCookieHeader(jar);
    if (!h) return { ok: false, error: "not_signed_in" };
    const res = await fetch(`${apiBase}/api/user/plan`, {
      headers: { Cookie: h, "User-Agent": DESKTOP_UA },
    });
    if (res.status === 401) {
      return { ok: false, error: "not_signed_in" };
    }
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      return { ok: false, error: t || `HTTP ${res.status}` };
    }
    const data = await res.json();
    return { ok: true, plan: data };
  }

  async function incrementUsage(amount = 1) {
    loadJarFromDisk();
    const h = jarToCookieHeader(jar);
    if (!h) return { ok: false, error: "not_signed_in" };
    const res = await fetch(`${apiBase}/api/user/increment-usage`, {
      method: "POST",
      headers: {
        Cookie: h,
        "Content-Type": "application/json",
        "User-Agent": DESKTOP_UA,
      },
      body: JSON.stringify({ amount }),
    });
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      return { ok: false, error: t || `HTTP ${res.status}` };
    }
    return { ok: true, ...(await res.json()) };
  }

  return {
    login,
    logout,
    getSession,
    getPlan,
    incrementUsage,
    getCookieHeader: () => jarToCookieHeader(readJar(storePath, fs)),
  };
}

module.exports = { createAuthApi, jarToCookieHeader };
