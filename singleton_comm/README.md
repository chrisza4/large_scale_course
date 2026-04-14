# Singleton Communication Pitfall Demo

A minimal Spring Boot app that shows why using an in-memory singleton bean
as an inter-API communication channel breaks under horizontal scaling.

## Run the Demo

### Single instance — works

```bash
mvn spring-boot:run

curl -X POST "http://localhost:8080/send?message=hello"
# → Stored: hello

curl "http://localhost:8080/receive"
# → Message: hello
```

### Two instances — breaks

```bash
# Terminal 1
mvn spring-boot:run

# Terminal 2
SERVER_PORT=8081 mvn spring-boot:run

# Send to Instance A, receive from Instance B
curl -X POST "http://localhost:8080/send?message=hello"
curl "http://localhost:8081/receive"
# → [No message] — POST may have been routed to a different instance

# Instance A still has it — the message is trapped in its heap
curl "http://localhost:8080/receive"
# → Message: hello
```

## Fix

Replace `MessageStore` with a shared external store:

- **Redis** — `spring-boot-starter-data-redis` + `RedisTemplate`
- **Database** — JPA/JDBC with a messages table
- **Message broker** — RabbitMQ or Kafka for async communication
