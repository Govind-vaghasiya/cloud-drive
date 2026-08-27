import crypto from 'crypto';

const defaultSecret = process.env.ONLYOFFICE_JWT_SECRET || 'dev_onlyoffice_jwt_secret_key_12345';

function base64UrlEncode(input: Buffer | string): string {
  const buf = typeof input === 'string' ? Buffer.from(input, 'utf8') : input;
  return buf.toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function base64UrlDecode(input: string): Buffer {
  let base64 = input.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  return Buffer.from(base64, 'base64');
}

/**
 * Generates an HMAC-SHA256 JWT token for OnlyOffice Document Server config and callbacks
 */
export function signOfficeJwt(payload: Record<string, any>, secret = defaultSecret): string {
  const header = {
    alg: 'HS256',
    typ: 'JWT',
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const dataToSign = `${encodedHeader}.${encodedPayload}`;

  const signature = crypto
    .createHmac('sha256', secret)
    .update(dataToSign)
    .digest();

  const encodedSignature = base64UrlEncode(signature);
  return `${dataToSign}.${encodedSignature}`;
}

/**
 * Verifies an HMAC-SHA256 JWT token from OnlyOffice Document Server
 */
export function verifyOfficeJwt(token: string, secret = defaultSecret): { valid: boolean; payload?: any; error?: string } {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      return { valid: false, error: 'Invalid JWT format' };
    }

    const [encodedHeader, encodedPayload, encodedSignature] = parts;
    const dataToVerify = `${encodedHeader}.${encodedPayload}`;

    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(dataToVerify)
      .digest();

    const actualSignature = base64UrlDecode(encodedSignature);

    if (expectedSignature.length !== actualSignature.length || !crypto.timingSafeEqual(expectedSignature, actualSignature)) {
      return { valid: false, error: 'Invalid signature' };
    }

    const payloadJson = base64UrlDecode(encodedPayload).toString('utf8');
    const payload = JSON.parse(payloadJson);

    // Optional expiration check if exp claim is present
    if (payload.exp && typeof payload.exp === 'number') {
      const nowInSeconds = Math.floor(Date.now() / 1000);
      if (nowInSeconds > payload.exp) {
        return { valid: false, error: 'Token expired' };
      }
    }

    return { valid: true, payload };
  } catch (err: any) {
    return { valid: false, error: err.message || 'JWT verification failed' };
  }
}
