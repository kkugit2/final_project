import type { SupabaseClient } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { UnauthorizedError } from "./errors";

// Route Handler(API)용: 미인증 시 401 JSON 응답으로 이어지도록 예외를 던진다.
export async function requireUser(supabase: SupabaseClient) {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new UnauthorizedError();
  return data.user;
}

// Server Component(페이지)용: 미인증 시 로그인 화면으로 리다이렉트한다.
// middleware.ts가 이미 대부분의 경로를 보호하지만, 페이지 단위 방어를 위해 둔다.
export async function requireUserForPage(supabase: SupabaseClient) {
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/login");
  return data.user;
}
