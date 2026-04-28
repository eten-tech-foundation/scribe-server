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
    kukna: 'Kokna',
    kutchi: 'Kachchi',
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

  // Known custom models from Vachan API
  const customModels: Record<string, string> = {
    'english-nagamese': 'nllb_finetuned_eng_naga',
    'english-zeme': 'nllb_finetuned_eng_zeme',
    'gujarati-koli-kachchi': 'nllb_finetuned_guj_kolikachi',
    'gujarati-kachi-koli': 'nllb_finetuned_guj_kolikachi',
    'gujarati-kokna': 'nllb_finetuned_guj_kukna',
    'gujarati-kukna': 'nllb_finetuned_guj_kukna',
    'gujarati-kachchi': 'nllb_finetuned_guj_kachi',
    'gujarati-kutchi': 'nllb_finetuned_guj_kachi',
    'hindi-surjapuri': 'nllb_finetuned_hin_surj',
  };

  const sourceLangArg = source.bcp47 || slugify(source.name);
  const targetLangArg = target.bcp47 || slugify(target.name);

  // Determine model name
  const pairKey = `${slugify(source.name)}-${slugify(target.name)}`;
  let modelName = req.modelName;

  // If the UI sends the generic nllb-600M or nothing, but we have a custom model for this pair, override it
  if (!modelName || modelName === 'nllb-600M') {
    if (customModels[pairKey]) {
      modelName = customModels[pairKey];
    } else {
      modelName = 'nllb-600M'; // Default generic model
    }
  }

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
      return err(ErrorCode.INTERNAL_ERROR);
    }

    const vachanData = (await response.json()) as VachanTranslateResponse;
    const jobId = vachanData.data.jobId;

    // Track job ID in memory
    activeTranslationJobs.add(jobId);

    // Poll Vachan API until the job completes
    let finalStatus = vachanData.data.status;
    let output: string[] = [];
    let attempts = 0;
    const maxAttempts = 30; // 1 minute maximum polling wait

    while (activeTranslationJobs.has(jobId) && attempts < maxAttempts) {
      await sleep(2000); // 2 second polling interval
      attempts++;

      const statusResult = await getJobStatus(jobId);
      if (statusResult.ok) {
        finalStatus = statusResult.data.status;

        // Vachan API might return various statuses (e.g., 'Background task completed successfully')
        // We check if it has output or specifically says completed/error
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

    // Safety cleanup in case of timeout
    activeTranslationJobs.delete(jobId);

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
    logger.error({ cause: error }, 'Failed to connect to Vachan API');
    return err(ErrorCode.INTERNAL_ERROR);
  }
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
      return err(ErrorCode.INTERNAL_ERROR);
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
    logger.error({ cause: error }, 'Failed to fetch job status from Vachan API');
    return err(ErrorCode.INTERNAL_ERROR);
  }
}
