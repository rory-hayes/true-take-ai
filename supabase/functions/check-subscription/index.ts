import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CHECK-SUBSCRIPTION] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    logStep("Function started");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");
    logStep("Stripe key verified");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");
    logStep("Authorization header found");

    const token = authHeader.replace("Bearer ", "");
    logStep("Authenticating user with token");
    
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    const user = userData.user;
    if (!user?.email) throw new Error("User not authenticated or email not available");
    logStep("User authenticated", { userId: user.id, email: user.email });

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    
    // Find Stripe customer by email
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    
    if (customers.data.length === 0) {
      logStep("No customer found in Stripe");
      // Ensure database reflects no subscription
      await supabaseClient
        .from('profiles')
        .update({
          subscription_tier: 'free',
          subscription_status: 'inactive',
          stripe_customer_id: null,
          stripe_subscription_id: null,
          subscription_end_date: null,
          uploads_remaining: 3
        })
        .eq('id', user.id);

      return new Response(JSON.stringify({ 
        subscribed: false,
        subscription_tier: 'free',
        subscription_status: 'inactive'
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const customerId = customers.data[0].id;
    logStep("Found Stripe customer", { customerId });

    // Get active subscriptions
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: "active",
      limit: 1,
    });

    const hasActiveSub = subscriptions.data.length > 0;

    if (hasActiveSub) {
      const subscription = subscriptions.data[0];
      const subscriptionEndDate = new Date(subscription.current_period_end * 1000).toISOString();
      const priceId = subscription.items.data[0].price.id;
      
      logStep("Active subscription found", { 
        subscriptionId: subscription.id, 
        endDate: subscriptionEndDate,
        priceId 
      });

      // Determine tier based on price ID (adjust these based on your actual Stripe price IDs)
      let tier = 'monthly';
      let uploadsRemaining = 999999;

      // Update these price IDs to match your actual Stripe prices
      if (priceId.includes('annual') || priceId.includes('yearly')) {
        tier = 'annual';
      }

      // Update database with subscription details
      const { error: updateError } = await supabaseClient
        .from('profiles')
        .update({
          subscription_tier: tier,
          subscription_status: 'active',
          stripe_customer_id: customerId,
          stripe_subscription_id: subscription.id,
          subscription_end_date: subscriptionEndDate,
          uploads_remaining: uploadsRemaining
        })
        .eq('id', user.id);

      if (updateError) {
        logStep("Error updating profile", { error: updateError });
        throw new Error(`Failed to update profile: ${updateError.message}`);
      }

      logStep("Profile updated successfully");

      return new Response(JSON.stringify({
        subscribed: true,
        subscription_tier: tier,
        subscription_status: 'active',
        subscription_end: subscriptionEndDate,
        uploads_remaining: uploadsRemaining
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    } else {
      logStep("No active subscription found");
      
      // Update database to reflect no active subscription
      await supabaseClient
        .from('profiles')
        .update({
          subscription_tier: 'free',
          subscription_status: 'inactive',
          stripe_customer_id: customerId,
          subscription_end_date: null,
          uploads_remaining: 3
        })
        .eq('id', user.id);

      return new Response(JSON.stringify({
        subscribed: false,
        subscription_tier: 'free',
        subscription_status: 'inactive'
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in check-subscription", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
