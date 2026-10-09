import bcrypt from "bcryptjs";

export const PASSWORD_MIN = 8;

export function hashPassword(password: string) {
  return bcrypt.hash(password, 11);
}

// Constant-time comparison path even for unknown accounts.
const DUMMY = "$2b$11$C6UzMDM.H6dfI/f/IKcEeO7j0rZ8mJYpbXbHnkOrVqJrHeIpkYy3a";
export function verifyPassword(password: string, hash: string | undefined) {
  return bcrypt.compare(password, hash ?? DUMMY);
}
