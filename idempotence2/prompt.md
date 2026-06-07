Generate simple client and server for demonstration purpose.

1. Client is a simple javascript file, executable via bun.
2. Server have an idempotence increment operation (check idempotence key in header). And also simulate 1% failure request time out. Server can store idempotence key and result in memory, but this part should be a separate function. Implement server in @Program.cs
3. Client implement retry mechanism and generate uuid as idempotence key. Try for 1000 times.
