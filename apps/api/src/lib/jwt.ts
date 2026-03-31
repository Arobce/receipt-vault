import jwt from "jsonwebtoken";

interface TokenPayload {
  userId: string;
}

function getSecret(envVar: string): string {
  const secret = process.env[envVar];
  if (!secret) {
    throw new Error(`${envVar} environment variable is not set`);
  }
  return secret;
}

export function generateAccessToken(payload: TokenPayload): string {
  return jwt.sign(payload, getSecret("JWT_SECRET"), { expiresIn: "15m" });
}

export function generateRefreshToken(payload: TokenPayload): string {
  return jwt.sign(payload, getSecret("JWT_REFRESH_SECRET"), { expiresIn: "7d" });
}

export function verifyAccessToken(token: string): TokenPayload {
  return jwt.verify(token, getSecret("JWT_SECRET")) as TokenPayload;
}

export function verifyRefreshToken(token: string): TokenPayload {
  return jwt.verify(token, getSecret("JWT_REFRESH_SECRET")) as TokenPayload;
}
