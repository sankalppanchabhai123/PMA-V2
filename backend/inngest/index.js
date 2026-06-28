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

        const existingUser = await prisma.user.findUnique({
            where: { id: data.id }
        });

        if (!existingUser) {
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

// ✅ FIXED: Workspace Creation
const syncWorkspaceCreation = inngest.createFunction(
    {
        id: 'sync-workspace-from-clerk',
        triggers: [{ event: 'clerk/organization.created' }]
    },
    async ({ event }) => {
        const { data } = event;

        // Check if workspace already exists
        const existingWorkspace = await prisma.workspace.findUnique({
            where: { id: data.id }
        });

        if (existingWorkspace) {
            console.log(`Workspace ${data.id} already exists, skipping creation`);
            return { message: `Workspace already exists: ${data.id}` };
        }

        await prisma.workspace.create({
            data: {
                id: data.id,
                name: data.name,
                slug: data.slug,
                ownerId: data.created_by,
                image_url: data.image_url || '',
            }
        });

        // Add creator as admin member
        await prisma.workspaceMember.create({
            data: {
                userId: data.created_by,
                workspaceId: data.id,
                role: 'ADMIN',
            }
        });

        return { message: `Workspace created: ${data.id}` };
    }
);

// ✅ FIXED: Workspace Update
const syncWorkspaceUpdation = inngest.createFunction(
    {
        id: 'update-workspace-from-clerk',
        triggers: [{ event: 'clerk/organization.updated' }]
    },
    async ({ event }) => {
        const { data } = event;

        // Check if workspace exists
        const existingWorkspace = await prisma.workspace.findUnique({
            where: { id: data.id }
        });

        if (!existingWorkspace) {
            console.log(`Workspace ${data.id} not found for update`);
            return { message: `Workspace not found: ${data.id}` };
        }

        await prisma.workspace.update({
            where: {
                id: data.id
            },
            data: {
                name: data.name,
                slug: data.slug,
                image_url: data.image_url || '',
            }
        });

        return { message: `Workspace updated: ${data.id}` };
    }
);

// ✅ FIXED: Workspace Deletion
const syncWorkspaceDeletion = inngest.createFunction(
    {
        id: 'delete-workspace-from-clerk',
        triggers: [{ event: 'clerk/organization.deleted' }]
    },
    async ({ event }) => {
        const { data } = event;

        // Use deleteMany for safe deletion
        const result = await prisma.workspace.deleteMany({
            where: {
                id: data.id
            }
        });

        // Also delete all workspace members
        if (result.count > 0) {
            await prisma.workspaceMember.deleteMany({
                where: {
                    workspaceId: data.id
                }
            });
        }

        return {
            message: result.count > 0 ? `Workspace deleted: ${data.id}` : `Workspace not found: ${data.id}`,
            deleted: result.count > 0
        };
    }
);

// ✅ FIXED: Workspace Member Creation
const syncWorkspaceMemberCreation = inngest.createFunction(
    {
        id: 'sync-workspace-member-from-clerk',
        triggers: [{ event: 'clerk/organization.accepted' }]
    },
    async ({ event }) => {
        const { data } = event;

        // Check if member already exists
        const existingMember = await prisma.workspaceMember.findUnique({
            where: {
                userId_workspaceId: {
                    userId: data.user_id,
                    workspaceId: data.organization_id
                }
            }
        });

        if (existingMember) {
            console.log(`Member ${data.user_id} already in workspace ${data.organization_id}`);
            return { message: 'Member already exists' };
        }

        await prisma.workspaceMember.create({
            data: {
                userId: data.user_id,
                workspaceId: data.organization_id,
                role: String(data.role_name).toUpperCase(),
            }
        });

        return { message: `Workspace member added: ${data.user_id}` };
    }
);

// ✅ FIXED: Workspace Member Deletion (Bonus)
const syncWorkspaceMemberDeletion = inngest.createFunction(
    {
        id: 'sync-workspace-member-deletion-from-clerk',
        triggers: [{ event: 'clerk/organization.rejected' }]
    },
    async ({ event }) => {
        const { data } = event;

        const result = await prisma.workspaceMember.deleteMany({
            where: {
                userId: data.user_id,
                workspaceId: data.organization_id
            }
        });

        return {
            message: result.count > 0 ? `Workspace member removed: ${data.user_id}` : 'Member not found',
            deleted: result.count > 0
        };
    }
);

export const functions = [
    syncUserCreation,
    syncUserDeletion,
    syncUserUpdation,
    syncWorkspaceCreation,
    syncWorkspaceDeletion,
    syncWorkspaceUpdation,
    syncWorkspaceMemberCreation,
    syncWorkspaceMemberDeletion
];