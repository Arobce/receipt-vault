import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import "dotenv/config";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const categories = [
  { name: "Groceries", icon: "🛒" },
  { name: "Dining", icon: "🍽️" },
  { name: "Gas & Auto", icon: "⛽" },
  { name: "Electronics", icon: "💻" },
  { name: "Clothing", icon: "👕" },
  { name: "Healthcare", icon: "💊" },
  { name: "Home & Garden", icon: "🏠" },
  { name: "Entertainment", icon: "🎬" },
  { name: "Travel", icon: "✈️" },
  { name: "Other", icon: "📦" },
];

async function main() {
  for (const cat of categories) {
    await prisma.category.upsert({
      where: { name: cat.name },
      update: { icon: cat.icon },
      create: cat,
    });
  }
  console.log(`Seeded ${categories.length} categories`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
