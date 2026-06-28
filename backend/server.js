import express from 'express';
import 'dotenv/config';
import cors from 'cors'
import { clerkMiddleware, clerkClient, requireAuth, getAuth } from '@clerk/express'
import { serve } from "inngest/express";
import { inngest, functions } from "./inngest/index.js"


const app = express()

app.use(express.json());
app.use(cors())
app.use(clerkMiddleware())

app.get("/", (req, res) => {
    res.send("server is live!");
})
app.use("/api/inngest", serve({ client: inngest, functions }));

app.get('/protected', requireAuth(), async (req, res) => {
    // Use `getAuth()` to get the user's `userId`
    const { userId } = getAuth(req)

    // Use the `getUser()` method to get the user's User object
    const user = await clerkClient.users.getUser(userId)

    return res.json({ user })
})

app.listen(3000, () => { console.log("Server is running on port 3000") })