// ── OddSwitch config ─────────────────────────────────────────────────────────
const ODDSWITCH_URL = process.env.ODDSWITCH_URL ?? 'http://localhost:8001';
const ODDSWITCH_API_KEY = process.env.ODDSWITCH_API_KEY ?? '';

/** Bookmaker display names → OddSwitch internal IDs */
const BOOKMAKER_IDS: Record<string, string> = {
  'Bet9ja':   'bet9ja',
  'SportyBet': 'sportybet',
};

function oddswitchHeaders(): Record<string, string> {
  const h: Record<string, string> = { 'Content-Type': 'application/json' };
  if (ODDSWITCH_API_KEY) h['X-API-Key'] = ODDSWITCH_API_KEY;
  return h;
}

// ─────────────────────────────────────────────────────────────────────────────

export function createCodesService(codesRepository) {
  async function getCodes(options) {
    const [codes, total] = await Promise.all([
      codesRepository.findAll(options),
      codesRepository.count(options),
    ]);
    return { codes, total };
  }

  async function getCodeById(id) {
    const code = await codesRepository.findById(id);
    if (!code) {
      const err: any = new Error('Booking code not found');
      err.statusCode = 404;
      throw err;
    }
    return code;
  }

  async function createCode(userId, data) {
    return codesRepository.create({ userId, ...data });
  }

  async function deleteCode(id, userId, userRole) {
    const code = await codesRepository.findById(id);
    if (!code) {
      const err: any = new Error('Booking code not found');
      err.statusCode = 404;
      throw err;
    }
    if (userRole !== 'admin' && code.user_id !== userId) {
      const err: any = new Error('You can only delete your own codes');
      err.statusCode = 403;
      throw err;
    }
    return codesRepository.deactivate(id);
  }

  /**
   * Submit a conversion job to the OddSwitch engine.
   * Returns immediately with { job_id, status, result? }.
   * If status === "completed" the result is already attached (cache hit).
   * Otherwise the caller should poll getConversionJob(job_id).
   */
  async function convertCode({ code, fromBookmaker, toBookmaker }) {
    const source = BOOKMAKER_IDS[fromBookmaker];
    const target = BOOKMAKER_IDS[toBookmaker];

    if (!source || !target) {
      const supported = Object.keys(BOOKMAKER_IDS).join(', ');
      const err: any = new Error(
        `Live code conversion only supports: ${supported}. Select one of those bookmakers to use the OddSwitch engine.`
      );
      err.statusCode = 422;
      throw err;
    }

    let res: Response;
    try {
      res = await fetch(`${ODDSWITCH_URL}/v1/translate`, {
        method: 'POST',
        headers: oddswitchHeaders(),
        body: JSON.stringify({
          source_bookmaker: source,
          target_bookmaker: target,
          booking_code: code.trim(),
        }),
      });
    } catch {
      const err: any = new Error('OddSwitch engine is not reachable. Make sure it is running (./oddswitch/run.sh).');
      err.statusCode = 503;
      throw err;
    }

    if (!res.ok) {
      const body: any = await res.json().catch(() => ({}));
      const msg = body?.detail ?? body?.error?.message ?? 'OddSwitch returned an error';
      const err: any = new Error(msg);
      err.statusCode = res.status >= 500 ? 503 : res.status;
      throw err;
    }

    return res.json();
  }

  /**
   * Poll the status of a previously submitted conversion job.
   */
  async function getConversionJob(jobId: string) {
    let res: Response;
    try {
      res = await fetch(`${ODDSWITCH_URL}/v1/translate/${jobId}`, {
        headers: ODDSWITCH_API_KEY ? { 'X-API-Key': ODDSWITCH_API_KEY } : {},
      });
    } catch {
      const err: any = new Error('OddSwitch engine is not reachable.');
      err.statusCode = 503;
      throw err;
    }

    if (!res.ok) {
      const err: any = new Error('Translation job not found');
      err.statusCode = 404;
      throw err;
    }

    return res.json();
  }

  return { getCodes, getCodeById, createCode, deleteCode, convertCode, getConversionJob };
}
