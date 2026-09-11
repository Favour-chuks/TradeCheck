import { CalleClient } from '@call-e/calle';
import { readFileSync } from 'fs';
const env = readFileSync('.env.local', 'utf8');
const getEnv = (k) => env.split('\n').find(l => l.startsWith(k + '=')).split('=').slice(1).join('=').trim();
const client = new CalleClient({ apiKey: getEnv('CALLE_API_KEY'), baseUrl: getEnv('CALLE_BASE_URL') });
try {
  await client.calls.createAndWait({
    recipient: { phone: '+2348012345678', region: 'INTERNATIONAL' },
    task: 'Test task',
    resultSchema: { type: 'object', required: ['status'], properties: { status: { type: 'string' } } }
  });
} catch (e) {
  console.log(JSON.stringify(e, null, 2));
}
