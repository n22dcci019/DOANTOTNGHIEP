import { Injectable, SetMetadata, type CallHandler, type ExecutionContext, type NestInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import multer from 'multer';
import type { Response } from 'express';
import { ApiError, type ApiRequest } from './errors.js';

export const MAX_PROOF_BYTES = 5 * 1024 * 1024;
const PROOF_UPLOAD = Symbol('proof-upload');
export const ProofUpload = () => SetMetadata(PROOF_UPLOAD, true);

export function proofFormat(file: Express.Multer.File): { ext: 'jpg' | 'png'; mime: string } {
  const bytes = file.buffer;
  if (!bytes || bytes.length === 0 || bytes.length > MAX_PROOF_BYTES) throw new ApiError('VALIDATION_FAILED');
  if (file.mimetype === 'image/jpeg' && bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff &&
      bytes[bytes.length - 2] === 0xff && bytes[bytes.length - 1] === 0xd9) return { ext: 'jpg', mime: 'image/jpeg' };
  const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  if (file.mimetype === 'image/png' && bytes.length >= 24 && bytes.subarray(0, 8).equals(png) &&
      bytes.subarray(12, 16).toString('ascii') === 'IHDR') return { ext: 'png', mime: 'image/png' };
  throw new ApiError('VALIDATION_FAILED');
}

@Injectable()
export class ProofUploadInterceptor implements NestInterceptor {
  private readonly parse = multer({ storage: multer.memoryStorage(), limits: {
    // Busboy raises its size-limit event on reaching the threshold. Leave one
    // byte for our explicit inclusive <= 5 MB check so exactly 5 MB is accepted.
    fileSize: MAX_PROOF_BYTES + 1, files: 1, fields: 2, parts: 4, fieldSize: 2048,
  } }).single('file');

  constructor(private readonly reflector: Reflector) {}

  async intercept(context: ExecutionContext, next: CallHandler) {
    if (!this.reflector.getAllAndOverride<boolean>(PROOF_UPLOAD, [context.getHandler(), context.getClass()])) return next.handle();
    const req = context.switchToHttp().getRequest<ApiRequest>();
    const res = context.switchToHttp().getResponse<Response>();
    if (!req.is('multipart/form-data')) throw new ApiError('VALIDATION_FAILED');
    await new Promise<void>((resolve, reject) => {
      this.parse(req, res, error => error ? reject(new ApiError('VALIDATION_FAILED')) : resolve());
    });
    if (!req.file) throw new ApiError('VALIDATION_FAILED');
    proofFormat(req.file);
    return next.handle();
  }
}
