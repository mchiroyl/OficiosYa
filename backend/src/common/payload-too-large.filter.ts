import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
  PayloadTooLargeException,
} from '@nestjs/common';
import { Response } from 'express';

@Catch(PayloadTooLargeException)
export class PayloadTooLargeFilter implements ExceptionFilter {
  catch(_exception: PayloadTooLargeException, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();
    res.status(HttpStatus.PAYLOAD_TOO_LARGE).json({
      statusCode: HttpStatus.PAYLOAD_TOO_LARGE,
      error: 'Payload Too Large',
      message: 'La imagen supera el máximo de 8 MB.',
    });
  }
}
