import { createClient } from "npm:@supabase/supabase-js@2";
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from "npm:@simplewebauthn/server@13.1.1";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const b64uEnc = (buf: Uint8Array) => {
  let s = "";
  buf.forEach((b) => (s += String.fromCharCode(b)));
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};
const b64uDec = (s: string) =>
  Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (s.length % 4)) % 4)), (c) => c.charCodeAt(0));

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
  try {
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const origin = req.headers.get("origin") || "";
    let rpID = "";
    try { rpID = new URL(origin).hostname; } catch { /* origem ausente */ }
    if (!rpID) return json({ error: "Origem inválida" }, 400);

    const body = await req.json();
    const mode = body?.mode as string;

    const getUser = async () => {
      const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
      const { data, error } = await admin.auth.getUser(token);
      if (error || !data?.user) throw new Error("Não autenticado");
      return data.user;
    };

    // limpa desafios com mais de 10 minutos
    await admin.from("passkey_challenges").delete().lt("created_at", new Date(Date.now() - 10 * 60 * 1000).toISOString());

    if (mode === "register-options") {
      const user = await getUser();
      const username = (user.email || "").replace(/@.*$/, "") || user.id.slice(0, 8);
      const options = await generateRegistrationOptions({
        rpName: "KP Assessoria",
        rpID,
        userID: new TextEncoder().encode(user.id),
        userName: username,
        userDisplayName: username,
        attestationType: "none",
        authenticatorSelection: { residentKey: "required", userVerification: "required" },
      });
      const { data: ch, error } = await admin.from("passkey_challenges")
        .insert({ challenge: options.challenge, kind: "register", user_id: user.id }).select("id").single();
      if (error) throw error;
      return json({ challengeId: ch.id, options });
    }

    if (mode === "register-verify") {
      const user = await getUser();
      const { data: ch } = await admin.from("passkey_challenges").select("*")
        .eq("id", body.challengeId).eq("kind", "register").eq("user_id", user.id).maybeSingle();
      if (!ch) return json({ error: "Desafio expirado — tente de novo" }, 400);
      await admin.from("passkey_challenges").delete().eq("id", ch.id);
      const verification = await verifyRegistrationResponse({
        response: body.response,
        expectedChallenge: ch.challenge,
        expectedOrigin: origin,
        expectedRPID: rpID,
        requireUserVerification: true,
      });
      if (!verification.verified || !verification.registrationInfo) return json({ error: "Biometria não validada" }, 400);
      const cred = verification.registrationInfo.credential;
      const ua = req.headers.get("user-agent") || "";
      const device = /iPhone|iPad/.test(ua) ? "iPhone/iPad" : /Android/.test(ua) ? "Android" : /Mac/.test(ua) ? "Mac" : /Windows/.test(ua) ? "Windows" : "Dispositivo";
      const { error: insErr } = await admin.from("user_passkeys").insert({
        user_id: user.id,
        credential_id: cred.id,
        public_key: b64uEnc(cred.publicKey),
        counter: cred.counter || 0,
        transports: body?.response?.response?.transports || null,
        device_name: device,
      });
      if (insErr) throw insErr;
      return json({ verified: true });
    }

    if (mode === "login-options") {
      const options = await generateAuthenticationOptions({ rpID, userVerification: "required", allowCredentials: [] });
      const { data: ch, error } = await admin.from("passkey_challenges")
        .insert({ challenge: options.challenge, kind: "login" }).select("id").single();
      if (error) throw error;
      return json({ challengeId: ch.id, options });
    }

    if (mode === "login-verify") {
      const { data: ch } = await admin.from("passkey_challenges").select("*")
        .eq("id", body.challengeId).eq("kind", "login").maybeSingle();
      if (!ch) return json({ error: "Desafio expirado — tente de novo" }, 400);
      await admin.from("passkey_challenges").delete().eq("id", ch.id);
      const credId = body?.response?.id as string;
      const { data: pk } = await admin.from("user_passkeys").select("*").eq("credential_id", credId).maybeSingle();
      if (!pk) return json({ error: "Biometria não cadastrada — entre com a senha e ative de novo" }, 404);
      const verification = await verifyAuthenticationResponse({
        response: body.response,
        expectedChallenge: ch.challenge,
        expectedOrigin: origin,
        expectedRPID: rpID,
        credential: { id: pk.credential_id, publicKey: b64uDec(pk.public_key), counter: Number(pk.counter) || 0 },
        requireUserVerification: true,
      });
      if (!verification.verified) return json({ error: "Biometria não validada" }, 401);
      await admin.from("user_passkeys")
        .update({ counter: verification.authenticationInfo.newCounter, last_used_at: new Date().toISOString() })
        .eq("id", pk.id);
      const { data: u, error: uErr } = await admin.auth.admin.getUserById(pk.user_id);
      if (uErr || !u?.user?.email) return json({ error: "Usuário não encontrado" }, 404);
      const { data: link, error: lErr } = await admin.auth.admin.generateLink({ type: "magiclink", email: u.user.email });
      if (lErr || !link?.properties?.hashed_token) throw lErr || new Error("Falha ao criar a sessão");
      return json({ token_hash: link.properties.hashed_token });
    }

    return json({ error: "Modo inválido" }, 400);
  } catch (e) {
    return json({ error: (e as Error)?.message || String(e) }, 500);
  }
});
