
import { AIMode } from './types';

export const AI_MODEL_PRO = 'gemini-2.5-pro';
export const AI_MODEL_FLASH = 'gemini-2.5-flash';

export const QUOTA_LIMITS = {
  [AIMode.FREE]: {
    RPM: 2, // Requests Per Minute
    RPD: 50, // Requests Per Day
  },
  [AIMode.PAID]: {
    RPM: 60,
    RPD: Infinity,
  },
};