import { Router } from 'express'
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import { sqlite } from '../database/index.js'
import { t } from '../i18n/index.js'
import { requireAuth } from '../middleware/auth.js'

const router = Router()

const JWT_SECRET = process.env.JWT_SECRET || 'change-me'
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  maxAge: 7 * 24 * 60 * 60 * 1000,
  path: '/',
}

router.get('/users', (_req: any, res: any) => {
  const users = sqlite.prepare('SELECT id, name FROM users ORDER BY id ASC').all()
  res.json(users)
})

router.post('/register', async (req: any, res: any) => {
  const { name, pin } = req.body
  if (!name?.trim()) return res.status(400).json({ error: t(req.locale, 'nameRequired') })
  if (!pin || !/^\d{6}$/.test(pin)) return res.status(400).json({ error: t(req.locale, 'pinRequired') })

  const pinHash = await bcrypt.hash(pin, 12)
  const result = sqlite.prepare('INSERT INTO users (name, pin_hash) VALUES (?, ?)').run(name.trim(), pinHash)
  const user = sqlite.prepare('SELECT id, name FROM users WHERE id = ?').get(result.lastInsertRowid)
  res.status(201).json(user)
})

router.post('/login', async (req: any, res: any) => {
  const { userId, pin } = req.body
  if (!userId || !pin) return res.status(400).json({ error: t(req.locale, 'invalidCredentials') })

  const user = sqlite.prepare('SELECT * FROM users WHERE id = ?').get(userId) as any
  if (!user) return res.status(401).json({ error: t(req.locale, 'invalidCredentials') })

  const valid = await bcrypt.compare(String(pin), user.pin_hash)
  if (!valid) return res.status(401).json({ error: t(req.locale, 'invalidCredentials') })

  sqlite.prepare("UPDATE users SET last_login_at = datetime('now') WHERE id = ?").run(userId)

  const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' })
  res.cookie('authtoken', token, COOKIE_OPTIONS)
  res.json({ id: user.id, name: user.name })
})

router.post('/verify', requireAuth, (req: any, res: any) => {
  const user = sqlite.prepare('SELECT id, name FROM users WHERE id = ?').get(req.userId) as any
  if (!user) return res.status(401).json({ error: t(req.locale, 'unauthorized') })
  res.json(user)
})

router.post('/logout', (_req: any, res: any) => {
  res.clearCookie('authtoken', { path: '/' })
  res.json({ success: true })
})

router.put('/change-pin', requireAuth, async (req: any, res: any) => {
  const { oldPin, newPin } = req.body
  if (!newPin || !/^\d{6}$/.test(newPin)) return res.status(400).json({ error: t(req.locale, 'pinRequired') })

  const user = sqlite.prepare('SELECT * FROM users WHERE id = ?').get(req.userId) as any
  if (!user) return res.status(404).json({ error: t(req.locale, 'userNotFound') })

  const valid = await bcrypt.compare(String(oldPin), user.pin_hash)
  if (!valid) return res.status(401).json({ error: t(req.locale, 'pinMismatch') })

  const pinHash = await bcrypt.hash(newPin, 12)
  sqlite.prepare('UPDATE users SET pin_hash = ? WHERE id = ?').run(pinHash, req.userId)
  res.json({ success: true })
})

export default router
