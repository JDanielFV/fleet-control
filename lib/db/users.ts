import { supabase } from "./index";
import type { User } from "./types";
import { getLocalData, setLocalData } from "./localStorage";
import { genId } from "./utils";

export async function getUsers(): Promise<User[]> {
  if (supabase) {
    const { data, error } = await supabase.from("users").select("*").order("created_at", { ascending: false });
    if (!error) return data as User[];
  }
  return getLocalData("users", []);
}

export async function getUserByEmail(email: string): Promise<User | null> {
  if (supabase) {
    const { data, error } = await supabase.from("users").select("*").eq("email", email).maybeSingle();
    if (!error && data) return data as User;
  }
  const users: User[] = getLocalData<User>("users", []);
  return users.find((u) => u.email?.toLowerCase() === email.toLowerCase()) || null;
}

export async function getUserCount(): Promise<number> {
  if (supabase) {
    const { count, error } = await supabase.from("users").select("*", { count: "exact", head: true });
    if (!error) return count || 0;
  }
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
  if (supabase) {
    const { data, error } = await supabase.from("users").upsert(fullUser).select().single();
    if (!error && data) return data as User;
    if (error) console.error("Supabase saveUser error:", error.message);
  }
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
  if (supabase) {
    const { error } = await supabase.from("users").delete().eq("id", id);
    return !error;
  }
  const users: User[] = getLocalData<User>("users", []);
  setLocalData("users", users.filter((u) => u.id !== id));
  return true;
}
