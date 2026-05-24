// ── OddSwitch config ─────────────────────────────────────────────────────────
const ODDSWITCH_URL = process.env.ODDSWITCH_URL ?? 'http://localhost:8001';
const ODDSWITCH_API_KEY = process.env.ODDSWITCH_API_KEY ?? '';

/** Bookmaker display names → OddSwitch internal IDs */
const BOOKMAKER_IDS: Record<string, string> = {
  'Bet9ja':   'bet9ja',
  'SportyBet': 'sportybet',
};

const SUPPORTED_BOOKMAKERS = Object.keys(BOOKMAKER_IDS).join(', ');

function oddswitchHeaders(): Record<string, string> {
  const h: Record<string, string> = { 'Content-Type': 'application/json' };
  if (ODDSWITCH_API_KEY) h['X-API-Key'] = ODDSWITCH_API_KEY;
  return h;
}

function validationError(message: string) {
  const err: any = new Error(message);
  err.statusCode = 422;
  return err;
}

function dependencyError(message: string) {
  const err: any = new Error(message);
  err.statusCode = 424;
  return err;
}

export function normalizeBookingCodeInput(code: unknown) {
  const normalized = String(code ?? '').trim().toUpperCase();
  if (normalized.length < 4) {
    throw validationError('Enter a booking code with at least 4 characters.');
  }
  if (normalized.length > 30) {
    throw validationError('Booking codes can be at most 30 characters.');
  }
  if (!/^[A-Z0-9_-]+$/.test(normalized)) {
    throw validationError('Booking codes can only contain letters, numbers, hyphens, or underscores.');
  }
  return normalized;
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
    const normalizedCode = normalizeBookingCodeInput(code);

    if (!source || !target) {
      throw validationError(
        `Live code conversion only supports: ${SUPPORTED_BOOKMAKERS}. Select one of those bookmakers to use the OddSwitch engine.`
      );
    }

    if (source === target) {
      throw validationError('Choose two different bookmakers before converting a booking code.');
    }

    let res: Response;
    try {
      res = await fetch(`${ODDSWITCH_URL}/v1/translate`, {
        method: 'POST',
        headers: oddswitchHeaders(),
        body: JSON.stringify({
          source_bookmaker: source,
          target_bookmaker: target,
          booking_code: normalizedCode,
        }),
      });
    } catch {
      throw dependencyError(
        `Code conversion is temporarily unavailable. You can still browse verified codes, or try again later. Supported bookmakers: ${SUPPORTED_BOOKMAKERS}.`
      );
    }

    if (!res.ok) {
      const body: any = await res.json().catch(() => ({}));
      const msg = body?.detail ?? body?.error?.message ?? 'The conversion engine could not convert this code.';
      const err: any = new Error(msg);
      err.statusCode = res.status >= 500 ? 424 : res.status;
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
      throw dependencyError('Code conversion is temporarily unavailable. Try again later.');
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
