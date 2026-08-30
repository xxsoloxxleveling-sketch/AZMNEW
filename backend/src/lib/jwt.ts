import jwt from 'jsonwebtoken';
import { env } from '../config/env';

export interface TokenPayload {
  userId: string;
  email: string;
  role: string;
  name: string;
}

export interface RefreshTokenPayload {
  userId: string;
}

export interface UploadSessionPayload {
  purpose: 'candidate-document-upload';
  candidateKey: string;
}

export function signAccessToken(payload: TokenPayload): string {
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    expiresIn: env.JWT_ACCESS_EXPIRES_IN as any,
  });
}

export function signRefreshToken(payload: RefreshTokenPayload): string {
  return jwt.sign(payload, env.JWT_REFRESH_SECRET, {
    expiresIn: env.JWT_REFRESH_EXPIRES_IN as any,
  });
}

export function verifyAccessToken(token: string): TokenPayload {
  return jwt.verify(token, env.JWT_ACCESS_SECRET) as TokenPayload;
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
  return jwt.verify(token, env.JWT_REFRESH_SECRET) as RefreshTokenPayload;
}

export function signUploadSessionToken(candidateKey: string): string {
  return jwt.sign(
    { purpose: 'candidate-document-upload', candidateKey },
    env.JWT_ACCESS_SECRET,
    { expiresIn: '15m' }
  );
}

export function verifyUploadSessionToken(token: string): UploadSessionPayload {
  const payload = jwt.verify(token, env.JWT_ACCESS_SECRET) as UploadSessionPayload;
  if (payload.purpose !== 'candidate-document-upload' || !payload.candidateKey) {
    throw new Error('Invalid upload session');
  }
  return payload;
}
