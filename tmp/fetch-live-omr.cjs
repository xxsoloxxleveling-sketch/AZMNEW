require(process.cwd() + '/node_modules/dotenv').config();
const fs = require('fs');
const jwt = require(process.cwd() + '/node_modules/jsonwebtoken');
const { prisma } = require(process.cwd() + '/dist/lib/prisma');

async function main() {
  const admin = await prisma.user.findFirst({ where: { role: 'SUPER_ADMIN' } });
  if (!admin) throw new Error('No admin available for diagnostic');
  const token = jwt.sign({ userId: admin.id, email: admin.email, name: admin.name, role: admin.role }, process.env.JWT_ACCESS_SECRET, { expiresIn: '120s' });
  const response = await fetch('http://127.0.0.1:5000/api/students/cmu0ydzve0061pj5zxi7idpy2/omr-sheet-pdf', { headers: { Authorization: `Bearer ${token}` } });
  if (!response.ok) throw new Error(`OMR request failed: ${response.status}`);
  fs.writeFileSync('/tmp/azm-live-omr.pdf', Buffer.from(await response.arrayBuffer()));
}
main().catch(error => { console.error(error.message); process.exitCode = 1; }).finally(() => prisma.$disconnect());
