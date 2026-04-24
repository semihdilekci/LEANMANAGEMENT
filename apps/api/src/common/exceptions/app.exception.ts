/** docs/04_BACKEND_SPEC.md — typed exception → GlobalExceptionFilter envelope */
export class AppException extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly httpStatus: number,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'AppException';
  }
}
