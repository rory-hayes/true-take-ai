import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type ToolRequest = {
  toolId: string;
  args?: Record<string, unknown>;
};

function badRequest(message: string, status = 400) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return badRequest("Missing Authorization header", 401);
    const token = authHeader.replace("Bearer ", "");

    // Admin client (for auth checks, and optional signing after ownership verified)
    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

    // Validate session
    const { data: userData, error: userError } = await admin.auth.getUser(token);
    if (userError || !userData?.user) return badRequest("Invalid or expired session", 401);
    const userId = userData.user.id;

    // Enforce paid tier
    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .select("subscription_tier")
      .eq("id", userId)
      .single();
    if (profileError) return badRequest("Unable to verify subscription", 500);
    const tier = (profile?.subscription_tier || "").toLowerCase();
    const isPaid = tier === "monthly" || tier === "annual";
    if (!isPaid) return badRequest("ChatKit tools available to paid users only", 403);

    // RLS-enabled client (scoped to the caller)
    const rls = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const body = (await req.json().catch(() => null)) as ToolRequest | null;
    if (!body || typeof body.toolId !== "string") {
      return badRequest("Invalid payload: { toolId: string, args?: object }");
    }

    const toolId = body.toolId;
    const args = (body.args || {}) as Record<string, unknown>;

    if (toolId === "get_recent_payslips") {
      const rawLimit = Number(args?.limit ?? 6);
      const limit = Number.isFinite(rawLimit) ? Math.max(1, Math.min(25, rawLimit)) : 6;

      const { data, error } = await rls
        .from("payslip_data")
        .select(`
          id, created_at, gross_pay, tax_deducted, net_pay, pension, social_security, other_deductions,
          payslips ( pay_period_start, pay_period_end )
        `)
        .eq("confirmed", true)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error) return badRequest(`Query failed: ${error.message}`, 500);
      return new Response(JSON.stringify({ result: data ?? [] }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (toolId === "get_payslip_summary") {
      const id = String(args?.payslip_data_id || args?.id || "");
      if (!id) return badRequest("payslip_data_id (or id) is required");

      const { data, error } = await rls
        .from("payslip_data")
        .select(`
          id, created_at, gross_pay, tax_deducted, net_pay, pension, social_security, other_deductions,
          payslips ( pay_period_start, pay_period_end )
        `)
        .eq("id", id)
        .maybeSingle();

      if (error) return badRequest(`Query failed: ${error.message}`, 500);
      if (!data) return badRequest("Not found", 404);

      const total_deductions =
        (data.tax_deducted || 0) +
        (data.pension || 0) +
        (data.social_security || 0) +
        (data.other_deductions || 0);
      const calculated_net = (data.gross_pay || 0) - total_deductions;
      const diff = (data.net_pay || 0) - calculated_net;

      return new Response(
        JSON.stringify({
          result: {
            ...data,
            total_deductions,
            calculated_net,
            net_difference: diff,
          },
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (toolId === "get_tax_year_summary") {
      const year = Number(args?.year ?? new Date().getFullYear());
      if (!Number.isFinite(year)) return badRequest("year must be a number");

      // Use pay_period_end if available, else created_at
      const { data, error } = await rls
        .from("payslip_data")
        .select(
          `
          id, created_at, gross_pay, tax_deducted, net_pay, pension, social_security, other_deductions,
          payslips ( pay_period_end )
        `,
        )
        .eq("confirmed", true);

      if (error) return badRequest(`Query failed: ${error.message}`, 500);

      const inYear = (data ?? []).filter((row: any) => {
        const d = row.payslips?.pay_period_end
          ? new Date(row.payslips.pay_period_end)
          : new Date(row.created_at);
        return d.getFullYear() === year;
      });

      const sum = (k: string) => inYear.reduce((acc: number, r: any) => acc + (Number(r[k]) || 0), 0);
      const totals = {
        year,
        count: inYear.length,
        gross_total: sum("gross_pay"),
        net_total: sum("net_pay"),
        tax_total: sum("tax_deducted"),
        pension_total: sum("pension"),
        social_security_total: sum("social_security"),
        other_deductions_total: sum("other_deductions"),
      };

      return new Response(JSON.stringify({ result: totals }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (toolId === "download_payslip") {
      const payslipId = String(args?.payslip_id || "");
      if (!payslipId) return badRequest("payslip_id is required");

      // Verify ownership via RLS client
      const { data: row, error } = await rls
        .from("payslips")
        .select("file_path")
        .eq("id", payslipId)
        .maybeSingle();
      if (error) return badRequest(`Query failed: ${error.message}`, 500);
      if (!row?.file_path) return badRequest("Not found", 404);

      // Sign with admin (storage signing may require elevated privileges)
      const { data: signed, error: signErr } = await admin.storage
        .from("payslips")
        .createSignedUrl(row.file_path, 60 * 10); // 10 minutes
      if (signErr || !signed?.signedUrl) return badRequest("Unable to create signed URL", 500);

      return new Response(JSON.stringify({ result: { url: signed.signedUrl } }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return badRequest(`Unknown toolId: ${toolId}`, 400);
  } catch (e) {
    console.error("chatkit-tools error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});


