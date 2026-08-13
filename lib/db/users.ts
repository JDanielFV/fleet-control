/**
 * Local (demo-mode) user storage.
 *
 * In production every read/write of the `users` table goes through
 * server-side APIs: /api/auth/status (user count + first-run), POST
 * /api/auth/register (registration with scrypt) and /api/admin/users (the
 * admin panel). With RLS enabled the anon key can't touch `users` anymore,
 * so this module only serves the no-Supabase demo mode (localStorage).
 */

import type { User } from "./types";
import { getLocalData, setLocalData } from "./localStorage";
import { genId } from "./utils";

export async function getUsers(): Promise<User[]> {
  return getLocalData<User>("users", []);
}

export async function getUserByEmail(email: string): Promise<User | null> {
  const users: User[] = getLocalData<User>("users", []);
  return users.find((u) => u.email?.toLowerCase() === email.toLowerCase()) || null;
}

export async function getUserCount(): Promise<number> {
  return getLocalData<User>("users", []).length;
}

export async function saveUser(
  user: Omit<User, "id" | "created_at" | "updated_at"> & { id?: string }
): Promise<User> {
  const now = new Date().toISOString();
  const fullUser: User = {
    ...user,
    id: user.id || genId(),
    created_at: now,
    updated_at: now,
  };

  const users: User[] = getLocalData<User>("users", []);
  const existingIndex = users.findIndex((u) => u.id === fullUser.id);
  if (existingIndex >= 0) {
    users[existingIndex] = { ...users[existingIndex], ...fullUser, updated_at: now };
  } else {
    users.unshift(fullUser);
  }
  setLocalData("users", users);
  return fullUser;
}

export async function deleteUser(id: string): Promise<boolean> {
  const users: User[] = getLocalData<User>("users", []);
  setLocalData("users", users.filter((u) => u.id !== id));
  return true;
}
