import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { AppError } from './exceptions/api-error';

type ApiHandler = (req: Request, ...args: any[]) => Promise<NextResponse | Response>;

export function createHandler(handler: ApiHandler): ApiHandler {
  return async (req: Request, ...args: any[]) => {
    try {
      return await handler(req, ...args);
    } catch (error: any) {
      console.error('API Error:', error);

      if (error instanceof ZodError) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Validation failed',
              details: (error as ZodError).issues,
            },
          },
          { status: 400 }
        );
      }


      if (error instanceof AppError) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'APP_ERROR',
              message: error.message,
            },
          },
          { status: error.statusCode }
        );
      }

      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INTERNAL_SERVER_ERROR',
            message: 'An unexpected error occurred',
          },
        },
        { status: 500 }
      );
    }
  };
}
