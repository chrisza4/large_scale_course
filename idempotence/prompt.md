Generate simple client and server for demonstration purpose.

1. Client and server in single file.
2. Server have an idempotence increment operation (check idempotence key in header). And also simulate 0.01% failure request time out. Server can store idempotence key and result in memory, but this part should be a separate function.
3. Client implement retry mechanism and generate uuid as idempotence key
