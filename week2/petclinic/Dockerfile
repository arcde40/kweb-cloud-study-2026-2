# Spring PetClinic — 멀티스테이지 (레포 루트에 두고 docker build -t petclinic:multi .)

# ---- 1단계: builder (JDK + Maven + 의존성) ----
FROM eclipse-temurin:21-jdk AS builder
WORKDIR /app
# 의존성 정의 먼저 → pom.xml이 그대로면 의존성 레이어는 캐시 재사용
COPY mvnw pom.xml ./
COPY .mvn .mvn
RUN ./mvnw -B dependency:go-offline
COPY src src
RUN ./mvnw -B package -DskipTests

# ---- 2단계: runtime (JRE + jar 하나) ----
FROM eclipse-temurin:21-jre
WORKDIR /app
COPY --from=builder /app/target/*.jar app.jar
USER 1000
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
