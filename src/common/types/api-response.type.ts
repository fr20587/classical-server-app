import { HttpStatus } from '@nestjs/common';

/**
 * Standardized API Response type for frontend consumption.
 * Provides a consistent structure for all API responses.
 */
export class ApiResponse<T = void> {
  private constructor(
    readonly ok: boolean,
    readonly statusCode: HttpStatus,
    readonly data?: T,
    readonly errors?: string | string[],
    readonly message?: string,
    readonly meta?: Record<string, any>,
  ) {}

  /**
   * Creates a successful response
   */
  static ok<T = void>(
    statusCode: HttpStatus,
    data?: T,
    message?: string,
    meta?: Record<string, any>,
  ): ApiResponse<T> {
    return new ApiResponse<T>(true, statusCode, data, undefined, message, meta);
  }

  /**
   * Creates a failed response
   */
  static fail<T = void>(
    statusCode: HttpStatus,
    errors: string | string[],
    message?: string,
    meta?: Record<string, any>,
  ): ApiResponse<T> {
    return new ApiResponse<T>(
      false,
      statusCode,
      undefined,
      errors,
      message,
      meta,
    );
  }
}
