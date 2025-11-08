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
    if (!OPENAI_API_KEY || !OPENAI_WORKFLOW_ID) {
      return new Response(
        JSON.stringify({ error: "Server not configured. Missing OPENAI_API_KEY or OPENAI_WORKFLOW_ID." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Authenticate user via Supabase JWT (paid users only)
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

    const userId = userData.user.id;

    // Enforce paid subscription
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("subscription_tier")
      .eq("id", userId)
      .single();

    if (profileError) {
      console.error("Profile error:", profileError);
      return new Response(JSON.stringify({ error: "Unable to verify subscription status" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const tier = (profile?.subscription_tier || "free").toLowerCase();
    const isPaid = tier === "monthly" || tier === "annual";
    if (!isPaid) {
      return new Response(JSON.stringify({ error: "ChatKit is available to paid users only" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { messages } = await req.json();
    if (!Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: "Invalid payload: messages must be an array" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Call OpenAI Workflows (ChatKit) with streaming; relay SSE back to client
    const openaiResp = await fetch(`https://api.openai.com/v1/workflows/${OPENAI_WORKFLOW_ID}/runs`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
        "OpenAI-Beta": "workflows=v1",
        "Accept": "text/event-stream",
      },
      body: JSON.stringify({
        inputs: {
          messages,
          // Optional: include minimal user context safely if needed later
        },
        stream: true,
      }),
    });

    if (!openaiResp.ok || !openaiResp.body) {
      const text = await openaiResp.text().catch(() => "");
      console.error("OpenAI error:", openaiResp.status, text);
      return new Response(
        JSON.stringify({ error: "Chat service unavailable. Please try again later." }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(openaiResp.body, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "Transfer-Encoding": "chunked",
      },
    });
  } catch (error) {
    console.error("chat-openai error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});


