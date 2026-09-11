import { CalleClient } from "@call-e/calle";

export interface CalleResult {
  reached_business: 'yes' | 'no' | 'unclear';
  confirmed_business_name?: string;
  product_match?: 'matches' | 'discrepancy' | 'could_not_compare';
  stated_price_or_terms?: string;
  advance_payment_requested?: string;
  red_flags?: string[];
  verdict: 'verified_reachable' | 'discrepancy_found' | 'could_not_verify';
  transcript?: string;
  confidence?: number;
  error?: boolean;
}

export interface CalleCallParams {
  phoneNumber: string;
  companyName: string;
  productCategory: string;
  claimedTerms: string;
  language?: string;
  region?: string | 'IN' | 'INTERNATIONAL'; // 'IN' for India, 'INTERNATIONAL' for Nigeria/other
}

const TASK_TEMPLATE = (p: CalleCallParams) =>
  `Call this supplier on behalf of a prospective buyer considering an order with ${p.companyName}. ` +
  `Confirm you've reached ${p.companyName}. Confirm they can supply ${p.productCategory}. ` +
  `Ask them to restate the price, minimum order quantity, and payment terms they quoted for this order — ` +
  `in particular, what share of payment they want in advance versus on dispatch. ` +
  `Do not share any personal or banking information on the buyer's behalf. ` +
  `Do not agree to any payment or place any order. ` +
  `If the line is not reachable, or not associated with this business, note that clearly. ` +
  `Conduct the call in ${p.language || 'English'}.`;

const RESULT_SCHEMA = {
  type: 'object',
  required: ['reached_business', 'verdict'],
  properties: {
    reached_business: { type: 'string', enum: ['yes', 'no', 'unclear'] },
    confirmed_business_name: { type: 'string' },
    product_match: { type: 'string', enum: ['matches', 'discrepancy', 'could_not_compare'] },
    stated_price_or_terms: { type: 'string' },
    advance_payment_requested: { type: 'string' },
    red_flags: { type: 'array', items: { type: 'string' } },
    verdict: { type: 'string', enum: ['verified_reachable', 'discrepancy_found', 'could_not_verify'] },
  },
  additionalProperties: false,
};

export async function placeVerificationCall(params: CalleCallParams): Promise<CalleResult> {
  try {
    if (!process.env.CALLE_API_KEY || !process.env.CALLE_BASE_URL) {
      throw new Error('Missing CALL-E environment variables');
    }

    const client = new CalleClient({
      apiKey: process.env.CALLE_API_KEY,
      baseUrl: process.env.CALLE_BASE_URL,
    });

    const call = await client.calls.createAndWait({
      recipient: {
        phone: params.phoneNumber,
        region: params.region || 'INTERNATIONAL',
      },
      task: TASK_TEMPLATE(params),
      resultSchema: RESULT_SCHEMA,
    });

    if (!call.structuredResult){ throw new Error('CALL-E returned no structured result')}
    
    const structured = call.structuredResult.data as CalleResult;
    structured.transcript = call.transcript || undefined;
    // Derive a simple confidence score from verdict + reached_business
    structured.confidence = deriveConfidence(structured);
    return structured;

  } catch (err) {
    console.error('CALL-E error:', err);
    return {
      reached_business: 'unclear',
      verdict: 'could_not_verify',
      confidence: 0,
      error: true,
    };
  }
}

function deriveConfidence(result: CalleResult): number {
  if (result.verdict === 'verified_reachable' && result.reached_business === 'yes') return 92;
  if (result.verdict === 'discrepancy_found') return 75;
  if (result.reached_business === 'no') return 30;
  return 50;
}
