import { AppException } from '../common/exceptions/app.exception.js';

/** Bilinmeyen event_type — docs/03_API_CONTRACTS.md (404 eşdeğeri) */
export class EmailTemplateNotFoundException extends AppException {
  constructor(eventType: string) {
    super('VALIDATION_FAILED', 'E-posta şablonu bulunamadı', 404, { eventType });
  }
}

/** required_variables ile şablon içeriği uyumsuz */
export class EmailTemplateVariablesInvalidException extends AppException {
  constructor(details: { missingInTemplates?: string[]; message?: string }) {
    super('VALIDATION_FAILED', details.message ?? 'Şablon değişkenleri geçersiz', 400, details);
  }
}
