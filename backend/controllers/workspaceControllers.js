import { use } from "react";
import { prisma } from "../lib/prisma.js";
import NodeCache from 'node-cache';
const cache = new NodeCache({ stdTTL: 60 });

export const clearWorkspaceCache = (userId) => {
    const cacheKey = `workspaces_${userId}`;
    cache.del(cacheKey);
};

export const getUserWorkspaces = async (req, res) => {
    try {
        const { userId } = await req.auth();
        const cacheKey = `workspaces_${userId}`;

        // Check cache
        let workspaces = cache.get(cacheKey);

        if (!workspaces) {
            workspaces = await prisma.workspace.findMany({
                where: {
                    members: { some: { userId: userId } }
                },
                include: {
                    members: {
                        include: {
                            user: {
                                select: {
                                    id: true,
                                    name: true,
                                    email: true,
                                    image: true
                                }
                            }
                        }
                    },
                    projects: {
                        include: {
                            tasks: {
                                include: {
                                    assignee: {
                                        select: {
                                            id: true,
                                            name: true,
                                            email: true,
                                            image: true
                                        }
                                    },
                                    comments: {
                                        include: {
                                            user: {
                                                select: {
                                                    id: true,
                                                    name: true,
                                                    email: true,
                                                    image: true
                                                }
                                            }
                                        },
                                        orderBy: {
                                            createdAt: 'desc'
                                        }
                                    }
                                },
                                orderBy: {
                                    createdAt: 'desc'
                                }
                            },
                            members: {
                                include: {
                                    user: {
                                        select: {
                                            id: true,
                                            name: true,
                                            email: true,
                                            image: true
                                        }
                                    }
                                }
                            }
                        },
                        orderBy: {
                            createdAt: 'desc'
                        }
                    },
                    owner: {
                        select: {
                            id: true,
                            name: true,
                            email: true,
                            image: true
                        }
                    }
                },
                orderBy: {
                    createdAt: 'desc'
                }
            });

            // Store in cache
            cache.set(cacheKey, workspaces);
        }

        res.set('Cache-Control', 'private, max-age=60');
        res.json({ workspaces })
    } catch (error) {
        console.error('Error fetching workspaces:', error);
        res.status(500).json({
            message: error.message,
            code: error.code
        })
    }
}

export const addMember = async (req, res) => {
    try {
        const { userId } = await req.auth();
        const { email, role, workspaceId, message } = req.body;

        const user = await prisma.user.findUnique({ where: { email } });

        if (!user) {
            return res.status(404).json({ message: "User not found" })
        }

        if (!workspaceId || !role) {
            return res.status(400).json({ message: "Missing require parameters" })
        }

        if (!["ADMIN", "MEMBER"].includes(role)) {
            return res.status(400).json({ message: "Invalide role" })
        }

        const workspace = await prisma.workspace.findUnique({
            where: { id: workspaceId },
            include: { members: true }
        })

        if (!workspace) {
            return res.status(404).json({ message: "workspace not found" })
        }

        if (!workspace.members.find((member) => member.userId === userId && member.role === "ADMIN")) {
            return res.status(401).json({ message: "You don't have admin access" })
        }

        const existingMember = workspace.members.find((member) => member.userId === userId);

        if (existingMember) {
            return res.status(401).json({ message: "User is  already a member" })
        }

        const member = await prisma.workspaceMember.create({
            data: {
                userId: user.id,
                workspace,
                role,
                message
            }
        })

        return res.status(200).json({ member, message: "member added successfully" })

    } catch (error) {
        console.log(error);
        res.status(500).json({ message: error.code })
    }
}