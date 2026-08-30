import assert from 'node:assert/strict';
import { studentsController } from '../src/modules/students/students.controller';
import { studentsService } from '../src/modules/students/students.service';

async function run() {
  const originalVerify = studentsService.verifyCandidateIdentity;
  studentsService.verifyCandidateIdentity = async () => false;

  let statusCode = 200;
  let responseBody: any;
  let forwardedError: unknown;

  const req = {
    headers: {},
    query: { cnic: 'invalid-test-value' },
    body: {},
    params: { id: 'test-student' },
  } as any;
  const res = {
    status(code: number) {
      statusCode = code;
      return this;
    },
    json(body: any) {
      responseBody = body;
      return this;
    },
  } as any;
  const next = (error?: unknown) => {
    forwardedError = error;
  };

  try {
    // Extracting the handler reproduces how Express invokes route callbacks.
    const routeHandler = studentsController.getRegistrationPdf;
    await routeHandler(req, res, next as any);

    assert.equal(forwardedError, undefined);
    assert.equal(statusCode, 401);
    assert.equal(responseBody?.success, false);
    console.log('Student registration PDF controller binding test passed.');
  } finally {
    studentsService.verifyCandidateIdentity = originalVerify;
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
