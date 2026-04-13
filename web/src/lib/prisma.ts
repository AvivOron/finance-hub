import { PrismaClient } from '@prisma/client'
import { withAccelerate } from '@prisma/extension-accelerate'

const globalForPrisma = globalThis as unknown as { prisma: ReturnType<typeof makePrisma> }

function makePrisma() {
  return new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error']
  }).$extends(withAccelerate())
}

export const prisma = globalForPrisma.prisma ?? makePrisma()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
