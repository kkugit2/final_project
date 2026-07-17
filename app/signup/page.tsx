"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/common/Button";
import { Input } from "@/components/common/Input";

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [needsEmailConfirmation, setNeedsEmailConfirmation] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { data, error: signUpError } = await supabase.auth.signUp({ email, password });

    if (signUpError) {
      setError(signUpError.message);
      setLoading(false);
      return;
    }

    if (data.session) {
      router.replace("/fridge");
      router.refresh();
      return;
    }

    setNeedsEmailConfirmation(true);
    setLoading(false);
  }

  if (needsEmailConfirmation) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-lightGray px-4">
        <div className="w-full max-w-sm rounded-xl bg-white p-8 text-center shadow-sm">
          <h1 className="mb-2 text-xl font-bold text-darkGray">가입 확인 이메일을 보냈어요</h1>
          <p className="mb-6 text-sm text-disabledGray">
            {email}로 전송된 링크를 클릭해 가입을 완료해주세요.
          </p>
          <Link href="/login" className="font-semibold text-secondary">
            로그인으로 돌아가기
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-lightGray px-4">
      <div className="w-full max-w-sm rounded-xl bg-white p-8 shadow-sm">
        <h1 className="mb-1 text-2xl font-bold text-darkGray">회원가입</h1>
        <p className="mb-6 text-sm text-disabledGray">이메일로 간단하게 시작해보세요</p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label htmlFor="email" className="mb-1 block text-xs font-medium text-darkGray">
              이메일
            </label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label htmlFor="password" className="mb-1 block text-xs font-medium text-darkGray">
              비밀번호
            </label>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              required
              minLength={6}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="6자 이상"
            />
          </div>

          {error && <p className="text-sm text-error">{error}</p>}

          <Button type="submit" disabled={loading}>
            {loading ? "가입 중..." : "회원가입"}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-disabledGray">
          이미 계정이 있으신가요?{" "}
          <Link href="/login" className="font-semibold text-secondary">
            로그인
          </Link>
        </p>
      </div>
    </main>
  );
}
