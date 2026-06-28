import { PrismaClient } from '@prisma/client'
import { PrismaNeon } from '@prisma/adapter-neon'
import { neonConfig } from '@neondatabase/serverless'
import ws from 'ws'

// Configure WebSocket for Neon
neonConfig.webSocketConstructor = ws

// Create a singleton instance
const globalForPrisma = globalThis

// Initialize with Neon adapter
const connectionString = process.env.DATABASE_URL

if (!connectionString) {
    throw new Error('DATABASE_URL is not defined in environment variables')
}

const adapter = new PrismaNeon({ connectionString })

export const prisma = globalForPrisma.prisma || new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
})

if (process.env.NODE_ENV !== 'production') {
    globalForPrisma.prisma = prisma
}

// Graceful shutdown
process.on('beforeExit', async () => {
    await prisma.$disconnect()
})