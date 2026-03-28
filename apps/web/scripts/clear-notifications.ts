import { prisma } from '@line-oa/db';

async function main() {
  const result = await prisma.notification.deleteMany({});
  console.log(`Deleted ${result.count} notifications`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
