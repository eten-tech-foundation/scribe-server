import { GoogleGenAI, Type } from '@google/genai';

import type { Result } from '@/lib/types';

import * as bcpService from '@/domains/bcp-lookup/bcp-lookup.service';
import env from '@/env';
import { logger } from '@/lib/logger';
import { err, ErrorCode, ok } from '@/lib/types';

import type {
  JobStatusResponse,
  TranslateRequest,
  TranslateResponse,
  VachanTranslateResponse,
} from './ai-translate.types';

/** Utility to generate a slug for custom models (e.g. 'Koli Kachchi' -> 'koli-kachchi') */
function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');
}

/** Looks up a single language (name or ISO) and returns its BCP-47 code if found */
async function resolveLanguage(input: string): Promise<{ name: string; bcp47: string | null }> {
  // Hackathon specific aliases to match UI names with CSV official names
  const aliases: Record<string, string> = {
    'koli kachchi': 'Kachi Koli',
    'kachi koli': 'Kachi Koli',
    'kachchi koli': 'Kachi Koli',
    kukna: 'Kukna',
    kutchi: 'Kutchi',
    surjapuri: 'Surjapuri',
  };

  const lookupTerm = aliases[input.toLowerCase()] || input;

  // We'll pass the lookupTerm as BOTH language and ISO to the lookup service
  const lookupRes = await bcpService.lookupBcp({ language: lookupTerm, iso: lookupTerm });

  if (!lookupRes.ok || lookupRes.data.length === 0) {
    // Fallback: return the input name directly and null for BCP
    return { name: input, bcp47: null };
  }

  // Best effort: take the exact match first (by name or ISO code), otherwise the first match with a BCP code
  const lowerLookup = lookupTerm.toLowerCase();

  let bestMatch = lookupRes.data.find(
    (r) =>
      r.languageName.toLowerCase() === lowerLookup ||
      r.iso6393Code?.toLowerCase() === lowerLookup ||
      r.iso6391Code?.toLowerCase() === lowerLookup
  );

  // Fallback if no exact match is found
  if (!bestMatch) {
    bestMatch = lookupRes.data.find((r) => r.bcp47Code) || lookupRes.data[0];
  }

  return {
    name: bestMatch.languageName,
    bcp47: bestMatch.bcp47Code,
  };
}

// Keep track of active job IDs in memory as requested
export const activeTranslationJobs = new Set<number>();

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function submitVachanTranslation(
  req: TranslateRequest,
  source: { name: string; bcp47: string | null },
  target: { name: string; bcp47: string | null },
  modelName: string
): Promise<Result<TranslateResponse>> {
  const sourceLangArg = source.bcp47 || slugify(source.name);
  const targetLangArg = target.bcp47 || slugify(target.name);

  const url = new URL(`${env.VACHAN_API_URL}/v2/ai/model/text/translate`);
  url.searchParams.set('device', req.device);
  url.searchParams.set('model_name', modelName);
  url.searchParams.set('source_language', sourceLangArg);
  url.searchParams.set('target_language', targetLangArg);

  try {
    logger.info({ url: url.toString() }, 'Submitting translation job to Vachan API');

    const response = await fetch(url.toString(), {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${env.VACHAN_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(req.verses),
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error({ status: response.status, errorText }, 'Vachan API translate request failed');

      let errorMessage = 'Vachan API request failed';
      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.message || errorMessage;
      } catch {
        if (errorText) errorMessage = errorText;
      }

      return { ok: false, error: { message: errorMessage, code: ErrorCode.VACHAN_API_ERROR } };
    }

    const vachanData = (await response.json()) as VachanTranslateResponse;
    const jobId = vachanData.data.jobId;

    activeTranslationJobs.add(jobId);

    let finalStatus = vachanData.data.status;
    let output: string[] = [];
    let attempts = 0;
    const maxAttempts = 30;

    while (activeTranslationJobs.has(jobId) && attempts < maxAttempts) {
      await sleep(2000);
      attempts++;

      const statusResult = await getJobStatus(jobId);
      if (statusResult.ok) {
        finalStatus = statusResult.data.status;

        if (
          finalStatus.toLowerCase().includes('complet') ||
          finalStatus.toLowerCase().includes('error') ||
          statusResult.data.output.length > 0
        ) {
          output = statusResult.data.output;
          activeTranslationJobs.delete(jobId);
          break;
        }
      }
    }

    activeTranslationJobs.delete(jobId);

    if (finalStatus.toLowerCase().includes('error')) {
      const errMsg = output.length > 0 ? output[0] : 'Vachan API translation job failed';
      return { ok: false, error: { message: errMsg, code: ErrorCode.VACHAN_API_ERROR } };
    }

    if (output.length === 0) {
      return {
        ok: false,
        error: {
          message: 'Vachan API translation job returned no output',
          code: ErrorCode.VACHAN_API_ERROR,
        },
      };
    }

    return ok({
      jobId,
      status: finalStatus,
      sourceLanguage: source.name,
      targetLanguage: target.name,
      sourceBcp47: source.bcp47,
      targetBcp47: target.bcp47,
      modelName,
      verseCount: req.verses.length,
      output,
    });
  } catch (error) {
    let errorMessage = 'Failed to connect to Vachan API';
    if (error instanceof Error) {
      errorMessage = error.message;
    }
    logger.error({ cause: error }, 'Failed to connect to Vachan API');
    return { ok: false, error: { message: errorMessage, code: ErrorCode.VACHAN_API_ERROR } };
  }
}

async function callGeminiTranslation(
  req: TranslateRequest,
  source: { name: string; bcp47: string | null },
  target: { name: string; bcp47: string | null }
): Promise<Result<TranslateResponse>> {
  if (!env.GOOGLE_AI_API_KEY) {
    return err(ErrorCode.INTERNAL_ERROR);
  }

  const ai = new GoogleGenAI({ apiKey: env.GOOGLE_AI_API_KEY });
  const model = env.GOOGLE_AI_MODEL || 'gemini-2.5-flash-lite';

  const prompt = `Translate the following array of text from ${source.name} to ${target.name}.
CRITICAL INSTRUCTIONS:
1. Return ONLY a valid JSON array of strings containing the translated text, maintaining the exact same order as the input.
2. Ensure you use the native script/alphabet of the target language (${target.name}). DO NOT transliterate into English/Latin characters. Use the correct Unicode characters for the target language.

Input text:
${JSON.stringify(req.verses)}`;

  try {
    logger.info(
      { model, source: source.name, target: target.name },
      'Submitting translation job to Gemini API'
    );

    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        temperature: 0.1,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.STRING,
          },
        },
      },
    });

    const text = response.text;
    if (!text) {
      return {
        ok: false,
        error: { message: 'Gemini returned empty response', code: ErrorCode.INTERNAL_ERROR },
      };
    }

    let parsed: string[];
    try {
      parsed = JSON.parse(text);
    } catch {
      logger.error({ text }, 'Failed to parse Gemini response as JSON');
      return {
        ok: false,
        error: {
          message: 'Failed to parse Gemini response as JSON',
          code: ErrorCode.INTERNAL_ERROR,
        },
      };
    }

    if (!Array.isArray(parsed) || parsed.length !== req.verses.length) {
      logger.error(
        { parsedLen: Array.isArray(parsed) ? parsed.length : 0, expected: req.verses.length },
        'Gemini response length mismatch'
      );
      return {
        ok: false,
        error: { message: 'Gemini response array length mismatch', code: ErrorCode.INTERNAL_ERROR },
      };
    }

    return ok({
      jobId: -1,
      status: 'completed',
      sourceLanguage: source.name,
      targetLanguage: target.name,
      sourceBcp47: source.bcp47,
      targetBcp47: target.bcp47,
      modelName: model,
      verseCount: req.verses.length,
      output: parsed,
    });
  } catch (error) {
    let errorMessage = 'Failed to call Gemini API';
    if (error instanceof Error) {
      errorMessage = error.message;
    }
    logger.error({ cause: error }, 'Failed to call Gemini API');
    return { ok: false, error: { message: errorMessage, code: ErrorCode.INTERNAL_ERROR } };
  }
}

export async function submitTranslationJob(
  req: TranslateRequest
): Promise<Result<TranslateResponse>> {
  if (!env.VACHAN_API_URL || !env.VACHAN_API_TOKEN) {
    return err(ErrorCode.INTERNAL_ERROR);
  }

  const [source, target] = await Promise.all([
    resolveLanguage(req.sourceLanguage),
    resolveLanguage(req.targetLanguage),
  ]);

  const customModels: Record<string, string> = {
    'english-nagamese': 'nllb-english-nagamese',
    'english-zeme-naga': 'nllb-english-zeme',
    'gujarati-koli-kachi': 'nllb-gujrathi-koli_kachchi',
    'gujarati-kachi-koli': 'nllb-gujrathi-koli_kachchi',
    'gujarati-kukna': 'nllb-gujarati-kukna',
    'gujarati-kutchi': 'nllb-gujarati-kutchi',
    'hindi-surjapuri': 'nllb-hindi-surjapuri',
  };

  const pairKey = `${slugify(source.name)}-${slugify(target.name)}`;
  let modelName = req.modelName;

  if (!modelName || modelName === 'nllb-600M') {
    if (customModels[pairKey]) {
      modelName = customModels[pairKey];
    } else {
      modelName = 'nllb-600M';
    }
  }

  const vachanResult = await submitVachanTranslation(req, source, target, modelName);

  if (!vachanResult.ok && env.GOOGLE_AI_API_KEY) {
    logger.warn({ error: vachanResult.error }, 'Vachan API failed, falling back to Gemini');
    return callGeminiTranslation(req, source, target);
  }

  return vachanResult;
}

export async function getJobStatus(jobId: number): Promise<Result<JobStatusResponse>> {
  if (!env.VACHAN_API_URL || !env.VACHAN_API_TOKEN) {
    return err(ErrorCode.INTERNAL_ERROR);
  }

  const url = new URL(`${env.VACHAN_API_URL}/v2/ai/model/job`);
  url.searchParams.set('job_id', jobId.toString());

  try {
    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${env.VACHAN_API_TOKEN}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error({ status: response.status, errorText }, 'Vachan API job status request failed');

      let errorMessage = 'Vachan API status request failed';
      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.message || errorMessage;
      } catch {
        if (errorText) errorMessage = errorText;
      }

      return { ok: false, error: { message: errorMessage, code: ErrorCode.VACHAN_API_ERROR } };
    }

    const vachanData = (await response.json()) as any;

    // Normalize output data
    let outputStrings: string[] = [];
    if (vachanData.data?.output) {
      if (Array.isArray(vachanData.data.output.data)) {
        outputStrings = vachanData.data.output.data.map((item: any) =>
          typeof item === 'string' ? item : JSON.stringify(item)
        );
      } else if (Array.isArray(vachanData.data.output.translations)) {
        // Handle custom model output format
        outputStrings = vachanData.data.output.translations.map(
          (t: any) => t.translatedText || JSON.stringify(t)
        );
      } else if (vachanData.data.output.message) {
        // If the job failed, it often returns the error in output.message
        outputStrings = [vachanData.data.output.message];
      } else if (typeof vachanData.data.output === 'string') {
        outputStrings = [vachanData.data.output];
      }
    }

    return ok({
      jobId: vachanData.data.jobId,
      status: vachanData.data.status,
      creationTime: vachanData.data.creationTime,
      updationTime: vachanData.data.updationTime,
      output: outputStrings,
    });
  } catch (error) {
    let errorMessage = 'Failed to fetch job status from Vachan API';
    if (error instanceof Error) {
      errorMessage = error.message;
    }
    logger.error({ cause: error }, 'Failed to fetch job status from Vachan API');
    return { ok: false, error: { message: errorMessage, code: ErrorCode.VACHAN_API_ERROR } };
  }
}
