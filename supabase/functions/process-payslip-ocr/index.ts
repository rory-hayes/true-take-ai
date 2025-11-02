import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openAIApiKey) {
      throw new Error('OPENAI_API_KEY is not configured');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { payslipId } = await req.json();
    console.log('Processing payslip:', payslipId);

    // Get payslip record to fetch file path
    const { data: payslip, error: payslipError } = await supabase
      .from('payslips')
      .select('*')
      .eq('id', payslipId)
      .single();

    if (payslipError) {
      console.error('Error fetching payslip:', payslipError);
      throw new Error('Failed to fetch payslip');
    }

    // Get the signed URL for the file
    const { data: urlData, error: urlError } = await supabase
      .storage
      .from('payslips')
      .createSignedUrl(payslip.file_path, 3600);

    if (urlError || !urlData?.signedUrl) {
      console.error('Error creating signed URL:', urlError);
      throw new Error('Failed to get file URL');
    }

    console.log('Calling OpenAI for PDF OCR with URL:', urlData.signedUrl);

    // Call OpenAI with PDF URL using GPT-5
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-5-2025-08-07',
        messages: [
          {
            role: 'system',
            content: 'You are an expert at extracting data from payslips. Extract all key financial information accurately. Return ONLY valid JSON, no markdown formatting.'
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `Extract the following information from this payslip PDF and return it as JSON:
{
  "gross_pay": number (total gross pay/salary before deductions),
  "tax_deducted": number (total tax/income tax deducted),
  "net_pay": number (take-home pay after all deductions),
  "pension": number (pension contributions, 0 if not found),
  "social_security": number (social security/national insurance, 0 if not found),
  "other_deductions": number (any other deductions, 0 if not found),
  "pay_period_start": "YYYY-MM-DD" (start date of pay period, null if not found),
  "pay_period_end": "YYYY-MM-DD" (end date of pay period, null if not found),
  "additional_data": {
    "employee_name": string,
    "employer_name": string,
    "payment_date": "YYYY-MM-DD",
    "employee_id": string,
    "any_other_relevant_fields": "values"
  }
}

Return ONLY the JSON object, no explanation or markdown.`
              },
              {
                type: 'image_url',
                image_url: {
                  url: urlData.signedUrl
                }
              }
            ]
          }
        ],
        max_completion_tokens: 1000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API error:', response.status, errorText);
      
      if (response.status === 429) {
        throw new Error('OpenAI rate limit exceeded. Please check your API key credits or wait before retrying.');
      }
      if (response.status === 401) {
        throw new Error('Invalid OpenAI API key. Please check your OPENAI_API_KEY secret.');
      }
      
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const result = await response.json();
    console.log('OpenAI response:', JSON.stringify(result));

    const extractedText = result.choices[0].message.content;
    console.log('Extracted text:', extractedText);

    // Parse the JSON response (remove markdown formatting if present)
    let extractedData;
    try {
      const jsonMatch = extractedText.match(/\{[\s\S]*\}/);
      const jsonString = jsonMatch ? jsonMatch[0] : extractedText;
      extractedData = JSON.parse(jsonString);
    } catch (parseError) {
      console.error('Error parsing JSON:', parseError, 'Raw text:', extractedText);
      throw new Error('Failed to parse OCR results');
    }

    // Update payslip with pay period dates if found
    if (extractedData.pay_period_start || extractedData.pay_period_end) {
      await supabase
        .from('payslips')
        .update({
          pay_period_start: extractedData.pay_period_start,
          pay_period_end: extractedData.pay_period_end,
        })
        .eq('id', payslipId);
    }

    // Create payslip_data record (unconfirmed initially)
    const { data: payslipData, error: insertError } = await supabase
      .from('payslip_data')
      .insert({
        payslip_id: payslipId,
        user_id: payslip.user_id,
        gross_pay: extractedData.gross_pay,
        tax_deducted: extractedData.tax_deducted,
        net_pay: extractedData.net_pay,
        pension: extractedData.pension || 0,
        social_security: extractedData.social_security || 0,
        other_deductions: extractedData.other_deductions || 0,
        additional_data: extractedData.additional_data || {},
        confirmed: false,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error inserting payslip data:', insertError);
      throw new Error('Failed to save OCR results');
    }

    // Update payslip status to processing complete
    await supabase
      .from('payslips')
      .update({ status: 'processed' })
      .eq('id', payslipId);

    console.log('OCR processing complete');

    return new Response(
      JSON.stringify({ 
        success: true, 
        data: payslipData,
        payslip_id: payslipId 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in process-payslip-ocr:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        details: error 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
