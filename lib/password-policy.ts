/**
 * Política de contraseñas del sistema (F2.3 del plan de hardening).
 * Single source of truth para validar contraseñas en servidor y cliente.
 */

export const MIN_PASSWORD_LENGTH = 8;

export interface PasswordValidation {
  valid: boolean;
  /** Mensaje de error listo para mostrar al usuario (es-MX). */
  error?: string;
}

export function validatePassword(password: string): PasswordValidation {
  if (typeof password !== "string" || password.length < MIN_PASSWORD_LENGTH) {
    return {
      valid: false,
      error: `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`,
    };
  }
  return { valid: true };
}
