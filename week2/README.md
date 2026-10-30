# Week 2 — 여러 개를 엮기

1주차 앱에 **Postgres 방문 수 카운터**가 붙었습니다.
이번 주 실습은 각자 진행합니다. 위에서부터 순서대로 하면 되고, 막히면 맨 아래 표를 보세요.

> 내 번호가 **N번**이면 호스트 포트는 **N000–N999**. 아래 명령의 `N000`을 내 포트로 바꾸세요.

| 경로 | 내용 |
|---|---|
| `/` | 방문 수 + 컨테이너 정보 (접속할 때마다 1 증가) |
| `/api/visits` | 방문 기록을 컨테이너(hostname)별로 집계한 JSON |
| `/api/info` | 컨테이너 정보 JSON |

| 환경변수 | 기본값 | 설명 |
|---|---|---|
| `DB_HOST` | (없음) | 없으면 DB 없이 동작. 같은 네트워크면 **컨테이너 이름** |
| `DB_PASSWORD` | (없음) | Postgres 비밀번호 |
| `DB_USER` / `DB_NAME` / `DB_PORT` | postgres / postgres / 5432 | |

---

## 미션 1. 이미지 다이어트

이 폴더에는 Dockerfile이 두 개 있습니다.

| 파일 | 내용 |
|---|---|
| `Dockerfile.single` | 1주차 방식. 한 단계로 `npm ci` 후 소스 그대로 실행 |
| `Dockerfile` | 멀티스테이지. builder에서 번들 → runtime엔 `dist/server.js` 한 파일만, `USER node` |

```bash
cd week2
docker build -f Dockerfile.single -t my-app:single .
docker build -t my-app:w2 .
docker images my-app
```

1. 두 Dockerfile을 나란히 열고, 무엇이 다른지 한 줄씩 비교해 보세요.
2. `Dockerfile.single`의 `FROM node:22-slim`을 `FROM node:22`로 바꿔서 `my-app:fat`으로 빌드해 보세요. 크기가 어떻게 되나요?
3. `my-app:w2`의 runtime 단계에는 `npm ci`가 없습니다. `node_modules` 없이 어떻게 돌아갈까요?
   - 힌트: `npm ci && npm run build` 후 `dist/server.js`를 열어 보세요. (로컬에 Node가 없다면 builder 단계를 떠올려 보세요)
4. 두 이미지를 각각 띄워서 화면의 **uid**를 비교해 보세요. (`USER node`의 효과)
5. `docker history my-app:single`과 `docker history my-app:w2`를 비교해 보세요. builder 단계의 레이어는 어디로 갔나요?

| 버전 | 크기 |
|---|---|
| `my-app:fat` (node:22, 한 단계) | |
| `my-app:single` (node:22-slim, 한 단계) | |
| `my-app:w2` (멀티스테이지) | |

> 💡 줄어든 대부분은 **베이스 이미지** 덕입니다. 멀티스테이지는 빌드 도구·소스·`node_modules`를 걸러 내는데,
> TypeScript나 네이티브 모듈(python·g++ 필요)을 쓰는 실제 프로젝트에서 효과가 훨씬 커집니다.

## 미션 2. 이미지 해부

```bash
docker save my-app:w2 -o img.tar
mkdir img && tar -xf img.tar -C img && ls img
cat img/manifest.json
```
- `manifest.json`의 `Layers` 개수와 `docker history my-app:w2`의 줄 수를 비교해 보세요.
- 레이어 파일 이름(sha256)은 무엇의 해시일까요?
- 끝나면 `rm -rf img img.tar`

## 미션 3. 손으로 엮기

```bash
docker network create w2net
docker volume create w2-pgdata

docker run -d --name db --network w2net \
  -e POSTGRES_PASSWORD=secret \
  -v w2-pgdata:/var/lib/postgresql/data \
  postgres:17

docker build -t my-app:w2 .
docker run -d --name app --network w2net -p N000:3000 \
  -e DB_HOST=db -e DB_PASSWORD=secret \
  my-app:w2
```
브라우저(또는 `curl localhost:N000`)로 새로고침할 때마다 방문 수가 올라가면 성공입니다.

> `postgres:17`로 고정한 이유: 18부터 데이터 경로가 바뀌어서 `/var/lib/postgresql/data`에 마운트하면 에러가 납니다.
> 태그를 고정하지 않으면 이런 일이 언젠가 생긴다는 예시이기도 합니다.

## 미션 4. 데이터는 어디에

```bash
docker rm -f db
docker run -d --name db --network w2net -e POSTGRES_PASSWORD=secret \
  -v w2-pgdata:/var/lib/postgresql/data postgres:17
```
- 방문 수가 이어지나요?
- 이번엔 `-v` 없이 DB를 다시 만들어 보세요. 방문 수는?
- `docker volume inspect w2-pgdata`의 `Mountpoint`는 어디인가요?

## 미션 5. 네트워크 실험

```bash
docker rm -f app
docker run -d --name app -p N000:3000 -e DB_HOST=db -e DB_PASSWORD=secret my-app:w2
```
- `--network`를 빼면(= 기본 bridge) 화면에 무엇이 뜨나요? 왜 그럴까요?
- 다시 `--network w2net`으로 띄운 뒤 `docker exec app cat /etc/resolv.conf`를 보세요. `127.0.0.11`은 누구일까요?
- `docker network inspect w2net`에서 두 컨테이너의 IP를 찾아보세요.

## 미션 6. (심화) bind mount와 UID

```bash
mkdir -p out
docker run --rm -v "$PWD/out:/out" node:22-slim touch /out/as-root
docker run --rm -v "$PWD/out:/out" --user 1000 node:22-slim \
  sh -c 'mkdir /out/dir-1000 && touch /out/dir-1000/file'
ls -ln out
```
- `as-root`와 `dir-1000`의 소유자 UID가 각각 무엇인가요? 컨테이너 안의 0번(root)과 1000번이 밖에서는 왜 그 숫자일까요?
- 힌트: `grep $USER /etc/subuid` — 1주차 Namespace 표에 있던 **USER** 네임스페이스입니다.
- `rm -r out/dir-1000`이 되나요? 안 된다면 어떻게 지울까요? (힌트: 컨테이너 안에서 `rm`)

## 미션 7. 세어 보기

미션 3에서 친 명령어는 몇 줄, 옵션은 몇 개였나요?
**다음 주에 이걸 파일 하나(`compose.yaml`)로 줄입니다.**

## 심화 보너스. 실제 프로젝트 — Spring PetClinic

Spring 공식 샘플 앱입니다. 원래 레포에는 Dockerfile이 없어서, 이 폴더의 `petclinic/`에 준비해 뒀습니다.

```bash
cd ~
git clone https://github.com/spring-projects/spring-petclinic
cp ~/kweb-cloud-study-2026-2/week2/petclinic/{Dockerfile,Dockerfile.single,.dockerignore} spring-petclinic/
cd spring-petclinic

docker build -f Dockerfile.single -t petclinic:single .
docker build -t petclinic:multi .
docker images petclinic
```

1. 두 Dockerfile을 비교해 보세요. 한 단계 버전에는 JDK, Maven 의존성(`~/.m2`), 소스, `target/`가 전부 남습니다. 멀티스테이지는 JRE와 jar 하나뿐.
2. 크기 차이가 Node 앱보다 훨씬 큰 이유는 무엇일까요?
3. `pom.xml`만 먼저 복사하고 `dependency:go-offline`을 따로 실행하는 이유는? `src` 아래 파일 하나를 고치고 다시 빌드해서 어디부터 `CACHED`가 풀리는지 보세요.
4. Postgres에 붙여 보세요. (미션 3에서 만든 `w2net` 재사용)

```bash
docker run -d --name pc-db --network w2net \
  -e POSTGRES_USER=petclinic -e POSTGRES_PASSWORD=petclinic -e POSTGRES_DB=petclinic \
  postgres:17

docker run -d --name petclinic --network w2net -p N001:8080 -m 768m \
  -e SPRING_PROFILES_ACTIVE=postgres \
  -e POSTGRES_URL=jdbc:postgresql://pc-db/petclinic \
  -e POSTGRES_USER=petclinic -e POSTGRES_PASS=petclinic \
  petclinic:multi
```

> ⚠️ `-m 768m`은 꼭 붙이세요. 실습 VM의 메모리를 8명이 나눠 씁니다. (1주차 cgroup 기억나죠?)
> 첫 빌드는 Maven 의존성을 받느라 몇 분 걸립니다. `docker logs -f petclinic`에서 `Started PetClinicApplication`이 보이면 접속하세요.

정리: `docker rm -f petclinic pc-db`

## 정리

```bash
docker rm -f app db
docker network rm w2net
docker volume rm w2-pgdata      # 데이터까지 지웁니다
```

## 막혔을 때

| 증상 | 확인할 것 |
|---|---|
| 화면에 `ENOTFOUND db` | 앱과 DB가 같은 `--network`에 있는지 |
| `ECONNREFUSED` | DB가 아직 뜨는 중일 수 있음. `docker logs db`에서 `ready to accept connections` 확인 후 새로고침 |
| `28P01 password authentication failed` | 앱의 `DB_PASSWORD`와 DB의 `POSTGRES_PASSWORD`가 같은지. 볼륨에 예전 비밀번호로 만든 데이터가 남아 있을 수도 |
| `npm run build` 실패 | builder 단계에서 `npm ci`(devDependencies 포함)를 했는지 |
| `name is already in use` | `docker rm -f <이름>` |
| 빌드는 되는데 `Cannot find module` | runtime 단계에 `dist/server.js`를 제대로 복사했는지, `CMD` 경로가 맞는지 |
