const ENABLED_VALUE_PATTERN = /^(1|true|yes|on)$/i;

const LOCAL_FILE_ATTACHMENTS_ENV = 'TRELLO_ENABLE_LOCAL_FILE_ATTACHMENTS';
const DEBUG_ENV = 'TRELLO_DEBUG';

const FILE_URL_PATTERN = /file:\/\/[^\s"']+/gi;
const WEB_URL_PATTERN = /https?:\/\/[^\s"']+/gi;
const WINDOWS_PATH_PATTERN = /\b[A-Za-z]:\\(?:[^\\\r\n"'<>|]+\\)*[^\\\r\n"'<>|]*/g;
const LOCAL_PATH_PATTERN = /\b(?:\/Users|\/home|\/var|\/tmp|\/private|\/etc|\/opt|\/srv)(?:\/[^\s"'<>]+)+/g;

const REDACTED_METADATA_KEYS = new Set(['board_url', 'error_details']);

const isEnabled = (value: string | undefined): boolean =>
  value !== undefined && ENABLED_VALUE_PATTERN.test(value);

export const isDebugModeEnabled = (): boolean => isEnabled(process.env[DEBUG_ENV]);

export const areLocalFileAttachmentsEnabled = (): boolean =>
  isEnabled(process.env[LOCAL_FILE_ATTACHMENTS_ENV]);

export const getLocalFileAttachmentDisabledMessage = (): string =>
  `Local file attachments are disabled. Ask the user to set ${LOCAL_FILE_ATTACHMENTS_ENV}=true and restart the server to enable them.`;

export const getHiddenDiagnosticsMessage = (): string =>
  `Additional diagnostic details are hidden unless ${DEBUG_ENV}=true.`;

export const getLocalFileNotFoundMessage = (): string =>
  'Local file not found or inaccessible.';

export const sanitizeText = (value: string): string => {
  if (isDebugModeEnabled()) {
    return value;
  }

  return value
    .replace(FILE_URL_PATTERN, '[redacted file url]')
    .replace(WEB_URL_PATTERN, '[redacted url]')
    .replace(WINDOWS_PATH_PATTERN, '[redacted local path]')
    .replace(LOCAL_PATH_PATTERN, '[redacted local path]');
};

export const sanitizeErrorMessage = (
  error: unknown,
  fallback: string = 'Unknown error occurred'
): string => {
  const message = error instanceof Error ? error.message : fallback;
  const sanitizedMessage = sanitizeText(message).trim();

  return sanitizedMessage || fallback;
};

const sanitizeDiagnosticValue = (value: unknown, key?: string): unknown => {
  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value === 'string') {
    return sanitizeText(value);
  }

  if (Array.isArray(value)) {
    return value.map(item => sanitizeDiagnosticValue(item));
  }

  if (typeof value === 'object') {
    const sanitizedEntries = Object.entries(value).flatMap(([entryKey, entryValue]) => {
      if (!isDebugModeEnabled() && REDACTED_METADATA_KEYS.has(entryKey)) {
        return [];
      }

      return [[entryKey, sanitizeDiagnosticValue(entryValue, entryKey)]];
    });

    return Object.fromEntries(sanitizedEntries);
  }

  return value;
};

export const sanitizeDiagnostics = <T>(value: T): T => {
  if (isDebugModeEnabled()) {
    return value;
  }

  return sanitizeDiagnosticValue(value) as T;
};
