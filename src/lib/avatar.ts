import { supabase } from "@/integrations/supabase/client";

// Extract storage path from either a stored path or a legacy public URL.
export function extractAvatarPath(value: string | null | undefined): string | null {
  if (!value) return null;
  if (!/^https?:\/\//i.test(value)) return value;
  const m = value.match(/\/avatars\/(.+)$/);
  return m ? m[1] : null;
}

export async function resolveAvatarUrl(value: string | null | undefined): Promise<string | null> {
  const path = extractAvatarPath(value);
  if (!path) return null;
  const { data, error } = await supabase.storage.from("avatars").createSignedUrl(path, 60 * 60 * 24 * 7);
  if (error || !data) return null;
  return data.signedUrl;
}
