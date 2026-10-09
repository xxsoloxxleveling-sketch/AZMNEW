import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { vaultService } from './vault.service';
import { vaultDocumentTypeSchema } from './vault.schema';

const studentIdSchema = z.string().trim().min(1).max(128);

function actor(req: Request) {
  if (!req.user) throw Object.assign(new Error('Authentication required.'), { statusCode: 401 });
  return { id: req.user.id, name: req.user.name };
}

function sendPrivateFile(res: Response, file: { buffer: Buffer; mimeType: string; filename: string }) {
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
  res.setHeader('Content-Type', file.mimeType);
  res.setHeader('Content-Disposition', 'inline; filename="' + file.filename + '"');
  res.setHeader('Content-Length', file.buffer.length);
  return res.status(200).send(file.buffer);
}

export const vaultController = {
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await vaultService.list(req.query as any);
      res.status(200).json({ success: true, data: result });
    } catch (e) { next(e); }
  },
  async detail(req: Request, res: Response, next: NextFunction) {
    try {
      res.status(200).json({ success: true, data: await vaultService.get(req.params.id) });
    } catch (e) { next(e); }
  },
  async file(req: Request, res: Response, next: NextFunction) {
    try { return sendPrivateFile(res, await vaultService.file(req.params.id)); }
    catch (e) { next(e); }
  },
  async history(req: Request, res: Response, next: NextFunction) {
    try {
      res.status(200).json({ success: true, data: await vaultService.history(req.params.id, req.query as any) });
    } catch (e) { next(e); }
  },
  async priorFile(req: Request, res: Response, next: NextFunction) {
    try { return sendPrivateFile(res, await vaultService.historyFile(req.params.id, req.params.eventId)); }
    catch (e) { next(e); }
  },
  async upload(req: Request, res: Response, next: NextFunction) {
    try {
      const parsedStudent = studentIdSchema.safeParse(req.headers['x-candidate-key']);
      const parsedType = vaultDocumentTypeSchema.safeParse(req.headers['x-document-type']);
      if (!parsedStudent.success || !parsedType.success) {
        throw Object.assign(new Error('A valid student ID and document type are required.'), { statusCode: 400 });
      }
      const studentId = parsedStudent.data;
      const documentType = parsedType.data;
      if (!Buffer.isBuffer(req.body)) throw Object.assign(new Error('Binary file upload is required.'), { statusCode: 400 });
      const record = await vaultService.upload({
        studentId, documentType, buffer: req.body,
        filename: String(req.headers['x-file-name'] || documentType),
        mimeType: String(req.headers['content-type'] || ''),
      }, actor(req));
      res.status(201).json({ success: true, data: record });
    } catch (e) { next(e); }
  },
  async replace(req: Request, res: Response, next: NextFunction) {
    try {
      if (!Buffer.isBuffer(req.body)) throw Object.assign(new Error('Binary file upload is required.'), { statusCode: 400 });
      const record = await vaultService.replace(req.params.id, Number(req.query.revision), {
        buffer: req.body,
        filename: String(req.headers['x-file-name'] || 'replacement'),
        mimeType: String(req.headers['content-type'] || ''),
      }, actor(req));
      res.status(200).json({ success: true, data: record });
    } catch (e) { next(e); }
  },
  async review(req: Request, res: Response, next: NextFunction) {
    try {
      const record = await vaultService.review(req.params.id, req.body, actor(req));
      res.status(200).json({ success: true, data: record });
    } catch (e) { next(e); }
  },
};
