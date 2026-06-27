import type { Request, Response, NextFunction } from 'express'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))

const fr: Record<string, string> = JSON.parse(readFileSync(join(__dirname, 'fr.json'), 'utf-8'))
const en: Record<string, string> = JSON.parse(readFileSync(join(__dirname, 'en.json'), 'utf-8'))

const locales: Record<string, Record<string, string>> = { fr, en }

export function t(locale: string, key: string): string {
  const dict = locales[locale] ?? locales['fr']
  return dict[key] ?? key
}

export function localeMiddleware(req: Request, _res: Response, next: NextFunction): void {
  const lang = (req.headers['accept-language'] || '').split(',')[0].split('-')[0]
  ;(req as any).locale = ['fr', 'en'].includes(lang) ? lang : 'fr'
  next()
}
