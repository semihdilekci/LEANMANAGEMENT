import { describe, expect, it } from 'vitest';

import {
  EmailTemplateEventTypeParamSchema,
  EmailTemplatePreviewSchema,
  UpdateEmailTemplateSchema,
} from './email-templates.schemas.js';

describe('UpdateEmailTemplateSchema', () => {
  it('geçerli gövdeyi kabul eder', () => {
    const v = UpdateEmailTemplateSchema.parse({
      subjectTemplate: 'Merhaba {{firstName}}',
      htmlBodyTemplate: '<p>{{firstName}}</p>',
      textBodyTemplate: '{{firstName}}',
      requiredVariables: ['firstName'],
    });
    expect(v.requiredVariables).toEqual(['firstName']);
  });

  it('fazla alan reddeder', () => {
    expect(() =>
      UpdateEmailTemplateSchema.parse({
        subjectTemplate: 'x',
        htmlBodyTemplate: '<p/>',
        textBodyTemplate: 'x',
        requiredVariables: [],
        extra: 1,
      }),
    ).toThrow();
  });
});

describe('EmailTemplatePreviewSchema', () => {
  it('variables varsayılanı boş obje', () => {
    const v = EmailTemplatePreviewSchema.parse({
      subjectTemplate: 'S',
      htmlBodyTemplate: '<p/>',
      textBodyTemplate: 't',
    });
    expect(v.variables).toEqual({});
  });
});

describe('EmailTemplateEventTypeParamSchema', () => {
  it('geçerli event type', () => {
    expect(EmailTemplateEventTypeParamSchema.parse('TASK_ASSIGNED')).toBe('TASK_ASSIGNED');
  });

  it('geçersiz event type reddeder', () => {
    expect(() => EmailTemplateEventTypeParamSchema.parse('UNKNOWN')).toThrow();
  });
});
