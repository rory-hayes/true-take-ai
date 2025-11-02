import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MAX_LIFETIME_INVITES = 3;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { referredEmail, referralCode } = await req.json();

    if (!referredEmail || !referralCode) {
      throw new Error("Missing required parameters");
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);

    if (userError || !user) {
      throw new Error("User not authenticated");
    }

    // Check email verification
    if (!user.email_confirmed_at) {
      return new Response(
        JSON.stringify({ 
          error: "Email verification required. Please verify your email before sending invites." 
        }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Check lifetime invite limit
    const { data: profile } = await supabaseClient
      .from("profiles")
      .select("invites_sent, max_invites")
      .eq("id", user.id)
      .single();

    if (profile && profile.invites_sent >= profile.max_invites) {
      return new Response(
        JSON.stringify({ 
          error: `Lifetime invite limit reached (${profile.max_invites} invites total). You cannot send more invitations.` 
        }),
        {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Create or update referral
    const { error: referralError } = await supabaseClient
      .from("referrals")
      .insert({
        referrer_id: user.id,
        referred_email: referredEmail,
        referral_code: referralCode,
        status: "pending",
      });

    if (referralError) {
      console.error("Referral error:", referralError);
      throw new Error("Failed to create referral");
    }

    // Increment lifetime invite count
    const newInviteCount = (profile?.invites_sent || 0) + 1;
    await supabaseClient
      .from("profiles")
      .update({ invites_sent: newInviteCount })
      .eq("id", user.id);

    console.log(`Invite sent successfully. User ${user.id} has sent ${newInviteCount} of ${profile?.max_invites || MAX_LIFETIME_INVITES} lifetime invites.`);

    return new Response(
      JSON.stringify({ 
        success: true,
        invites_remaining: (profile?.max_invites || MAX_LIFETIME_INVITES) - newInviteCount
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "An error occurred" }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
