import { prisma } from '../src/lib/prisma';
import { supabaseStorage } from '../src/lib/supabaseStorage';
import http from 'http';
import app from '../src/app';
import fs from 'fs';
import path from 'path';

async function performAudit() {
  console.log('======================================================');
  console.log('🔍 EXECUTING COMPREHENSIVE BACKEND AUDIT RUNNER');
  console.log('======================================================\n');

  // ---------------------------------------------------------
  // 1. PROJECT STRUCTURE & ARTIFACT CHECKS
  // ---------------------------------------------------------
  console.log('--- 1. ARTIFACT & CLEANUP CHECK ---');
  const devDbExists = fs.existsSync(path.join(__dirname, '../prisma/dev-db'));
  const rootRenderYaml = fs.existsSync(path.join(__dirname, '../../render.yaml'));
  const backendRenderYaml = fs.existsSync(path.join(__dirname, '../render.yaml'));
  const oldPhase7Test = fs.existsSync(path.join(__dirname, '../src/test-phase7-integration.ts'));
  const rootPhase7Test = fs.existsSync(path.join(__dirname, '../../test-phase7-integration.ts'));

  console.log(`dev-db folder exists: ${devDbExists} (Expected: false) -> ${!devDbExists ? 'PASS' : 'FAIL'}`);
  console.log(`duplicate backend/render.yaml exists: ${backendRenderYaml} (Expected: false, single root render.yaml) -> ${!backendRenderYaml ? 'PASS' : 'FAIL'}`);
  console.log(`root render.yaml exists: ${rootRenderYaml} (Expected: true) -> ${rootRenderYaml ? 'PASS' : 'FAIL'}`);
  console.log(`test-phase7-integration.ts in backend: ${oldPhase7Test} (Expected: false) -> ${!oldPhase7Test ? 'PASS' : 'FAIL'}`);
  console.log(`test-phase7-integration.ts in root: ${rootPhase7Test} (Expected: false) -> ${!rootPhase7Test ? 'PASS' : 'FAIL'}`);

  // ---------------------------------------------------------
  // 2. LIVE DATABASE QUERY & MIGRATION HISTORY
  // ---------------------------------------------------------
  console.log('\n--- 2. LIVE DATABASE SCHEMA & MIGRATIONS ---');
  try {
    // Query information_schema for all user tables
    const tables: any = await prisma.$queryRawUnsafe(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `);
    console.log('Live PostgreSQL Tables found:');
    tables.forEach((t: any) => console.log(`  - ${t.table_name}`));

    // Query _prisma_migrations
    const migrations: any = await prisma.$queryRawUnsafe(`
      SELECT id, migration_name, finished_at, applied_steps_count 
      FROM "_prisma_migrations" 
      ORDER BY finished_at ASC;
    `);
    console.log('\nTracked _prisma_migrations in Database:');
    migrations.forEach((m: any) => console.log(`  - [${m.migration_name}] (Applied steps: ${m.applied_steps_count}, Finished: ${m.finished_at})`));

    // Record counts
    const userCount = await prisma.user.count();
    const studentCount = await prisma.student.count();
    const testCenterCount = await prisma.testCenter.count();
    const examHallCount = await prisma.examHall.count();
    const partnerCount = await prisma.partnerInstitution.count();
    const staffCount = await prisma.staff.count();
    const grievanceCount = await prisma.grievanceTicket.count();

    console.log('\nLive Record Counts:');
    console.log(`  Users: ${userCount}`);
    console.log(`  Students: ${studentCount}`);
    console.log(`  Test Centers: ${testCenterCount}`);
    console.log(`  Exam Halls: ${examHallCount}`);
    console.log(`  Partner Institutions: ${partnerCount}`);
    console.log(`  Staff Members: ${staffCount}`);
    console.log(`  Grievance Tickets: ${grievanceCount}`);
  } catch (err: any) {
    console.error('Database query error:', err.message);
  }

  // ---------------------------------------------------------
  // 3. CRITICAL ROUTE AUTHENTICATION VERIFICATION
  // ---------------------------------------------------------
  console.log('\n--- 3. CRITICAL ROUTE AUTHENTICATION & ROLE VERIFICATION ---');

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const port = (server.address() as any).port;
  const baseUrl = `http://localhost:${port}`;

  try {
    // Test /api/students/purge-all-system-data without token
    const resPurgeNoAuth = await fetch(`${baseUrl}/api/students/purge-all-system-data`, { method: 'POST' });
    console.log(`POST /api/students/purge-all-system-data (No Auth): Status ${resPurgeNoAuth.status} (Expected: 401) -> ${resPurgeNoAuth.status === 401 ? 'PASS' : 'FAIL'}`);

    // Test GET /api/students without token
    const resGetStudentsNoAuth = await fetch(`${baseUrl}/api/students`);
    console.log(`GET /api/students (No Auth): Status ${resGetStudentsNoAuth.status} (Expected: 401) -> ${resGetStudentsNoAuth.status === 401 ? 'PASS' : 'FAIL'}`);

    // Test GET /api/students/:id without token
    const resGetStudentIdNoAuth = await fetch(`${baseUrl}/api/students/some-id`);
    console.log(`GET /api/students/:id (No Auth): Status ${resGetStudentIdNoAuth.status} (Expected: 401) -> ${resGetStudentIdNoAuth.status === 401 ? 'PASS' : 'FAIL'}`);

    // Test GET /api/dashboard/overview without token
    const resDashboardNoAuth = await fetch(`${baseUrl}/api/dashboard/overview`);
    console.log(`GET /api/dashboard/overview (No Auth): Status ${resDashboardNoAuth.status} (Expected: 401) -> ${resDashboardNoAuth.status === 401 ? 'PASS' : 'FAIL'}`);

    // Test GET /api/users without token
    const resUsersNoAuth = await fetch(`${baseUrl}/api/users`);
    console.log(`GET /api/users (No Auth): Status ${resUsersNoAuth.status} (Expected: 401) -> ${resUsersNoAuth.status === 401 ? 'PASS' : 'FAIL'}`);
  } finally {
    server.close();
  }

  // ---------------------------------------------------------
  // 4. STORAGE BUCKET VERIFICATION
  // ---------------------------------------------------------
  console.log('\n--- 4. SUPABASE STORAGE BUCKET VERIFICATION ---');
  try {
    const { data: buckets, error } = await (supabaseStorage as any).client?.storage?.listBuckets() || { data: [] };
    console.log('Supabase Storage Buckets in cloud:');
    if (buckets) {
      for (const b of buckets) {
        const { data: files } = await (supabaseStorage as any).client.storage.from(b.name).list('', { limit: 100 });
        console.log(`  - Bucket: "${b.name}" | Public: ${b.public} | Root Objects: ${files ? files.length : 0}`);
      }
    }
  } catch (err: any) {
    console.error('Storage bucket listing note:', err.message);
  }

  console.log('\n======================================================');
  console.log('✅ AUDIT RUNNER COMPLETE');
  console.log('======================================================');
}

performAudit().then(() => process.exit(0)).catch((err) => {
  console.error('Audit runner failed:', err);
  process.exit(1);
});
