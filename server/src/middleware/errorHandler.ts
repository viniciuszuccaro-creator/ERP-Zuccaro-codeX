import type { NextFunction, Request, Response } from 'express';
import { AppError, isAppError } from '../api/errors.js';
import type { AppConfig } from '../config/env.js';

export function notFoundHandler(_req: Request, _res: Response, next: NextFunction) {
  next(new AppError(404, 'NOT_FOUND', 'Resource not found'));
}

export function createErrorHandler(config: AppConfig) {
  return (error: unknown, req: Request, res: Response, _next: NextFunction) => {
    if (error instanceof Error && error.message === 'GROUP_ID_REQUIRED') {
      res.status(400).json({
        error: {
          code: 'GROUP_ID_REQUIRED',
          message: 'Header X-Group-Id is required',
          requestId: req.requestId,
        },
      });
      return;
    }

    const statusFromAssign = typeof error === 'object' && error && 'statusCode' in error
      ? Number((error as { statusCode?: number }).statusCode)
      : undefined;

    if (isAppError(error)) {
      res.status(error.statusCode).json({
        error: {
          code: error.code,
          message: error.message,
          details: error.details,
          requestId: req.requestId,
        },
      });
      return;
    }

    if (statusFromAssign && error instanceof Error) {
      const code = 'code' in error ? String((error as { code?: string }).code || 'BAD_REQUEST') : 'BAD_REQUEST';
      res.status(statusFromAssign).json({
        error: {
          code,
          message: error.message,
          requestId: req.requestId,
        },
      });
      return;
    }

    const message = error instanceof Error ? error.message : 'Internal server error';
    if (!config.isProduction) {
      console.error('[erp-api]', req.requestId, error);
    } else {
      console.error('[erp-api]', req.requestId, message);
    }

    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: config.isProduction ? 'Internal server error' : message,
        requestId: req.requestId,
      },
    });
  };
}
