import { createClient } from "@supabase/supabase-js";
import path from "node:path";
import type { Database } from "../types/database.types";

try {
  process.loadEnvFile(path.resolve(process.cwd(), ".env.local"));
} catch {
  // .env.local이 없으면 이미 설정된 시스템 환경변수를 그대로 사용한다
}

export function createServiceRoleClientForScript() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY가 .env.local에 설정되어야 합니다."
    );
  }

  return createClient<Database>(url, serviceRoleKey, {
    auth: { persistSession: false },
  });
}
