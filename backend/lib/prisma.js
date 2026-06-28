import { PrismaClient } from '@prisma/client'
import { PrismaNeon } from '@prisma/adapter-neon'
import { neonConfig } from '@neondatabase/serverless'
import ws from 'ws'

// Only configure WebSocket in development
if (process.env.NODE_ENV !== 'production') {
    neonConfig.webSocketConstructor = ws
}

const globalForPrisma = globalThis

// Get connection string
const connectionString = process.env.DATABASE_URL

if (!connectionString) {
    throw new Error('DATABASE_URL is not defined in environment variables')
}

// Create adapter
const adapter = new PrismaNeon({ connectionString })

// Create client with adapter
const prismaClient = new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
})

export const prisma = globalForPrisma.prisma || prismaClient

if (process.env.NODE_ENV !== 'production') {
    globalForPrisma.prisma = prisma
}