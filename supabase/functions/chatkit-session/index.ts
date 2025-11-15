import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    const OPENAI_WORKFLOW_ID = Deno.env.get("OPENAI_WORKFLOW_ID");
    if (!OPENAI_API_KEY) {
      return new Response(JSON.stringify({ error: "Missing OPENAI_API_KEY" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Authenticate caller
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } },
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing Authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData?.user) {
      return new Response(JSON.stringify({ error: "Invalid or expired session" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Enforce paid plan
    const { data: profile } = await supabase
      .from("profiles")
      .select("subscription_tier")
      .eq("id", userData.user.id)
      .single();
    const isPaid = (profile?.subscription_tier || "").toLowerCase() === "monthly"
      || (profile?.subscription_tier || "").toLowerCase() === "annual";
    if (!isPaid) {
      return new Response(JSON.stringify({ error: "ChatKit is available to paid users only" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create a short-lived ChatKit client token via OpenAI.
    // Note: Endpoint and headers follow OpenAI's beta semantics; adjust if your org uses different paths.
    const resp = await fetch("https://api.openai.com/v1/chatkit/sessions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
        // Enable beta if required by ChatKit docs
        "OpenAI-Beta": "chatkit=v1,workflows=v1",
      },
      body: JSON.stringify({
        // If your ChatKit setup needs a default workflow, pass it through
        workflow_id: OPENAI_WORKFLOW_ID || undefined,
      }),
    });

    if (!resp.ok) {
      const text = await resp.text().catch(() => "");
      console.error("OpenAI session error:", resp.status, text);
      return new Response(
        JSON.stringify({ error: "Failed to create ChatKit session" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const data = await resp.json().catch(() => ({}));
    // Try common shapes for the client token
    const clientToken =
      data?.client_token ||
      data?.clientToken ||
      data?.token ||
      data?.client_secret?.value ||
      null;

    if (!clientToken) {
      console.error("Unexpected ChatKit session payload:", data);
      return new Response(
        JSON.stringify({ error: "Unexpected ChatKit session response" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(JSON.stringify({ clientToken }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("chatkit-session error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});


