# KWEB Cloud Study 2026-2 — 샘플 앱

7주 동안 키워 갈 작은 Node.js(Express) 서버입니다.
1주차 목표는 **이 앱을 Dockerfile로 감싸서 컨테이너로 띄우는 것**입니다.

| 경로 | 내용 |
|---|---|
| `/` | 컨테이너 안에서 본 정보 (hostname, PID, 메모리 상한 …) |
| `/api/info` | 같은 정보를 JSON으로 |
| `/healthz` | `ok` — 7주차 probe에서 씁니다 |

환경변수: `PORT`(기본 3000), `HOST`(기본 0.0.0.0), `GREETING`(첫 줄 문구)

---

## 1주차 실습

내 번호가 **N번**이면 호스트 포트는 **N000–N999** 중에서 고릅니다. (로그인할 때 안내가 나옵니다)

### 1. clone
```bash
git clone https://github.com/arcde40/kweb-cloud-study-2026-2.git
cd kweb-cloud-study-2026-2
```

### 2. Dockerfile + .dockerignore 작성
이 폴더에 `Dockerfile`과 `.dockerignore`를 직접 만드세요. 슬라이드의 예시를 참고해도 됩니다.

### 3. build
```bash
docker build -t my-app .
```

### 4. run
```bash
docker run -d --name my-app -p N000:3000 my-app
docker ps                  # STATUS가 Up인지
curl localhost:N000/api/info
```
브라우저로 보고 싶다면 내 노트북에서:
```bash
ssh -L 8080:localhost:N000 <아이디>@<서버주소> -p <포트>
# → http://localhost:8080
```

---

## 확인해 볼 것

- [ ] 화면의 **pid**가 몇 번인가요? 호스트에서 `ps -u $USER -o pid,cmd | grep node`로 보이는 번호와 비교해 보세요.
- [ ] **hostname**과 `docker ps`의 CONTAINER ID를 비교해 보세요.
- [ ] `docker run -m 64m ...`으로 새로 띄우면 **memory limit**이 어떻게 바뀌나요?
- [ ] `-e GREETING="안녕"`을 붙여서 띄워 보세요. `ENV`와 무엇이 다른가요?
- [ ] `docker history my-app`으로 레이어를 뜯어보세요. 가장 큰 레이어는?
- [ ] `server.js`를 한 줄 고치고 다시 빌드하세요. 어떤 단계가 `CACHED`로 나오나요?
  - `COPY . .`를 `RUN npm ci`보다 **위로** 올린 버전과 시간을 비교해 보세요.

## 더 해볼 사람

- `HOST=127.0.0.1`로 띄우면 왜 접속이 안 될까요?
- `.dockerignore` 없이 빌드할 때와 빌드 컨텍스트 크기(`transferring context`)를 비교해 보세요.
- `docker stop my-app`이 바로 끝나는 이유를 `server.js` 맨 아래에서 찾아보세요. 그 코드를 지우면?
- `docker images`로 내 이미지 크기를 기록해 두세요. 다음 주에 줄여 봅니다.

## 막혔을 때

| 증상 | 확인할 것 |
|---|---|
| 접속이 안 돼요 | `-p` 왼쪽이 내 포트 대역인지, `docker ps`에 포트가 보이는지 |
| 컨테이너가 바로 꺼져요 | `docker logs my-app` |
| `port is already allocated` | 그 포트를 이미 누가 쓰는 중 → 대역 안의 다른 번호로 |
| `name is already in use` | `docker rm -f my-app` 후 다시 |
