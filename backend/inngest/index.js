import { Inngest } from "inngest";
import { prisma } from "../lib/prisma.js";

// Create a client to send and receive events
export const inngest = new Inngest({ id: "SYNCup" });
// inngest function to create user from clerk
const syncUserCreation = inngest.createFunction(
    { id: "sync-user-from-clerk", triggers: [{ event: "clerk/user.created" }] },
    async ({ event }) => {
        const { data } = event
        await prisma.user.create({
            data: {
                id: data.id,
                email: data.email_addresses[0]?.email_addresses,
                name: data?.first_name + " " + data?.last_name,
                image: data?.image_url,

            }
        })
        return { message: `Hello ${event.data.email}!` };
    },
);

// inngest function to delete user from clerk
const syncUserDeletion = inngest.createFunction(
    { id: "delete-user-from-clerk", triggers: [{ event: "clerk/user.deleted" }] },
    async ({ event }) => {
        const { data } = event
        await prisma.user.delete({
            where: {
                id: data.id
            }
        })
        return { message: `Hello ${event.data.email}!` };
    },
);
// inngest function to update user from clerk
const syncUserUpdation = inngest.createFunction(
    { id: "update-user-from-clerk", triggers: [{ event: "clerk/user.creted" }] },
    async ({ event }) => {
        const { data } = event
        await prisma.user.update({
            where: {
                id: data.id,
            },
            data: {
                email: data.email_addresses[0]?.email_addresses,
                name: data?.first_name + " " + data?.last_name,
                image: data?.image_url,
            }
        })
        return { message: `Hello ${event.data.email}!` };
    },
);

// Create an empty array where we'll export future Inngest functions
export const functions = [syncUserCreation, syncUserDeletion, syncUserUpdation];