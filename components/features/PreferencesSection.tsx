"use client";

import { useState } from "react";
import { Toggle } from "@/components/common/Toggle";
import type { UserPreferences } from "@/lib/services/preference-service";

export function PreferencesSection({
  initialPreferences,
}: {
  initialPreferences: UserPreferences;
}) {
  const [preferences, setPreferences] = useState(initialPreferences);
  const [isSaving, setIsSaving] = useState(false);

  async function handleToggleExpiryNotification(enabled: boolean) {
    const previousPreferences = preferences;

    setPreferences((prev) => ({
      ...prev,
      expiry_notification_enabled: enabled,
    }));
    setIsSaving(true);

    try {
      const res = await fetch("/api/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expiry_notification_enabled: enabled }),
      });

      if (!res.ok) {
        setPreferences(previousPreferences);
      }
    } catch (error) {
      setPreferences(previousPreferences);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section>
      <h2 className="mb-3 text-lg font-semibold text-darkGray">설정</h2>
      <div className="rounded-xl border border-border bg-white p-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-darkGray">
              유통기한 알림
            </label>
            <p className="text-xs text-disabledGray">
              재료의 유통기한 표시 여부를 설정합니다
            </p>
          </div>
          <Toggle
            checked={preferences.expiry_notification_enabled}
            onChange={handleToggleExpiryNotification}
            disabled={isSaving}
            label="유통기한 알림 활성화"
          />
        </div>
      </div>
    </section>
  );
}
