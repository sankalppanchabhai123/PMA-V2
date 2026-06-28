import { Inngest } from "inngest";
import { prisma } from "../lib/prisma.js";

export const inngest = new Inngest({ id: "SYNCup" });

const syncUserCreation = inngest.createFunction(
    { id: "sync-user-from-clerk", triggers: [{ event: "clerk/user.created" }] },
    async ({ event }) => {
        const { data } = event;

        // Add validation
        if (!data.id || !data.email_addresses?.[0]?.email_address) {
            throw new Error('Invalid user data');
        }

        await prisma.user.create({
            data: {
                id: data.id,
                email: data.email_addresses[0].email_address,
                name: data?.first_name + " " + data?.last_name,
                image: data?.image_url,
            }
        });

        return { message: `User created: ${data.id}` };
    },
);

const syncUserDeletion = inngest.createFunction(
    { id: "delete-user-from-clerk", triggers: [{ event: "clerk/user.deleted" }] },
    async ({ event }) => {
        const { data } = event;

        if (!data.id) {
            throw new Error('User ID is required for deletion');
        }

        await prisma.user.delete({
            where: {
                id: data.id
            }
        });

        return { message: `User deleted: ${data.id}` };
    },
);

const syncUserUpdation = inngest.createFunction(
    { id: "update-user-from-clerk", triggers: [{ event: "clerk/user.updated" }] }, // Fixed typo
    async ({ event }) => {
        const { data } = event;

        if (!data.id || !data.email_addresses?.[0]?.email_address) {
            throw new Error('Invalid user data for update');
        }

        await prisma.user.update({
            where: {
                id: data.id,
            },
            data: {
                email: data.email_addresses[0].email_address,
                name: data?.first_name + " " + data?.last_name,
                image: data?.image_url,
            }
        });

        return { message: `User updated: ${data.id}` };
    },
);

export const functions = [syncUserCreation, syncUserDeletion, syncUserUpdation];