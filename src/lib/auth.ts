import { blogAuthConfig } from '../blog/config'

const AUTH_STORAGE_KEY = 'site-authed'

function canUseStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
}

function decodeBase64Password(encoded: string) {
  if (!encoded) return ''
  try {
    if (typeof atob === 'function') {
      return atob(encoded)
    }
    return ''
  }
  catch {
    return ''
  }
}

export function getLoginPassword() {
  const encoded = import.meta.env.VITE_LOGIN_PASSWORD_BASE64 || blogAuthConfig.defaultLoginPasswordBase64
  return decodeBase64Password(encoded)
}

export function isUsingDefaultPassword() {
  const configured = import.meta.env.VITE_LOGIN_PASSWORD_BASE64
  return !configured || configured === blogAuthConfig.defaultLoginPasswordBase64
}

export function verifyPassword(input: string) {
  return input === getLoginPassword()
}

export function isAuthed() {
  if (!canUseStorage()) return false
  return window.localStorage.getItem(AUTH_STORAGE_KEY) === '1'
}

export function setAuthed() {
  if (!canUseStorage()) return
  window.localStorage.setItem(AUTH_STORAGE_KEY, '1')
}

export function clearAuthed() {
  if (!canUseStorage()) return
  window.localStorage.removeItem(AUTH_STORAGE_KEY)
}

