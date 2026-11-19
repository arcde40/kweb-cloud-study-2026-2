# Week 5: Service · Ingress (안에서 찾고, 밖에서 들어오기)

지난주엔 `port-forward`로 Pod **하나**에만 붙었습니다. 이번 주엔
1. **Service**로 Pod 여러 개 앞에 고정된 이름을 붙이고,
2. **DB**를 클러스터에 올려 3주차 앱(방문 수 카운터)을 완성하고,
3. **Ingress**로 내 도메인 `https://kweb-<내 아이디>.fjey.me` 을 엽니다.

```bash
cd week5
kubectl get all            # 지난주 것이 남아 있으면 정리: kubectl delete deploy --all
```

| 파일 | 내용 |
|---|---|
| `service.yaml` | app Pod들 앞의 Service (`app`, 80 → 3000) |
| `configmap.yaml` | 앱 설정 (GREETING) |
| `deployment.yaml` | 지난주 + ConfigMap · Secret · `DB_HOST=db` |
| `db.yaml` | Postgres: PVC + Deployment + Service (`db`) |
| `ingress.yaml` | `kweb-<내 아이디>.fjey.me` → app Service |

---

## 미션 1. Service

DB는 아직 없지만 앱은 DB 없이도 뜹니다. 우선 ConfigMap과 Secret을 만들고 앱부터.

```bash
kubectl create secret generic db --from-literal=password=$(openssl rand -hex 12)
kubectl apply -f configmap.yaml -f deployment.yaml -f service.yaml
kubectl get svc,endpointslices
kubectl get pods -o wide
```
- Service `app`의 CLUSTER-IP는 무엇인가요? EndpointSlice의 ENDPOINTS와 Pod IP들을 비교해 보세요.

클러스터 **안에서** 불러 봅니다. 임시 Pod 하나를 띄워 그 안에서 curl:

```bash
kubectl run curl --rm -it -q --restart=Never --image=curlimages/curl -- sh
# (Pod 안에서)
curl -s app/api/info
for i in $(seq 9); do curl -s app/api/info | grep -o '"hostname":"[^"]*"'; done
nslookup app
exit
```
- `app`이라는 이름만으로 어떻게 찾아갔을까요? (`nslookup` 결과의 이름 전체를 보세요)
- 9번의 hostname은 몇 종류가 나오나요? 3주차에 nginx로 하던 일을 누가 하고 있나요?

**목록이 자동으로 바뀌는지:** 터미널 두 개로

```bash
# 터미널 1
kubectl get endpointslices -w
# 터미널 2
kubectl scale deploy/app --replicas=5
kubectl delete pod <app Pod 하나>
```
- 3주차처럼 무언가를 restart 해야 했나요?

## 미션 2. DB 붙이기

```bash
kubectl apply -f db.yaml
kubectl get pvc,pods -w          # PVC가 Pending → Bound 되는 순간을 보세요
```
- PVC가 처음에 `Pending`인 이유는? (힌트: `kubectl describe pvc db-data`의 Events. Pod이 어느 노드에 뜰지 정해져야 디스크를 만듦)
- DB Pod은 어느 노드에 떴나요? (`kubectl get pods -o wide`) local-path 디스크는 **그 노드의 폴더**입니다. 그 노드가 죽으면? (→ W7)

앱이 DB에 붙었는지:

```bash
kubectl logs deploy/app | head
kubectl run curl --rm -it -q --restart=Never --image=curlimages/curl -- \
  sh -c 'for i in $(seq 9); do curl -s app/ >/dev/null; done; curl -s app/api/visits'
```
- 앱은 DB보다 먼저 떠 있었는데 왜 죽지 않았을까요? (3주차 `withDb`)
- `byHost`에 hostname이 몇 개인가요?

**데이터는 어디에 남나:**

```bash
kubectl delete pod -l app=db
kubectl get pods -w              # 새 DB Pod이 뜰 때까지
# 다시 /api/visits 를 불러 보면 숫자는?
```

**Secret은 비밀일까:**

```bash
kubectl get secret db -o yaml
kubectl get secret db -o jsonpath='{.data.password}' | base64 -d; echo
```
- `data:` 아래 값은 암호화된 걸까요?

## 미션 3. Ingress: 내 도메인

```bash
sed -i "s/kweb-www/kweb-$USER/" ingress.yaml
kubectl apply -f ingress.yaml
kubectl get ingress
```
휴대폰이나 노트북 브라우저로 **`https://kweb-<내 아이디>.fjey.me`** 에 접속해 보세요. 새로고침하면 hostname이 바뀌나요?

- 남의 아이디로도 만들어 보세요. 무슨 일이 일어나나요?
  ```bash
  sed "s/kweb-$USER/kweb-someone/" ingress.yaml | kubectl apply -f -
  ```
- `configmap.yaml`의 GREETING을 바꾸고 apply → 화면이 바로 바뀌나요? 안 바뀐다면:
  ```bash
  kubectl rollout restart deploy/app
  ```

## 정리

```bash
kubectl delete -f ingress.yaml -f deployment.yaml -f service.yaml -f configmap.yaml
kubectl delete -f db.yaml          # PVC를 지우면 DB 데이터도 사라집니다
kubectl delete secret db
```

---

### 더 해볼 사람
- **남의 namespace 부르기:** 임시 curl Pod에서 `curl -s app.<다른 사람 아이디>.svc.cluster.local/api/info`. 됩니다. 그럼 `db.<다른 사람>`의 5432도? 이걸 막는 게 **NetworkPolicy**입니다.
- `kubectl get pod <app Pod> -o yaml | grep -A3 'name: DB_'` 또는 Pod 안에서 `env | grep -i _SERVICE_`. 쿠버네티스가 몰래 넣어 준 환경변수들이 보입니다. `deployment.yaml`에서 `DB_PORT`를 굳이 적어 둔 이유도 여기에.
- DB `Deployment`의 `replicas`를 2로 올리면? (두 Pod이 같은 디스크를?) 진짜 DB는 왜 **StatefulSet**을 쓸까요?
- `kubectl get ingress app -o yaml`과 Traefik 쪽: `kubectl -n kube-system get svc traefik`. 밖에서 들어온 요청이 어떤 순서로 내 Pod까지 오는지 그려 보세요.

## 막혔을 때

| 증상 | 확인할 것 |
|---|---|
| app Pod이 `CreateContainerConfigError` | Secret `db`를 먼저 만들었는지 (`kubectl get secret db`) |
| DB Pod이 `Pending` | `kubectl describe pod`의 Events. 할당량(메모리 요청 1Gi) 초과면 app replicas를 줄이기 |
| `/api/visits`가 에러 | DB Pod이 Running인지, `kubectl logs deploy/app`에 DB 연결 에러가 반복되는지 |
| curl Pod이 안 뜸 (`ImagePullBackOff`) | 이미지 이름 `curlimages/curl` 오타 |
| Ingress `denied request` | host가 `kweb-<내 아이디>.fjey.me` 인지 |
| 도메인 접속이 404 | `kubectl get ingress`의 HOSTS, Service 이름 `app`과 포트 80 |
| 도메인 접속이 502/503 | app Pod이 Running인지, Service의 endpoints가 비어 있지 않은지 |
| `exceeded quota` | NodePort/LoadBalancer 타입은 학생 namespace에서 막혀 있습니다 (ClusterIP만) |
