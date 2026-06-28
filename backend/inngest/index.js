import { Inngest } from "inngest";
import { prisma } from "../lib/prisma.js";

export const inngest = new Inngest({ id: "SYNCup" });

const syncUserCreation = inngest.createFunction(
    { id: "sync-user-from-clerk", triggers: [{ event: "clerk/user.created" }] },
    async ({ event }) => {
        const { data } = event;

        if (!data.id || !data.email_addresses?.[0]?.email_address) {
            throw new Error('Invalid user data');
        }

        // Check if user already exists (idempotency)
        const existingUser = await prisma.user.findUnique({
            where: { id: data.id }
        });

        if (existingUser) {
            console.log(`User ${data.id} already exists, skipping creation`);
            return {
                message: `User already exists: ${data.id}`,
                created: false
            };
        }

        await prisma.user.create({
            data: {
                id: data.id,
                email: data.email_addresses[0].email_address,
                name: (data?.first_name || '') + ' ' + (data?.last_name || ''),
                image: data?.image_url || '',
            }
        });

        return { message: `User created: ${data.id}`, created: true };
    },
);

const syncUserDeletion = inngest.createFunction(
    { id: "delete-user-from-clerk", triggers: [{ event: "clerk/user.deleted" }] },
    async ({ event }) => {
        const { data } = event;

        if (!data.id) {
            throw new Error('User ID is required for deletion');
        }

        // Use deleteMany which won't throw if record doesn't exist
        const result = await prisma.user.deleteMany({
            where: {
                id: data.id
            }
        });

        return {
            message: result.count > 0 ? `User deleted: ${data.id}` : `User not found: ${data.id}`,
            deleted: result.count > 0
        };
    },
);

const syncUserUpdation = inngest.createFunction(
    { id: "update-user-from-clerk", triggers: [{ event: "clerk/user.updated" }] },
    async ({ event }) => {
        const { data } = event;

        if (!data.id || !data.email_addresses?.[0]?.email_address) {
            throw new Error('Invalid user data for update');
        }

        // Check if user exists before update
        const existingUser = await prisma.user.findUnique({
            where: { id: data.id }
        });

        if (!existingUser) {
            // If user doesn't exist, create them (or log and skip)
            console.log(`User ${data.id} not found for update, creating instead`);

            await prisma.user.create({
                data: {
                    id: data.id,
                    email: data.email_addresses[0].email_address,
                    name: (data?.first_name || '') + ' ' + (data?.last_name || ''),
                    image: data?.image_url || '',
                }
            });

            return {
                message: `User created instead of updated: ${data.id}`,
                updated: false,
                created: true
            };
        }

        await prisma.user.update({
            where: {
                id: data.id,
            },
            data: {
                email: data.email_addresses[0].email_address,
                name: (data?.first_name || '') + ' ' + (data?.last_name || ''),
                image: data?.image_url || '',
            }
        });

        return { message: `User updated: ${data.id}`, updated: true };
    },
);

// function to webhook
const syncWorkspaceCreation = inngest.createFunction(
    { id: 'sync-workspace-from-clerk' },
    { event: 'clerk/organization.created' },
    async ({ event }) => {
        const { data } = event;
        await prisma.workspace.create({
            data: {
                id: data.id,
                name: data.name,
                slug: data.slug,
                ownerId: data.ownerId,
                image_url: data.image_url,
            }
        })
        // Add creater as admin member
        await prisma.workspaceMember.create({
            data: {
                userId: data.created_by,
                workspaceId: data.id,
                role: 'ADMIN',
            }
        })
    }
)

const syncWorkspaceUpdation = inngest.createFunction(
    { id: 'upate-workspace-from-clerk' },
    { event: 'clerk/organization.updated' },
    async ({ event }) => {
        const { data } = event;
        await prisma.workspace.update({
            where: {
                id: data.id
            },
            data: {
                id: data.id,
                name: data.name,
                slug: data.slug,
                image_url: data.image_url,
            }
        })
    }
)

const syncWorkspaceDeletion = inngest.createFunction(
    { id: 'delete-workspace-from-clerk' },
    { event: 'clerk/organization.deleted' },
    async ({ event }) => {
        const { data } = event;
        await prisma.workspace.deleted({
            where: {
                id: data.id
            },
            data: {
                id: data.id,
                name: data.name,
                slug: data.slug,
                image_url: data.image_url,
            }
        })
    }
)

const syncWorkspaceMemeberCreation = inngest.createFunction(
    { id: 'sync-workspace-member-from-clerk' },
    { event: 'clerk/organization.accepted' },
    async ({ event }) => {
        const { data } = event;
        await prisma.workspaceMember.create({
            data: {
                userId: data.user_id,
                workspaceId: data.organization_id,
                role: String(data.role_name).toUpperCase(),
            }
        })
    }
)

export const functions = [
    syncUserCreation,
    syncUserDeletion,
    syncUserUpdation,
    syncWorkspaceCreation,
    syncWorkspaceDeletion,
    syncWorkspaceUpdation,
    syncWorkspaceMemeberCreation
];