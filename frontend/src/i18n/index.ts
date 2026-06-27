import { createI18n } from 'vue-i18n'
import fr from './fr.json'
import en from './en.json'

const savedLocale = localStorage.getItem('routecalc_locale') || 'fr'

const i18n = createI18n({
  legacy: false,
  locale: savedLocale,
  fallbackLocale: 'fr',
  messages: { fr, en },
})

export function getLocale(): string {
  return (i18n.global.locale as any).value
}

export function setLocale(locale: string): void {
  ;(i18n.global.locale as any).value = locale
  localStorage.setItem('routecalc_locale', locale)
}

export default i18n
