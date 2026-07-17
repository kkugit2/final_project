import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { AppError } from "./errors";

export type ApiSuccess<T> = { success: true; data: T };
export type ApiError = { success: false; error: { code: string; message: string } };

export function ok<T>(data: T, status = 200) {
  return NextResponse.json<ApiSuccess<T>>({ success: true, data }, { status });
}

export function fail(code: string, message: string, status = 400) {
  return NextResponse.json<ApiError>({ success: false, error: { code, message } }, { status });
}

export function handleRouteError(error: unknown) {
  if (error instanceof AppError) {
    return fail(error.code, error.message, error.statusCode);
  }

  if (error instanceof ZodError) {
    return fail("VALIDATION_ERROR", error.issues[0]?.message ?? "입력값이 올바르지 않습니다.", 400);
  }

  console.error(error);
  return fail("INTERNAL_ERROR", "서버 오류가 발생했습니다.", 500);
}
