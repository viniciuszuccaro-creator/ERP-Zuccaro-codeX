import { clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs) {
  return twMerge(clsx(inputs))
} 

/** @param {unknown} value */
export function displayScalar(value) {
  return typeof value === 'string' || (typeof value === 'number' && Number.isFinite(value)) ? value : null;
}

/** @param {unknown} value
 * @returns {value is string} */
export function isSafeHttpUrl(value) {
  if (typeof value !== 'string') return false;
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password;
  } catch {
    return false;
  }
}

export const isIframe = window.self !== window.top;
