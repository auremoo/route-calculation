import { runMigrations } from './database/index.js'
import { app, PORT } from './index.js'

runMigrations()

app.listen(PORT, () => {
  console.log(`RouteCalc backend listening on http://localhost:${PORT}`)
})
