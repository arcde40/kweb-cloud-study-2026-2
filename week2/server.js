// KWEB Cloud Study 2026-2 — Week 2 sample app
// 1주차 앱 + Postgres 방문 수 카운터
const express = require("express");
const fs = require("fs");
const os = require("os");
const { Pool } = require("pg");

const PORT = Number(process.env.PORT) || 3000;
// 127.0.0.1로 바꾸면 컨테이너 밖에서 접속이 안 됩니다.
const HOST = process.env.HOST || "0.0.0.0";
const GREETING = process.env.GREETING || "Hello from a container!";
const startedAt = new Date();

// ---- DB 설정 -------------------------------------------------------------
// DB_HOST가 없으면 DB 없이 동작합니다 (1주차처럼).
// 같은 도커 네트워크 안이라면 DB_HOST에 "컨테이너 이름"을 넣으면 됩니다.
const DB_HOST = process.env.DB_HOST;
const pool = DB_HOST
  ? new Pool({
      host: DB_HOST,
      port: Number(process.env.DB_PORT) || 5432,
      user: process.env.DB_USER || "postgres",
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME || "postgres",
      connectionTimeoutMillis: 2000,
      max: 5,
    })
  : null;

// DB가 재시작되면 쉬고 있던 연결에서 에러 이벤트가 옵니다.
// 받아 주지 않으면 Node 프로세스(= 컨테이너)가 통째로 죽습니다.
if (pool) pool.on("error", (err) => console.error("DB 연결 끊김:", err.code || err.message));

let tableReady = false;
async function ensureTable() {
  if (tableReady) return;
  // DB가 앱보다 늦게 떠도 괜찮도록, 시작할 때가 아니라 첫 요청 때 테이블을 만듭니다.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS visits (
      id        SERIAL PRIMARY KEY,
      hostname  TEXT        NOT NULL,
      at        TIMESTAMPTZ NOT NULL DEFAULT now()
    )`);
  tableReady = true;
}

// DB 작업을 한 번 실행하고, 실패하면 한 번만 다시 시도합니다.
// DB 컨테이너를 지웠다 새로 띄우면 ① 기존 연결이 끊겨 있고 ② 새 DB엔 테이블이 없어서
// 첫 시도가 실패할 수 있기 때문입니다. (테이블은 다시 만들도록 tableReady를 되돌림)
async function withDb(work) {
  if (!pool) return { ok: false, reason: "DB_HOST가 설정되지 않았습니다" };
  for (let attempt = 1; ; attempt++) {
    try {
      await ensureTable();
      return { ok: true, ...(await work()) };
    } catch (err) {
      tableReady = false;
      if (attempt >= 2) {
        return { ok: false, reason: `DB 연결 실패: ${err.code || ""} ${err.message}`.trim() };
      }
    }
  }
}

// 방문 기록 1건 추가 후 전체 수 반환
function recordVisit() {
  return withDb(async () => {
    await pool.query("INSERT INTO visits (hostname) VALUES ($1)", [os.hostname()]);
    const { rows } = await pool.query("SELECT count(*)::int AS n FROM visits");
    return { count: rows[0].n };
  });
}

function visitStats() {
  return withDb(async () => {
    const { rows } = await pool.query(`
      SELECT hostname, count(*)::int AS visits, max(at) AS last
      FROM visits GROUP BY hostname ORDER BY last DESC`);
    const total = rows.reduce((s, r) => s + r.visits, 0);
    return { total, byHost: rows };
  });
}

// ---- 컨테이너 정보 ---------------------------------------------------------
// cgroup이 이 프로세스에 걸어 둔 메모리 상한 (v2 → v1 순서로 확인)
function memoryLimit() {
  const candidates = [
    "/sys/fs/cgroup/memory.max",
    "/sys/fs/cgroup/memory/memory.limit_in_bytes",
  ];
  for (const path of candidates) {
    try {
      const raw = fs.readFileSync(path, "utf8").trim();
      if (raw === "max" || Number(raw) > 1e15) return "제한 없음";
      return `${Math.round(Number(raw) / 1024 / 1024)} MiB`;
    } catch {
      /* 다음 후보 */
    }
  }
  return "알 수 없음 (cgroup 정보 없음)";
}

function info() {
  return {
    greeting: GREETING,
    hostname: os.hostname(),
    pid: process.pid,
    uid: typeof process.getuid === "function" ? process.getuid() : null,
    node: process.version,
    platform: `${os.type()} ${os.release()} (${os.arch()})`,
    memoryLimit: memoryLimit(),
    uptimeSec: Math.round(process.uptime()),
    startedAt: startedAt.toISOString(),
    db: DB_HOST ? `${DB_HOST}:${Number(process.env.DB_PORT) || 5432}` : null,
  };
}

// ---- 라우트 ---------------------------------------------------------------
const app = express();

app.get("/api/info", (req, res) => res.json(info()));

app.get("/api/visits", async (req, res) => {
  const stats = await visitStats();
  res.status(stats.ok ? 200 : 503).json(stats);
});

// 나중에 쿠버네티스 probe에서 씁니다 (W7)
app.get("/healthz", (req, res) => res.send("ok"));

app.get("/", async (req, res) => {
  const i = info();
  const v = await recordVisit();
  const row = (k, val, hint = "", cls = "") =>
    `<tr><th>${k}</th><td class="${cls}">${escapeHtml(val)}</td><td class="hint">${hint}</td></tr>`;
  const visitsCell = v.ok
    ? row("visits", `${v.count}번째 방문`, "DB 컨테이너를 지웠다 다시 띄워도 남아 있나요?", "big")
    : row("visits", v.reason, "DB 없이도 앱은 돌아갑니다. DB_HOST를 설정해 보세요", "err");

  res.send(`<!doctype html>
<html lang="ko"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>KWEB Cloud Study · Week 2</title>
<style>
  body { margin: 0; font-family: system-ui, sans-serif; background: #F7F5F0; color: #23201C; }
  main { max-width: 760px; margin: 48px auto; padding: 0 16px; }
  h1 { font-size: 28px; margin: 0 0 4px; }
  .sub { color: #5E5850; margin: 0 0 28px; }
  table { width: 100%; border-collapse: collapse; background: #FFFDF9; border: 1px solid #E7E2D8; }
  th, td { text-align: left; padding: 10px 14px; border-top: 1px solid #E7E2D8; vertical-align: top; }
  th { width: 130px; color: #AE5E22; font-weight: 600; }
  td { font-family: ui-monospace, monospace; word-break: break-all; }
  td.big { font-size: 20px; font-weight: 700; }
  td.err { color: #A33; }
  .hint { color: #9A9389; font-family: system-ui, sans-serif; font-size: 13px; }
</style></head>
<body><main>
  <h1>${escapeHtml(i.greeting)}</h1>
  <p class="sub">KWEB Cloud Study · Week 2 — 컨테이너 여러 개를 엮어 보기</p>
  <table>
    ${visitsCell}
    ${row("db", i.db || "(없음)", "같은 네트워크면 컨테이너 이름으로 찾아갑니다")}
    ${row("hostname", i.hostname, "컨테이너 ID 앞자리와 비교해 보세요 (docker ps)")}
    ${row("pid", String(i.pid), "컨테이너 안에서는 1번")}
    ${row("uid", String(i.uid), "0이면 root로 돌고 있는 것. Dockerfile에 USER node를 넣으면?")}
    ${row("memory limit", i.memoryLimit, "docker run -m 64m 으로 바뀝니다 (cgroup)")}
    ${row("node", i.node, "이미지의 FROM에 따라 달라집니다")}
    ${row("platform", i.platform, "커널은 호스트와 같습니다")}
  </table>
</main></body></html>`);
});

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

const server = app.listen(PORT, HOST, () => {
  console.log(`listening on http://${HOST}:${PORT} (pid ${process.pid}, db: ${DB_HOST || "none"})`);
});

// PID 1은 기본 시그널 처리가 없어서, 직접 받지 않으면 docker stop이 10초를 기다린 뒤 강제 종료합니다.
for (const sig of ["SIGTERM", "SIGINT"]) {
  process.on(sig, () => {
    console.log(`${sig} 받음, 종료합니다`);
    server.close(async () => {
      if (pool) await pool.end().catch(() => {});
      process.exit(0);
    });
  });
}
