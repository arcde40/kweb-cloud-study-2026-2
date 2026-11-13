# Week 4 — 클러스터 세우기 (k3s · Pod · Deployment)

이번 주부터는 `docker`가 아니라 **`kubectl`**로 일합니다.
실습 VM에서 스터디용 k3s 클러스터에 접속하고, 각자 **내 namespace**(= 내 아이디) 안에서 실습합니다.

> 내 번호가 **N번**이면 포트는 여전히 **N000–N999** (port-forward 할 때 씁니다).

```bash
cd week4
kubectl get nodes          # 노드 목록이 보이면 접속 OK
```

| 파일 | 내용 |
|---|---|
| `pod.yaml` | Pod 하나 (`hello`) |
| `deployment.yaml` | Pod을 3개 유지하는 Deployment (`app`) |

이미지는 공용 `ghcr.io/arcde40/kweb-week3:latest`를 씁니다. 3주차 과제를 했다면 **내 이미지**(`ghcr.io/<내 아이디>/kweb-week3:sha-…`)로 바꿔도 됩니다. 단, 패키지가 **public**이어야 받아집니다.

`k`는 `kubectl`의 별칭입니다. `Tab` 자동완성도 됩니다.

---

## 미션 1. 클러스터 둘러보기

```bash
kubectl get nodes -o wide
kubectl get pods -A              # -A: 모든 namespace
kubectl config view --minify     # 나는 누구로, 어디에 접속해 있나
```

1. 노드는 몇 대인가요? 각각 어떤 역할(ROLES)인가요?
2. `kube-system` namespace에 떠 있는 Pod들은 무엇일까요? (힌트: 우리가 띄운 적 없는데 이미 돌고 있는 것들)
3. 내 기본 namespace는 무엇인가요?
4. 권한을 확인해 보세요.

```bash
kubectl auth can-i create deployments            # 내 namespace에서
kubectl auth can-i delete pods -n kube-system    # 남의 namespace에서
kubectl get pods -n kube-system                  # 보기는 되지만
kubectl delete pod -n kube-system <아무 Pod>      # 지우기는?
```

## 미션 2. Pod 하나 띄우기

```bash
kubectl apply -f pod.yaml
kubectl get pods -o wide         # 어느 노드에 떴나요? IP는?
kubectl describe pod hello       # 맨 아래 Events를 위에서부터 읽어 보세요
kubectl logs hello
kubectl exec hello -- hostname
kubectl exec hello -- env | grep GREETING
```

브라우저로 보기 (터미널 하나 더 열거나 `&`로 백그라운드):

```bash
kubectl port-forward pod/hello N000:3000
curl -s localhost:N000/api/info
```

- `describe`의 Events에서 **Scheduled → Pulling → Pulled → Created → Started** 순서를 찾아보세요. 각 줄은 누가 남긴 걸까요? (From 칸)
- `hostname`은 무엇으로 나오나요? 2주차에 컨테이너 hostname은 무엇이었죠?

이제 지워 봅니다.

```bash
kubectl delete pod hello
kubectl get pods
```

- 다시 살아나나요?

## 미션 3. Deployment

```bash
kubectl apply -f deployment.yaml
kubectl get deploy,rs,pods -o wide
```

1. Pod 이름 `app-<여기>-<여기>`의 두 덩어리는 각각 무엇일까요? (`kubectl get rs`와 비교)
2. Pod들이 어느 노드에 나뉘어 떴나요?

**자가 치유.** 터미널 두 개를 쓰면 잘 보입니다.

```bash
# 터미널 1
kubectl get pods -w
# 터미널 2
kubectl delete pod <app Pod 하나>
```
- 지운 Pod 대신 무엇이 생겼나요? 이름은 같나요?

**스케일.** `deployment.yaml`의 `replicas: 3`을 `5`로 바꾸고

```bash
kubectl apply -f deployment.yaml
kubectl get pods
```
- 지난주 nginx처럼 무언가를 재시작해야 했나요?
- `kubectl scale deploy/app --replicas=2`도 됩니다. 그런데 이렇게 바꾸고 나서 `kubectl apply -f deployment.yaml`을 다시 하면? 어느 쪽이 "진짜"일까요?

**라벨.** Deployment는 자기 Pod을 이름이 아니라 **라벨**로 찾습니다.

```bash
kubectl get pods --show-labels
kubectl label pod <app Pod 하나> app=gone --overwrite
kubectl get pods --show-labels
```
- 라벨을 바꾼 Pod은 어떻게 됐나요? Pod 수는 몇 개가 됐나요? 왜일까요?
- 끝나면 그 Pod은 지워 주세요: `kubectl delete pod <그 Pod>`

## 미션 4. 롤링 업데이트와 롤백

`deployment.yaml`의 `GREETING` 값을 `"v2"`로 바꾸고

```bash
kubectl apply -f deployment.yaml
kubectl rollout status deploy/app
kubectl get rs                 # ReplicaSet이 몇 개?
kubectl rollout history deploy/app
```

이번엔 일부러 망가뜨려 봅니다. `image`의 태그를 없는 태그(예: `:nope`)로 바꾸고 apply.

```bash
kubectl apply -f deployment.yaml
kubectl get pods               # STATUS는?
kubectl describe pod <새 Pod>   # Events에서 이유 찾기
```
- 기존 Pod들은 어떻게 됐나요? 서비스는 끊겼을까요?

되돌리기:

```bash
kubectl rollout undo deploy/app
kubectl get pods
```

> `undo`는 클러스터만 되돌립니다. `deployment.yaml` 파일은 여전히 `:nope`이니, 파일도 고쳐 두세요. 다음에 apply하면 다시 망가집니다. (→ "파일이 진짜"가 되게 하는 게 W6 GitOps)

## 정리

```bash
kubectl delete -f deployment.yaml
kubectl delete -f pod.yaml --ignore-not-found
```

---

### 더 해볼 사람
- `kubectl get pod <이름> -o yaml`을 열어서, 내가 쓴 `pod.yaml`보다 **얼마나 많은 내용**이 채워져 있는지 보세요. `status:` 아래는 누가 쓴 걸까요?
- `kubectl explain deployment.spec.strategy`로 롤링 업데이트 설정을 찾아보세요. `maxSurge`, `maxUnavailable`을 바꿔 가며 `rollout`을 보면 차이가 보입니다.
- `kubectl top pods`, `kubectl top nodes` — 내 Pod이 실제로 쓰는 CPU·메모리
- `replicas`를 20으로 올려 보세요. 무엇이 막나요? (`kubectl describe quota`, `kubectl get events`)

## 막혔을 때

| 증상 | 확인할 것 |
|---|---|
| `kubectl get nodes`가 안 됨 | `ls ~/.kube/config`가 있는지. 없으면 강사에게 |
| `ImagePullBackOff` / `ErrImagePull` | 이미지 이름·태그 오타, 내 GHCR 패키지가 public인지 (`describe pod`의 Events) |
| `Pending` | 자원 부족이거나 할당량 초과. `describe pod`의 Events, `kubectl describe quota` |
| `CrashLoopBackOff` | 앱이 뜨자마자 죽음. `kubectl logs <Pod> --previous` |
| `exceeded quota` | 내 namespace의 할당량(Pod 12개, 메모리 요청 1Gi) 초과. replicas를 줄이기 |
| `forbidden` | 내 namespace 밖을 건드림. `-n` 옵션 확인 |
| port-forward 후 `address already in use` | 그 포트를 이미 누가 씀 → 내 대역의 다른 번호로 |
