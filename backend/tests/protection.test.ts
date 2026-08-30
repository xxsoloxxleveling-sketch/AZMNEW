import http from 'http';
import express, { Request, Response } from 'express';
import app from '../src/app';
import { errorHandler } from '../src/middleware/error.middleware';
import { signAccessToken } from '../src/lib/jwt';

async function runTests() {
  console.log('🚀 Starting API Request Protection Tests...\n');

  // Start main express server on random available port
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address() as any;
  const port = address.port;
  const baseUrl = `http://localhost:${port}`;
  console.log(`Main server running at ${baseUrl}\n`);

  let testsPassed = 0;
  let testsFailed = 0;

  function assert(condition: boolean, testName: string, detail?: any) {
    if (condition) {
      console.log(`✅ PASS: ${testName}`);
      testsPassed++;
    } else {
      console.error(`❌ FAIL: ${testName}`, detail || '');
      testsFailed++;
    }
  }

  try {
    // -------------------------------------------------------------
    // Test 1: Verification that IP Rate Limiting / Ban is disabled
    // -------------------------------------------------------------
    console.log('--- Test Group 1: Login Rate Limiting Disabled Verification ---');
    let sixthResponse: any = null;
    let sixthStatusCode = 0;

    for (let i = 1; i <= 6; i++) {
      const res = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: `test${i}@example.com`, password: 'wrongpassword' }),
      });
      const data = await res.json();
      console.log(`  Attempt ${i}: Status = ${res.status}, Body =`, JSON.stringify(data));

      if (i === 6) {
        sixthStatusCode = res.status;
        sixthResponse = data;
      }
    }

    assert(
      sixthStatusCode === 401,
      '6th login attempt receives normal authentication error (401) without IP rate limit blocking (429)',
      `Received ${sixthStatusCode}`
    );
    assert(
      sixthResponse?.error?.message === 'Invalid email or password',
      'Response is standard invalid credentials rather than IP ban message',
      sixthResponse
    );

    // -------------------------------------------------------------
    // Test 2: File Upload Validation on POST /api/students/upload-document
    // -------------------------------------------------------------
    console.log('\n--- Test Group 2: File Upload Validation ---');

    // 2.1 Invalid MIME type (text/plain)
    const invalidMimeRes = await fetch(`${baseUrl}/api/students/upload-document`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        docType: 'photo',
        fileData: 'data:text/plain;base64,SGVsbG8gV29ybGQ=',
        fileName: 'test.txt',
      }),
    });
    const invalidMimeData = await invalidMimeRes.json();
    console.log('  Invalid MIME response (text/plain):', invalidMimeRes.status, invalidMimeData);
    assert(
      invalidMimeRes.status === 400,
      'Invalid MIME type is rejected with HTTP 400',
      invalidMimeData
    );
    assert(
      JSON.stringify(invalidMimeData).includes('Only JPEG, PNG, and PDF'),
      'Rejection error message clearly specifies allowed types (JPEG, PNG, PDF)'
    );

    // 2.2 File size exceeding 5MB
    const largeBuffer = Buffer.alloc(5.5 * 1024 * 1024, 'a');
    const largeBase64 = `data:image/jpeg;base64,${largeBuffer.toString('base64')}`;

    const oversizedRes = await fetch(`${baseUrl}/api/students/upload-document`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        docType: 'photo',
        fileData: largeBase64,
        fileName: 'large.jpg',
      }),
    });
    const oversizedData = await oversizedRes.json();
    console.log('  Oversized file response (>5MB):', oversizedRes.status, oversizedData);
    assert(
      oversizedRes.status === 400,
      'Oversized file (>5MB) is rejected with HTTP 400',
      oversizedData
    );
    assert(
      JSON.stringify(oversizedData).includes('5MB'),
      'Oversized error message notes the 5MB limit'
    );

    // 2.3 Valid file upload (valid JPEG under 5MB)
    const validBuffer = Buffer.from('small jpeg content');
    const validBase64 = `data:image/jpeg;base64,${validBuffer.toString('base64')}`;

    const sessionRes = await fetch(`${baseUrl}/api/students/upload-session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cnicOrBForm: '61101-1234567-1' }),
    });
    const sessionData = (await sessionRes.json()) as any;
    assert(sessionRes.status === 201 && Boolean(sessionData.data?.token), 'Candidate receives a short-lived upload session');

    const validUploadRes = await fetch(`${baseUrl}/api/students/upload-document`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Upload-Session': sessionData.data?.token || '',
      },
      body: JSON.stringify({
        cnicOrBForm: '61101-1234567-1',
        docType: 'photo',
        fileData: validBase64,
        fileName: 'valid_photo.jpg',
      }),
    });
    const validUploadData = (await validUploadRes.json()) as any;
    console.log('  Valid file upload response:', validUploadRes.status, validUploadData);
    assert(
      validUploadRes.status === 200 && validUploadData.success === true,
      'Valid JPEG under 5MB is successfully accepted'
    );

    const binaryUploadRes = await fetch(`${baseUrl}/api/students/upload-document-binary`, {
      method: 'POST',
      headers: {
        'Content-Type': 'image/jpeg',
        'X-Upload-Session': sessionData.data?.token || '',
        'X-Candidate-Key': '61101-1234567-1',
        'X-Document-Type': 'bform',
        'X-File-Name': encodeURIComponent('candidate-bform.jpg'),
      },
      body: validBuffer,
    });
    const binaryUploadData = (await binaryUploadRes.json()) as any;
    assert(
      binaryUploadRes.status === 200 && binaryUploadData.data?.byteSize === validBuffer.length,
      'Binary upload avoids base64 transport overhead'
    );

    let uploadRateLimited = false;
    for (let attempt = 0; attempt < 35; attempt++) {
      const rateLimitRes = await fetch(`${baseUrl}/api/students/upload-document`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Upload-Session': sessionData.data?.token || '',
        },
        body: JSON.stringify({
          cnicOrBForm: '61101-1234567-1',
          docType: 'photo',
          fileData: validBase64,
          fileName: `rate-limit-${attempt}.jpg`,
        }),
      });
      if (rateLimitRes.status === 429) {
        uploadRateLimited = true;
        break;
      }
    }
    assert(uploadRateLimited, 'Candidate document uploads return HTTP 429 after the configured threshold');

    const privateReadRes = await fetch(`${baseUrl}/api/students/missing/document/photo`);
    assert(privateReadRes.status === 401, 'Unauthenticated private document reads are rejected');

    const teacherToken = signAccessToken({
      userId: 'teacher-test',
      email: 'teacher@example.com',
      role: 'TEACHER',
      name: 'Teacher Test',
    });
    const teacherMetadataRes = await fetch(`${baseUrl}/api/students/documents`, {
      headers: { Authorization: `Bearer ${teacherToken}` },
    });
    assert(teacherMetadataRes.status === 403, 'Non-admin roles cannot list private document metadata');

    // -------------------------------------------------------------
    // Test 3: Production Error Masking
    // -------------------------------------------------------------
    console.log('\n--- Test Group 3: Production Error Masking ---');
    const originalEnv = process.env.NODE_ENV;

    // Create a standalone app specifically to test errorHandler in production mode
    const errorTestApp = express();
    errorTestApp.get('/api/test-db-error', (_req: Request, _res: Response, next) => {
      const err: any = new Error('FATAL: password authentication failed for user "postgres_secret_internal"');
      err.statusCode = 500;
      next(err);
    });
    errorTestApp.get('/api/test-client-error', (_req: Request, _res: Response, next) => {
      const err: any = new Error('Invalid input supplied');
      err.statusCode = 400;
      err.details = { field: 'email is required' };
      next(err);
    });
    errorTestApp.use(errorHandler);

    const errorServer = http.createServer(errorTestApp);
    await new Promise<void>((resolve) => errorServer.listen(0, resolve));
    const errorPort = (errorServer.address() as any).port;
    const errorBaseUrl = `http://localhost:${errorPort}`;

    try {
      // 3.1 Production Mode 500 Error Test
      process.env.NODE_ENV = 'production';

      const prod500Res = await fetch(`${errorBaseUrl}/api/test-db-error`);
      const prod500Data = (await prod500Res.json()) as any;
      console.log('  Production 500 response:', prod500Res.status, prod500Data);

      assert(
        prod500Res.status === 500,
        'Internal error returns HTTP 500'
      );
      assert(
        prod500Data.error?.message === 'Internal Server Error',
        'Internal details are masked with generic "Internal Server Error" in production'
      );
      assert(
        !prod500Data.error?.stack,
        'Stack trace is completely omitted from production response'
      );
      assert(
        !JSON.stringify(prod500Data).includes('postgres_secret_internal'),
        'Sensitive internal strings are never leaked to client'
      );

      // 3.2 Production Mode 400 Operational Error Test
      const prod400Res = await fetch(`${errorBaseUrl}/api/test-client-error`);
      const prod400Data = (await prod400Res.json()) as any;
      console.log('  Production 400 response:', prod400Res.status, prod400Data);

      assert(
        prod400Res.status === 400,
        'Operational error returns HTTP 400'
      );
      assert(
        prod400Data.error?.message === 'Invalid input supplied',
        'Operational 400 messages remain informative for client feedback'
      );
      assert(
        prod400Data.error?.details?.field === 'email is required',
        'Operational error details are preserved for client'
      );

      // 3.3 Development Mode 500 Error Test (verifying stack trace is provided in dev)
      process.env.NODE_ENV = 'development';

      const dev500Res = await fetch(`${errorBaseUrl}/api/test-db-error`);
      const dev500Data = (await dev500Res.json()) as any;
      console.log('  Development 500 response stack present:', !!dev500Data.error?.stack);

      assert(
        dev500Data.error?.stack !== undefined,
        'Stack trace is present in development mode'
      );

    } finally {
      process.env.NODE_ENV = originalEnv;
      errorServer.close();
    }

  } finally {
    server.close();
  }

  console.log(`\n========================================`);
  console.log(`Tests Completed: ${testsPassed} Passed, ${testsFailed} Failed`);
  console.log(`========================================\n`);

  if (testsFailed > 0) {
    process.exit(1);
  }
}

if (require.main === module) {
  runTests().catch((err) => {
    console.error('Test execution failed:', err);
    process.exit(1);
  });
}
