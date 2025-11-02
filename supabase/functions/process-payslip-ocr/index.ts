import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper: Validate extracted data with arithmetic checks
function validatePayslipData(data: any): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  // Check required fields
  if (!data.gross_pay || data.gross_pay <= 0) {
    errors.push('Invalid or missing gross pay');
  }
  if (!data.net_pay || data.net_pay <= 0) {
    errors.push('Invalid or missing net pay');
  }
  if (data.tax_deducted === undefined || data.tax_deducted < 0) {
    errors.push('Invalid or missing tax deducted');
  }
  
  // Arithmetic validation: gross - deductions ≈ net (within 2% tolerance for rounding)
  if (data.gross_pay && data.net_pay && data.tax_deducted !== undefined) {
    const totalDeductions = (data.tax_deducted || 0) + 
                           (data.pension || 0) + 
                           (data.social_security || 0) + 
                           (data.other_deductions || 0);
    const calculatedNet = data.gross_pay - totalDeductions;
    const difference = Math.abs(calculatedNet - data.net_pay);
    const tolerance = data.gross_pay * 0.02; // 2% tolerance for rounding differences
    
    if (difference > tolerance) {
      errors.push(`Net pay mismatch: calculated ${calculatedNet.toFixed(2)}, found ${data.net_pay.toFixed(2)} (diff: ${difference.toFixed(2)})`);
    }
  }
  
  // Date validation
  if (data.pay_period_start && !/^\d{4}-\d{2}-\d{2}$/.test(data.pay_period_start)) {
    errors.push('Invalid pay period start date format (expected YYYY-MM-DD)');
  }
  if (data.pay_period_end && !/^\d{4}-\d{2}-\d{2}$/.test(data.pay_period_end)) {
    errors.push('Invalid pay period end date format (expected YYYY-MM-DD)');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  let payslipId: string | undefined;

  try {
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!lovableApiKey) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json();
    payslipId = body.payslipId;
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

    console.log('Using Lovable AI (Gemini 2.5 Flash) for PDF OCR');

    // Call Lovable AI Gateway with Gemini 2.5 Flash for OCR
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: 'You are an expert at extracting structured data from payslips. Extract all key financial information accurately. Return ONLY valid JSON without markdown formatting.'
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

IMPORTANT: 
- All currency amounts must be numbers (no commas or currency symbols)
- Dates must be in YYYY-MM-DD format
- Set missing numeric fields to 0, not null
- Return ONLY the JSON object, no explanation or markdown code blocks`
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
        max_tokens: 1000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Lovable AI error:', response.status, errorText);
      
      if (response.status === 429) {
        throw new Error('Rate limit exceeded. Please try again in a few moments.');
      }
      if (response.status === 402) {
        throw new Error('Lovable AI credits depleted. Please add credits in Settings -> Workspace -> Usage.');
      }
      if (response.status === 401) {
        throw new Error('Invalid Lovable API key configuration.');
      }
      
      throw new Error(`Lovable AI error: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    console.log('Lovable AI response received');

    const extractedText = result.choices[0].message.content;
    console.log('Extracted content:', extractedText);

    // Parse the JSON response (remove markdown formatting if present)
    let extractedData;
    try {
      // Remove markdown code blocks if present
      const jsonMatch = extractedText.match(/\{[\s\S]*\}/);
      const jsonString = jsonMatch ? jsonMatch[0] : extractedText;
      extractedData = JSON.parse(jsonString);
      console.log('Parsed data:', JSON.stringify(extractedData, null, 2));
    } catch (parseError) {
      console.error('Error parsing JSON:', parseError, 'Raw text:', extractedText);
      throw new Error('Failed to parse OCR results. The AI response was not valid JSON.');
    }

    // Validate the extracted data
    const validation = validatePayslipData(extractedData);
    console.log('Validation result:', validation);

    if (!validation.isValid) {
      console.warn('Validation warnings:', validation.errors);
      // Store validation errors in additional_data for review
      extractedData.additional_data = {
        ...extractedData.additional_data,
        validation_warnings: validation.errors
      };
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

    const processingTime = Date.now() - startTime;
    console.log(`OCR processing complete in ${processingTime}ms`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        data: payslipData,
        payslip_id: payslipId,
        processing_time_ms: processingTime,
        validation: validation
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in process-payslip-ocr:', error);
    
    // Update payslip status to failed if we have the ID
    if (payslipId) {
      try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const supabase = createClient(supabaseUrl, supabaseKey);
        
        await supabase
          .from('payslips')
          .update({ status: 'failed' })
          .eq('id', payslipId);
      } catch (updateError) {
        console.error('Failed to update payslip status:', updateError);
      }
    }
    
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        details: error instanceof Error ? error.stack : error
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
