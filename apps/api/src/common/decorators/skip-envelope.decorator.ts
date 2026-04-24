import { SetMetadata } from '@nestjs/common';

export const SKIP_ENVELOPE_KEY = 'skipEnvelope';

/** 204 No Content veya ham yanıt — ResponseEnvelopeInterceptor atlanır */
export const SkipEnvelope = () => SetMetadata(SKIP_ENVELOPE_KEY, true);
