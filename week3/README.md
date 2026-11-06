# Week 3 — Compose · Registry · CI

2주차 앱(방문 수 카운터)을 이번엔 **`compose.yaml` 파일 하나**로 띄웁니다.
미션 1~3은 수업 중에, 미션 4(CI)는 과제입니다.

> 내 번호가 **N번**이면 포트는 **N000–N999**.

```bash
cd week3
cp .env.example .env      # 열어서 PORT=N000 을 내 포트로 (예: 5000)
```

| 파일 | 내용 |
|---|---|
| `compose.yaml` | db + app. healthcheck 포함 |
| `compose.scale.yaml` | 스케일 아웃용 덮어쓰기 (app 포트 제거 + nginx) |
| `nginx.conf` | nginx가 app 여러 개에 나눠 주는 설정 |
| `.env.example` | 내 포트와 비밀번호. 복사해서 `.env`로 (git엔 안 올라감) |

---

## 미션 1. compose로 옮기기

```bash
docker compose up -d
docker compose ps
curl -s localhost:N000/ | grep -o '[0-9]*번째 방문'     # 몇 번 반복
```

1. 지난주 미션 3의 명령 10줄과 `compose.yaml`을 나란히 놓고, 어떤 플래그가 어떤 키가 됐는지 찾아보세요.
2. `docker network ls`를 보세요. 만든 적 없는 `week3_default`는 누가 만들었을까요?
3. `docker compose up -d`를 **한 번 더** 치면 무슨 일이 일어나나요?
4. 데이터가 언제 사라지는지 확인하세요.

```bash
docker compose down        # 그리고 다시 up -d → 방문 수는?
docker compose down -v     # 그리고 다시 up -d → 방문 수는?
```

## 미션 2. healthcheck 전후

```bash
docker compose down -v          # DB를 새로 초기화해야 차이가 잘 보입니다
docker compose up -d
docker compose logs app
```
`시작 시 DB 확인: 준비됨`이 보이면 정상입니다. 이제 `compose.yaml`의 app 부분을 이렇게 바꿔 보세요.

```yaml
    depends_on:
      - db
```

```bash
docker compose down -v && docker compose up -d && docker compose logs app
```
- 이번엔 로그가 어떻게 나오나요? `up -d`가 끝나는 속도는 어떻게 달라졌나요?
- 그런데 앱은 죽지 않고, 조금 뒤 새로고침하면 잘 됩니다. 왜일까요? (2주차 `server.js`의 `withDb`)
- 끝나면 `condition: service_healthy`로 되돌려 두세요.

## 미션 3. 스케일 아웃

```bash
docker compose up -d --scale app=3          # 에러가 나야 정상! 왜일까요?
```

```bash
docker compose -f compose.yaml -f compose.scale.yaml up -d --scale app=3
docker compose -f compose.yaml -f compose.scale.yaml ps
for i in $(seq 9); do curl -s localhost:N000/ > /dev/null; done
curl -s localhost:N000/api/visits
```
- `byHost`에 hostname이 몇 개 보이나요? 각 hostname은 누구일까요? (`docker compose ps`와 비교)
- nginx는 `app`이라는 이름만 알고 있습니다. 그 이름이 무엇으로 풀리는지 직접 물어보세요: `docker compose -f compose.yaml -f compose.scale.yaml exec lb nslookup app`
- `--scale app=5`로 늘린 뒤 다시 9번 요청해 보세요. 새 app들에게도 요청이 가나요?
  - 안 간다면 `docker compose -f compose.yaml -f compose.scale.yaml restart lb` 후 다시. 이유는 `nginx.conf` 주석에.
- 이 "앞에서 받아서 나눠 주는 역할"을 자동으로 해 주는 게 쿠버네티스 Service입니다. (W5)

정리: `docker compose -f compose.yaml -f compose.scale.yaml down -v`

---

## 미션 4 (과제). CI로 이미지 만들기

GitHub Actions가 `week3/`를 빌드해서 **GHCR**(GitHub 레지스트리)에 올리게 합니다.

1. 이 레포를 **fork**합니다.
2. fork한 레포의 **Actions** 탭 → 워크플로 켜기 (fork는 기본으로 꺼져 있습니다).
3. `week3/` 아래 아무 파일이나 고쳐서 push합니다. (예: `server.js`의 `GREETING` 기본값)
4. Actions 탭에서 `week3 image`가 초록색이 되는지 확인합니다. 실패하면 로그를 열어 보세요.
5. 내 GitHub 프로필의 **Packages**에 `kweb-week3`가 생겼는지 확인합니다.
   - 태그가 `sha-xxxxxxx` 형식인지 보세요. 그 해시는 어느 커밋일까요?
6. 패키지 설정에서 **public**으로 바꿉니다. (또는 VM에서 `docker login ghcr.io` — 비밀번호 자리에 `read:packages` 권한의 Personal Access Token)
7. VM에서 `compose.yaml`의 app을 이렇게 바꾸고 띄웁니다.

```yaml
  app:
    image: ghcr.io/<내 GitHub 아이디>/kweb-week3:sha-xxxxxxx   # build: . 대신
```

```bash
docker compose pull
docker compose up -d
```
화면의 `GREETING`이 내가 고친 문구로 바뀌어 있으면 성공입니다. **내 노트북에서 빌드하지 않은 이미지**가 VM에서 돌고 있는 거예요.

### 더 해볼 사람
- 같은 커밋으로 워크플로를 한 번 더 돌려 보세요 (Actions 탭 → Run workflow). 두 번째 빌드는 왜 빠를까요? (`cache-from: type=gha`)
- `docker/build-push-action`에 `platforms: linux/amd64,linux/arm64`를 넣어 보세요. Mac(M 칩)과 VM 모두에서 같은 태그로 돌아가는 이미지가 됩니다.
- `latest` 태그와 `sha-` 태그 중 `compose.yaml`에는 무엇을 쓰는 게 좋을까요? 왜?

## 막혔을 때

| 증상 | 확인할 것 |
|---|---|
| `invalid hostPort: N000` | `.env`의 `PORT`를 내 숫자로 바꿨는지 |
| `port is already allocated` | 그 포트를 이미 누가 씀 → 내 대역의 다른 번호로 |
| 미션 3에서 nginx가 계속 재시작 | `docker compose … logs lb` — app이 다 뜬 뒤 `restart lb` |
| Actions가 안 돌아감 | fork한 레포의 Actions 탭에서 워크플로를 켰는지, push한 파일이 `week3/` 아래인지 |
| Actions `denied: permission_denied` | 워크플로의 `permissions: packages: write`가 그대로인지 |
| VM에서 `docker compose pull` 실패 (denied / unauthorized) | 패키지를 public으로 바꿨는지, 아니면 `docker login ghcr.io` |
| `toomanyrequests` | Docker Hub 비로그인 pull 제한. 잠시 후 다시, 또는 `docker login` |
