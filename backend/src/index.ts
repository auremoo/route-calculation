import express from 'express'
import cookieParser from 'cookie-parser'
import cors from 'cors'
import path from 'path'
import { fileURLToPath } from 'url'
import { localeMiddleware } from './i18n/index.js'
import { requireAuth } from './middleware/auth.js'
import authRouter from './routes/auth.js'
import routeCalcRouter from './routes/route-calc.js'

const app = express()
const PORT = parseInt(process.env.PORT || '3001', 10)
const __dirname = path.dirname(fileURLToPath(import.meta.url))

app.use(cors({ origin: true, credentials: true }))
app.use(express.json())
app.use(cookieParser())
app.use(localeMiddleware)

app.use('/api/auth', authRouter)
app.use('/api/route-calc', requireAuth, routeCalcRouter)

if (process.env.NODE_ENV === 'production') {
  const frontendDist = path.join(__dirname, '../../frontend/dist')
  app.use(express.static(frontendDist))
  app.get('*', (_req, res) => {
    res.sendFile(path.join(frontendDist, 'index.html'))
  })
}

export { app, PORT }
