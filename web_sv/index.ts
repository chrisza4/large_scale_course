import { Elysia, t } from 'elysia'

const app = new Elysia()
  .get('/add', ({ query: { a, b } }) => {
    return { 
      result: a + b 
    }
  }, {
    query: t.Object({
      a: t.Number(),
      b: t.Number()
    }),
    response: t.Object({
      result: t.Number()
    })
  })
  .listen(3000)

console.log('Server running on http://localhost:3000')