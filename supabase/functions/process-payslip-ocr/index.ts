import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

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

// OCR Space API for OCR processing
async function ocrWithOCRSpace(fileBytes: ArrayBuffer, fileName: string): Promise<string> {
  const ocrSpaceApiKey = Deno.env.get('OCRSPACE_API_KEY');
  if (!ocrSpaceApiKey) {
    throw new Error('OCRSPACE_API_KEY is not configured');
  }

  // Convert file to base64
  const base64File = base64Encode(fileBytes);
  
  // Determine file type for OCR Space
  const ext = fileName.toLowerCase().split('.').pop() || '';
  const isImage = ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'tif', 'tiff'].includes(ext);
  const isPDF = ext === 'pdf';
  
  console.log(`Processing ${isPDF ? 'PDF' : 'image'} file with OCR Space API...`);
  
  // Prepare form data
  const formData = new FormData();
  formData.append('apikey', ocrSpaceApiKey);
  formData.append('base64Image', `data:${isPDF ? 'application/pdf' : 'image/' + ext};base64,${base64File}`);
  formData.append('language', 'eng');
  formData.append('isOverlayRequired', 'false');
  formData.append('detectOrientation', 'true');
  formData.append('scale', 'true');
  formData.append('OCREngine', '2'); // Use OCR Engine 2 for better accuracy
  
  // Call OCR Space API
  const response = await fetch('https://api.ocr.space/parse/image', {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('OCR Space API error:', response.status, errorText);
    throw new Error(`OCR Space API failed: ${response.status}`);
  }

  const result = await response.json();
  console.log('OCR Space API response:', JSON.stringify(result, null, 2));

  // Check for API errors
  if (result.IsErroredOnProcessing) {
    console.error('OCR Space processing error:', result.ErrorMessage);
    throw new Error(`OCR failed: ${result.ErrorMessage || 'Unknown error'}`);
  }

  // Extract text from all pages
  let extractedText = '';
  if (result.ParsedResults && result.ParsedResults.length > 0) {
    for (const page of result.ParsedResults) {
      if (page.ParsedText) {
        extractedText += page.ParsedText + '\n';
      }
    }
  }

  const text = extractedText.trim();
  console.log(`OCR Space extracted ${text.length} characters`);
  
  if (text.length === 0) {
    throw new Error('No text could be extracted from the document');
  }

  return text;
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
    const userId = body.userId;
    console.log('Processing payslip:', payslipId);

    // Validate upload quota (server-side check)
    const { data: profile } = await supabase
      .from('profiles')
      .select('subscription_tier, uploads_remaining')
      .eq('id', userId)
      .single();

    if (profile && profile.subscription_tier === 'free' && profile.uploads_remaining <= 0) {
      throw new Error('Upload quota exceeded. Please upgrade your plan to continue uploading payslips.');
    }

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

    console.log('Fetching file from storage...');

    // Download the file (PDF or image)
    const fileResponse = await fetch(urlData.signedUrl);
    if (!fileResponse.ok) {
      throw new Error(`Failed to download file: ${fileResponse.status}`);
    }
    const fileBytes = await fileResponse.arrayBuffer();
    console.log(`File downloaded, size: ${fileBytes.byteLength} bytes`);

    // Extract text using OCR Space API
    let extractedText = '';
    try {
      const fileName = payslip.file_name || payslip.file_path;
      extractedText = await ocrWithOCRSpace(fileBytes, fileName);
      console.log(`OCR Space successfully extracted ${extractedText.length} characters`);
    } catch (ocrError) {
      console.error('OCR Space failed:', ocrError);
      throw new Error(`OCR processing failed: ${ocrError instanceof Error ? ocrError.message : 'Unknown error'}`);
    }

    // Use Lovable AI to extract structured data from OCR text
    console.log('Using Lovable AI for structured data extraction...');
    
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
            content: 'You are an expert at extracting structured data from payslip text. Extract all key financial information accurately. Return ONLY valid JSON without markdown formatting.'
          },
          {
            role: 'user',
            content: `Extract the following information from this payslip text and return it as JSON:

Payslip Text:
${extractedText}

Required JSON format:
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
          }
        ],
        max_tokens: 1000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Lovable AI error:', response.status, errorText);
      throw new Error(`AI extraction failed: ${response.status}`);
    }

    const aiResult = await response.json();
    console.log('AI extraction response received');

    const aiContent = aiResult.choices[0].message.content;
    console.log('AI extracted content:', aiContent);

    // Parse the JSON response
    let extractedData;
    try {
      const jsonMatch = aiContent.match(/\{[\s\S]*\}/);
      const jsonString = jsonMatch ? jsonMatch[0] : aiContent;
      extractedData = JSON.parse(jsonString);
      console.log('Parsed data:', JSON.stringify(extractedData, null, 2));
    } catch (parseError) {
      console.error('Error parsing AI JSON:', parseError);
      throw new Error('AI returned invalid JSON');
    }

    // Validate the extracted data
    const validation = validatePayslipData(extractedData);
    console.log('Validation result:', validation);

    if (!validation.isValid) {
      console.warn('Validation warnings:', validation.errors);
      extractedData.additional_data = {
        ...extractedData.additional_data,
        validation_warnings: validation.errors
      };
    } else {
      extractedData.additional_data = {
        ...extractedData.additional_data
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

    // Create payslip_data record
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
      throw new Error('Failed to save payslip data');
    }

    // Update payslip status to processed
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
    console.error('Error processing payslip:', error);
    
    // Try to update payslip status to failed if we have a payslip ID
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
        console.error('Error updating payslip status:', updateError);
      }
    }

    const processingTime = Date.now() - startTime;
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        processing_time_ms: processingTime
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
