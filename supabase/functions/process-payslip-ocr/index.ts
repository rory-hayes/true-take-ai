import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { getDocument } from 'https://esm.sh/pdfjs-serverless@0.3.2';
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";
// Lightweight image processing in Deno for pre-processing before OCR
import { Image } from "https://deno.land/x/imagescript@1.2.16/mod.ts";
// Tesseract.js (WASM) for robust on-edge OCR for image uploads
// We pull via esm.sh; configure worker/core/lang paths to public CDNs
import Tesseract from "https://esm.sh/tesseract.js@5.0.5";

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

// Helper: Determine file extension (lowercased) from file path or name
function getFileExtension(filePathOrName: string | undefined): string {
  if (!filePathOrName) return "";
  const lastDot = filePathOrName.lastIndexOf(".");
  if (lastDot === -1) return "";
  return filePathOrName.slice(lastDot + 1).toLowerCase();
}

// Helper: Is this an image file we can feed directly to Tesseract?
function isImageExtension(ext: string): boolean {
  return ["png", "jpg", "jpeg"].includes(ext);
}

// Basic pre-processing for OCR: grayscale + gentle contrast + size normalization
async function preprocessImageForOcr(imageBytes: ArrayBuffer): Promise<Uint8Array> {
  const img = await Image.decode(new Uint8Array(imageBytes));
  // Normalize size to improve OCR accuracy (target width up to 2000px)
  const targetMaxWidth = 2000;
  if (img.width > targetMaxWidth) {
    const scale = targetMaxWidth / img.width;
    const newW = Math.round(img.width * scale);
    const newH = Math.round(img.height * scale);
    img.resize(newW, newH);
  }
  img.grayscale();
  // Increase contrast moderately; range is -100..100
  img.brightnessContrast(0, 30);
  // Return as PNG (lossless) for OCR
  return await img.encodePNG();
}

// Tesseract OCR for images (PNG/JPEG)
async function ocrWithTesseract(imageBytes: ArrayBuffer): Promise<string> {
  // Preprocess for better OCR accuracy
  const preprocessed = await preprocessImageForOcr(imageBytes);
  // Configure paths for Tesseract.js in an edge/Deno environment
  // Use CDN paths compatible with tesseract.js v5
  const worker = await (Tesseract as any).createWorker({
    logger: (_m: any) => {}, // silence logs in production; can route to console.debug if needed
    workerPath: "https://cdn.jsdelivr.net/npm/tesseract.js@5.0.5/dist/worker.min.js",
    corePath: "https://cdn.jsdelivr.net/npm/tesseract.js-core@5.0.0/tesseract-core.wasm.js",
    langPath: "https://tessdata.projectnaptha.com/4.0.0",
    // Some edge environments require disabling blob URLs
    workerBlobURL: false,
  });

  try {
    await worker.loadLanguage("eng");
    await worker.initialize("eng");
    const { data } = await worker.recognize(preprocessed);
    const text: string = (data && data.text) ? data.text : "";
    return text.trim();
  } finally {
    await worker.terminate();
  }
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

    console.log('Fetching PDF from storage...');

    // Download the file (PDF or image)
    const fileResponse = await fetch(urlData.signedUrl);
    if (!fileResponse.ok) {
      throw new Error(`Failed to download file: ${fileResponse.status}`);
    }
    const fileBytes = await fileResponse.arrayBuffer();
    console.log(`File downloaded, size: ${fileBytes.byteLength} bytes`);

    // Determine file type by extension
    const fileExt = getFileExtension(payslip.file_name || payslip.file_path);

    // TIER 0 (new): If this is an image (PNG/JPG), run robust OCR with Tesseract
    let extractedText = '';
    if (isImageExtension(fileExt)) {
      try {
        console.log('Running Tesseract OCR on image...');
        extractedText = await ocrWithTesseract(fileBytes);
        console.log(`Tesseract extracted ${extractedText.length} characters`);
      } catch (imageOcrError) {
        console.warn('Tesseract OCR failed for image; falling back:', imageOcrError);
        extractedText = '';
      }
    } else {
      // Original path: assume PDF; try to extract text layer first (fastest)
      try {
        console.log('Attempting to extract text layer from PDF...');
        const pdf = await getDocument(new Uint8Array(fileBytes)).promise;
        const numPages = pdf.numPages;
        console.log(`PDF has ${numPages} pages`);
        
        for (let i = 1; i <= numPages; i++) {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          const pageText = textContent.items.map((item: any) => item.str).join(' ');
          extractedText += pageText + '\n';
        }
        
        extractedText = extractedText.trim();
        console.log(`Extracted text length: ${extractedText.length} characters`);
        
        if (extractedText.length < 100) {
          console.log('Text layer too short, likely a scanned document');
          extractedText = '';
        }
      } catch (textError) {
        console.log('Text extraction failed, will use OCR fallback:', textError);
      }
    }

    let aiResponse: any;

    if (extractedText.length > 0) {
      // TIER 2: We have text, use Lovable AI for schema mapping only (cheap & fast)
      console.log('Using Lovable AI for schema mapping (text-based)');
      
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

      aiResponse = await response;
      
    } else {
      // TIER 3: Scanned PDF - Try vision-based OCR
      console.log('Scanned PDF detected - attempting vision-based OCR');
      
      try {
        // Encode PDF as base64 for vision API
        const base64Pdf = base64Encode(fileBytes);
        console.log(`Encoded PDF: ${base64Pdf.length} chars`);
        
        // Call Lovable AI vision model with PDF
        console.log('Calling Lovable AI vision model...');
        const visionResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
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
                content: 'You are an expert at extracting structured data from payslip documents. Extract all key financial information accurately. Return ONLY valid JSON without markdown formatting.'
              },
              {
                role: 'user',
                content: [
                  {
                    type: 'text',
                    text: `Extract the following information from this payslip document and return it as JSON:

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
                  },
                  {
                    type: 'image_url',
                    image_url: {
                      url: `data:application/pdf;base64,${base64Pdf}`
                    }
                  }
                ]
              }
            ],
            max_tokens: 2000,
          }),
        });

        if (!visionResponse.ok) {
          const errorText = await visionResponse.text();
          console.error('Vision API error:', visionResponse.status, errorText);
          throw new Error(`Vision OCR failed: ${visionResponse.status}`);
        }

        const visionResult = await visionResponse.json();
        console.log('Vision OCR response received');

        const visionContent = visionResult.choices[0].message.content;
        console.log('Vision extracted content:', visionContent);

        // Parse the JSON response
        let extractedData;
        try {
          const jsonMatch = visionContent.match(/\{[\s\S]*\}/);
          const jsonString = jsonMatch ? jsonMatch[0] : visionContent;
          extractedData = JSON.parse(jsonString);
          console.log('Vision parsed data:', JSON.stringify(extractedData, null, 2));
        } catch (parseError) {
          console.error('Error parsing vision JSON:', parseError);
          throw new Error('Vision OCR returned invalid JSON');
        }

        // Validate the extracted data
        const validation = validatePayslipData(extractedData);
        console.log('Vision validation result:', validation);

        if (!validation.isValid) {
          console.warn('Vision validation warnings:', validation.errors);
          extractedData.additional_data = {
            ...extractedData.additional_data,
            validation_warnings: validation.errors,
            extraction_method: 'vision_ocr'
          };
        } else {
          extractedData.additional_data = {
            ...extractedData.additional_data,
            extraction_method: 'vision_ocr'
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

        // Create payslip_data record with vision-extracted data
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
          console.error('Error inserting vision OCR data:', insertError);
          throw new Error('Failed to save vision OCR results');
        }

        // Update payslip status to processed
        await supabase
          .from('payslips')
          .update({ status: 'processed' })
          .eq('id', payslipId);

        const processingTime = Date.now() - startTime;
        console.log(`Vision OCR processing complete in ${processingTime}ms`);

        return new Response(
          JSON.stringify({ 
            success: true, 
            data: payslipData,
            payslip_id: payslipId,
            processing_time_ms: processingTime,
            extraction_method: 'vision_ocr',
            validation: validation
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

      } catch (visionError) {
        // Vision OCR failed - fall back to manual entry
        console.error('Vision OCR failed, falling back to manual entry:', visionError);
        
        const { data: payslipData, error: insertError } = await supabase
          .from('payslip_data')
          .insert({
            payslip_id: payslipId,
            user_id: payslip.user_id,
            gross_pay: 0,
            tax_deducted: 0,
            net_pay: 0,
            pension: 0,
            social_security: 0,
            other_deductions: 0,
            additional_data: { 
              message: 'Vision OCR failed. Please enter the values manually.',
              requires_manual_entry: true,
              vision_error: visionError instanceof Error ? visionError.message : 'Unknown error'
            },
            confirmed: false,
          })
          .select()
          .single();

        if (insertError) {
          console.error('Error creating manual entry record:', insertError);
          throw new Error('Failed to create manual entry record');
        }

        await supabase
          .from('payslips')
          .update({ status: 'processed' })
          .eq('id', payslipId);

        const processingTime = Date.now() - startTime;
        console.log(`Falling back to manual entry in ${processingTime}ms`);

        return new Response(
          JSON.stringify({ 
            success: true, 
            data: payslipData,
            payslip_id: payslipId,
            processing_time_ms: processingTime,
            requires_manual_entry: true,
            message: 'Vision OCR failed. Please enter your payslip values manually.'
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('Lovable AI error:', aiResponse.status, errorText);
      
      if (aiResponse.status === 429) {
        throw new Error('Rate limit exceeded. Please try again in a few moments.');
      }
      if (aiResponse.status === 402) {
        throw new Error('Lovable AI credits depleted. Please add credits in Settings -> Workspace -> Usage.');
      }
      if (aiResponse.status === 401) {
        throw new Error('Invalid Lovable API key configuration.');
      }
      
      throw new Error(`Lovable AI error: ${aiResponse.status} - ${errorText}`);
    }

    const result = await aiResponse.json();
    console.log('Lovable AI response received');

    const aiContent = result.choices[0].message.content;
    console.log('AI extracted content:', aiContent);

    // Parse the JSON response (remove markdown formatting if present)
    let extractedData;
    try {
      // Remove markdown code blocks if present
      const jsonMatch = aiContent.match(/\{[\s\S]*\}/);
      const jsonString = jsonMatch ? jsonMatch[0] : aiContent;
      extractedData = JSON.parse(jsonString);
      console.log('Parsed data:', JSON.stringify(extractedData, null, 2));
    } catch (parseError) {
      console.error('Error parsing JSON:', parseError, 'Raw text:', aiContent);
      throw new Error('Failed to parse AI results. The AI response was not valid JSON.');
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
