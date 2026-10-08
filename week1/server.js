// KWEB Cloud Study 2026-2 — Week 1 sample app
// "컨테이너 안에서 나는 누구인가"를 보여주는 작은 서버입니다.
const express = require("express");
const fs = require("fs");
const os = require("os");

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || "0.0.0.0";
const GREETING = process.env.GREETING || "Hello from a container!";
const startedAt = new Date();

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
    }
  }
  return "알 수 없음 (cgroup 정보 없음)";
}

function info() {
  return {
    greeting: GREETING,
    hostname: os.hostname(),
    pid: process.pid,
    node: process.version,
    platform: `${os.type()} ${os.release()} (${os.arch()})`,
    memoryLimit: memoryLimit(),
    uptimeSec: Math.round(process.uptime()),
    startedAt: startedAt.toISOString(),
  };
}

const app = express();

app.get("/api/info", (req, res) => res.json(info()));

app.get("/healthz", (req, res) => res.send("ok"));

app.get("/", (req, res) => {
  const i = info();
  const row = (k, v, hint = "") =>
    `<tr><th>${k}</th><td>${v}</td><td class="hint">${hint}</td></tr>`;
  res.send(`<!doctype html>
<html lang="ko"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>KWEB Cloud Study · Week 1</title>
<style>
  body { margin: 0; font-family: system-ui, sans-serif; background: #F7F5F0; color: #23201C; }
  main { max-width: 760px; margin: 48px auto; padding: 0 16px; }
  h1 { font-size: 28px; margin: 0 0 4px; }
  .sub { color: #5E5850; margin: 0 0 28px; }
  table { width: 100%; border-collapse: collapse; background: #FFFDF9; border: 1px solid #E7E2D8; }
  th, td { text-align: left; padding: 10px 14px; border-top: 1px solid #E7E2D8; vertical-align: top; }
  th { width: 130px; color: #AE5E22; font-weight: 600; }
  td { font-family: ui-monospace, monospace; }
  .hint { color: #9A9389; font-family: system-ui, sans-serif; font-size: 13px; }
</style></head>
<body><main>
  <h1>${escapeHtml(i.greeting)}</h1>
  <p class="sub">KWEB Cloud Study · Week 1 — 컨테이너 안에서 본 나</p>
  <table>
    ${row("hostname", i.hostname, "컨테이너 ID 앞자리와 비교해 보세요 (docker ps)")}
    ${row("pid", i.pid, "컨테이너 안에서는 1번일 거예요. 호스트에서 ps로도 찾아보세요")}
    ${row("memory limit", i.memoryLimit, "docker run -m 64m 으로 띄우면 바뀝니다 (cgroup)")}
    ${row("node", i.node, "이미지의 FROM에 따라 달라집니다")}
    ${row("platform", i.platform, "커널은 호스트와 같다는 점에 주목")}
    ${row("uptime", i.uptimeSec + "s", "")}
  </table>
</main></body></html>`);
});

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

const server = app.listen(PORT, HOST, () => {
  console.log(`listening on http://${HOST}:${PORT} (pid ${process.pid})`);
});

// PID 1은 기본 시그널 처리가 없어서, 직접 받지 않으면 docker stop이 10초를 기다린 뒤 강제 종료합니다.
for (const sig of ["SIGTERM", "SIGINT"]) {
  process.on(sig, () => {
    console.log(`${sig} 받음, 종료합니다`);
    server.close(() => process.exit(0));
  });
}
