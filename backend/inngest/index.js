import { Inngest } from "inngest";
import { prisma } from "../lib/prisma.js";
import sendEmail from "../lib/nodemailer.js";

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

// inngest function to send email on task creation
const sendTaskAssignmentEmail = inngest.createFunction(
    {
        id: 'sync-task-member-assignment-mail',
        triggers: [{ event: 'app/task.assigned' }]
    },
    async ({ event, step }) => {
        const { taskId, origi } = event.data;

        const task = await prisma.task.findUnique({
            where: { id: taskId },
            include: { assignee: true, project: true }
        })

        await sendEmail({
            to: task.assignee.email,
            subject: `New Task assignment in ${task.project.name}`,
            body: `<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f4f7fc;">

                <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f4f7fc; padding: 40px 20px;">
                    <tr>
                    <td align="center">
                        <!-- Main container -->
                        <table width="580" cellpadding="0" cellspacing="0" border="0" style="background-color: #ffffff; border-radius: 16px; box-shadow: 0 4px 12px rgba(0,0,0,0.08); padding: 40px 48px; max-width: 580px; width: 100%;">
                        
                        <!-- Header -->
                        <tr>
                            <td style="padding-bottom: 24px; border-bottom: 2px solid #eef2f6;">
                            <table width="100%" cellpadding="0" cellspacing="0" border="0">
                                <tr>
                                <td style="font-size: 13px; font-weight: 600; color: #1a3a5f; background: #eef3fa; padding: 6px 16px; border-radius: 40px; display: inline-block;">
                                    📬 TASK ASSIGNED
                                </td>
                                <td align="right" style="font-size: 13px; font-weight: 600; color: #1a3a5f; background: #dbeafe; padding: 6px 16px; border-radius: 40px; display: inline-block;">
                                    ⚡ action required
                                </td>
                                </tr>
                            </table>
                            </td>
                        </tr>

                        <!-- Greeting: Hii ${task.assignee.name} -->
                        <tr>
                            <td style="padding-top: 24px; font-size: 22px; font-weight: 600; color: #0b1e33;">
                            Hii <span style="background: #e6f0ff; padding: 2px 14px; border-radius: 30px; color: #0052cc;">${task.assignee.name}</span> 👋
                            </td>
                        </tr>

                        <!-- Task Title: ${task.title} -->
                        <tr>
                            <td style="padding-top: 16px; font-size: 28px; font-weight: 600; color: #0a1e2f; line-height: 1.3;">
                            📌 ${task.title}
                            </td>
                        </tr>

                        <!-- Due Date: new Date(task.due_date).toLocaleDateString() -->
                        <tr>
                            <td style="padding-top: 14px;">
                            <table cellpadding="0" cellspacing="0" border="0" style="background: #f0f5fe; padding: 10px 24px 10px 20px; border-radius: 60px; display: inline-block;">
                                <tr>
                                <td style="font-size: 18px; font-weight: 500; color: #00337a;">
                                    📅 ${new Date(task.due_date).toLocaleDateString()}
                                    <span style="font-weight: 400; color: #2d4b71; margin-left: 6px;">(due date)</span>
                                </td>
                                </tr>
                            </table>
                            </td>
                        </tr>

                        <!-- Divider -->
                        <tr>
                            <td style="padding: 28px 0 30px 0;">
                            <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 0;">
                            </td>
                        </tr>

                        <!-- CTA Button: <a href="${origin}"> -->
                        <tr>
                            <td>
                            <a href="${origin}" style="display: inline-block; background: #0052cc; color: #ffffff !important; text-decoration: none; padding: 14px 40px; border-radius: 60px; font-weight: 600; font-size: 18px; box-shadow: 0 6px 14px rgba(0, 82, 204, 0.25); border: 1px solid #0047b3;">
                                🚀 View task
                            </a>
                            </td>
                        </tr>

                        <!-- Origin link (full URL) -->
                        <tr>
                            <td style="padding-top: 14px;">
                            <table cellpadding="0" cellspacing="0" border="0" style="background: #f8faff; padding: 8px 18px; border-radius: 30px; border: 1px dashed #cbd5e1; display: inline-block;">
                                <tr>
                                <td style="font-size: 14px; color: #4b5b6e; font-family: 'SF Mono', 'Menlo', monospace;">
                                    🔗 <a href="${origin}" style="color: #0052cc; text-decoration: none; border-bottom: 1px dotted #a0b9d9;">${origin}</a>
                                </td>
                                </tr>
                            </table>
                            </td>
                        </tr>

                        <!-- Footer -->
                        <tr>
                            <td style="padding-top: 32px; margin-top: 32px; border-top: 1px solid #e8edf4;">
                            <table width="100%" cellpadding="0" cellspacing="0" border="0">
                                <tr>
                                <td style="font-size: 14px; color: #5c6f87;">
                                    <span style="background: #dfe8f3; padding: 2px 12px; border-radius: 30px; font-size: 13px; font-weight: 500; color: #1d3b5c;">assignee</span>
                                    <span style="margin-left: 6px;">${task.assignee.name}</span>
                                </td>
                                <td align="right" style="font-size: 14px; color: #5c6f87;">
                                    <span style="background: #dfe8f3; padding: 2px 12px; border-radius: 30px; font-size: 13px; font-weight: 500; color: #1d3b5c;">due</span>
                                    <span style="margin-left: 6px;">${new Date(task.due_date).toLocaleDateString()}</span>
                                </td>
                                </tr>
                            </table>
                            </td>
                        </tr>

                        <!-- Origin note -->
                        <tr>
                            <td style="padding-top: 18px; font-size: 13px; color: #6f85a0; text-align: center; border-top: 1px dashed #dce3ec; margin-top: 16px; padding-top: 18px;">
                            ⚡ origin: ${origin}
                            </td>
                        </tr>

                        </table>
                    </td>
                    </tr>
                </table>

                </body>`
        })
        if (new Date(task.due_date).toLocaleDateString() !== new Date().toDateString()) {
            await step.sleepUntil('await-for-the-due-date', new Date(task.due_date));

            await step.run('check-is-task-is-completed', async () => {
                const task = await prisma.task.findUnique({
                    where: { id: taskId },
                    include: { assignee: true, project: true }
                })

                if (!task) {
                    return;
                }

                if (task.status !== "DONE") {
                    await step.run('send-task-reminder-mail', async () => {
                        await sendEmail({
                            to: task.assignee.email,
                            subject: `Reminder for ${task.project.name}`,
                            body: `<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #fef8e7;">

                            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #fef8e7; padding: 40px 20px;">
                                <tr>
                                <td align="center">
                                    <!-- Main container -->
                                    <table width="580" cellpadding="0" cellspacing="0" border="0" style="background-color: #ffffff; border-radius: 16px; box-shadow: 0 4px 12px rgba(0,0,0,0.08); padding: 40px 48px; max-width: 580px; width: 100%;">
                                    
                                    <!-- Header with reminder badge -->
                                    <tr>
                                        <td style="padding-bottom: 24px; border-bottom: 2px solid #fdebd0;">
                                        <table width="100%" cellpadding="0" cellspacing="0" border="0">
                                            <tr>
                                            <td style="font-size: 13px; font-weight: 600; color: #7b3f00; background: #fdebd0; padding: 6px 16px; border-radius: 40px; display: inline-block;">
                                                ⏰ REMINDER
                                            </td>
                                            <td align="right" style="font-size: 13px; font-weight: 600; color: #c0392b; background: #fadbd8; padding: 6px 16px; border-radius: 40px; display: inline-block;">
                                                ⚡ due soon
                                            </td>
                                            </tr>
                                        </table>
                                        </td>
                                    </tr>

                                    <!-- Greeting -->
                                    <tr>
                                        <td style="padding-top: 24px; font-size: 22px; font-weight: 600; color: #0b1e33;">
                                        Hi <span style="background: #fdebd0; padding: 2px 14px; border-radius: 30px; color: #7b3f00;">${task.assignee.name}</span> 👋
                                        </td>
                                    </tr>

                                    <!-- Reminder message -->
                                    <tr>
                                        <td style="padding-top: 12px; font-size: 18px; color: #2c3e50; line-height: 1.6;">
                                        This is a friendly reminder that you have a task due soon:
                                        </td>
                                    </tr>

                                    <!-- Task Title -->
                                    <tr>
                                        <td style="padding-top: 16px; font-size: 26px; font-weight: 600; color: #1a1a2e; line-height: 1.3; background: #fef9f0; padding: 16px 20px; border-radius: 12px; border-left: 4px solid #e67e22;">
                                        📌 ${task.title}
                                        </td>
                                    </tr>

                                    <!-- Due Date with urgency -->
                                    <tr>
                                        <td style="padding-top: 18px;">
                                        <table cellpadding="0" cellspacing="0" border="0" style="background: #fdebd0; padding: 12px 24px; border-radius: 60px; display: inline-block; border: 1px solid #f5cba7;">
                                            <tr>
                                            <td style="font-size: 18px; font-weight: 600; color: #7b3f00;">
                                                📅 Due: ${new Date(task.due_date).toLocaleDateString()}
                                                <span style="font-weight: 400; color: #a04000; margin-left: 8px; font-size: 16px;">
                                                ${(() => {
                                    const now = new Date();
                                    const due = new Date(task.due_date);
                                    const diffDays = Math.ceil((due - now) / (1000 * 60 * 60 * 24));
                                    if (diffDays < 0) return '⚠️ OVERDUE';
                                    if (diffDays === 0) return '⏰ TODAY';
                                    if (diffDays === 1) return '📆 Tomorrow';
                                    return `in ${diffDays} days`;
                                })()}
                                                </span>
                                            </td>
                                            </tr>
                                        </table>
                                        </td>
                                    </tr>

                                    <!-- Urgency note -->
                                    <tr>
                                        <td style="padding-top: 16px;">
                                        <table cellpadding="0" cellspacing="0" border="0" style="background: #fef9e7; padding: 12px 20px; border-radius: 8px; border: 1px solid #f9e79f; width: 100%;">
                                            <tr>
                                            <td style="font-size: 15px; color: #6c3483; text-align: center;">
                                                ⭐ Please complete this task on time to avoid delays.
                                            </td>
                                            </tr>
                                        </table>
                                        </td>
                                    </tr>

                                    <!-- Divider -->
                                    <tr>
                                        <td style="padding: 24px 0 28px 0;">
                                        <hr style="border: none; border-top: 1px solid #fdebd0; margin: 0;">
                                        </td>
                                    </tr>

                                    <!-- Action Buttons -->
                                    <tr>
                                        <td>
                                        <table width="100%" cellpadding="0" cellspacing="0" border="0">
                                            <tr>
                                            <td align="center">
                                                <a href="${origin}" style="display: inline-block; background: #e67e22; color: #ffffff !important; text-decoration: none; padding: 14px 40px; border-radius: 60px; font-weight: 600; font-size: 18px; box-shadow: 0 6px 14px rgba(230, 126, 34, 0.3); border: 1px solid #d35400; margin-right: 12px;">
                                                🚀 View Task
                                                </a>
                                                <a href="${origin}/complete" style="display: inline-block; background: #27ae60; color: #ffffff !important; text-decoration: none; padding: 14px 40px; border-radius: 60px; font-weight: 600; font-size: 18px; box-shadow: 0 6px 14px rgba(39, 174, 96, 0.3); border: 1px solid #229954; margin-top: 10px;">
                                                ✅ Mark Complete
                                                </a>
                                            </td>
                                            </tr>
                                        </table>
                                        </td>
                                    </tr>

                                    <!-- Quick link -->
                                    <tr>
                                        <td style="padding-top: 16px; text-align: center;">
                                        <span style="font-size: 13px; color: #7f8c8d;">
                                            🔗 Direct link: <a href="${origin}" style="color: #e67e22; text-decoration: none; border-bottom: 1px dotted #e67e22;">${origin}</a>
                                        </span>
                                        </td>
                                    </tr>

                                    <!-- Footer -->
                                    <tr>
                                        <td style="padding-top: 32px; margin-top: 32px; border-top: 1px solid #fdebd0;">
                                        <table width="100%" cellpadding="0" cellspacing="0" border="0">
                                            <tr>
                                            <td style="font-size: 14px; color: #5c6f87;">
                                                <span style="background: #fdebd0; padding: 2px 12px; border-radius: 30px; font-size: 13px; font-weight: 500; color: #7b3f00;">assignee</span>
                                                <span style="margin-left: 6px;">${task.assignee.name}</span>
                                            </td>
                                            <td align="right" style="font-size: 14px; color: #5c6f87;">
                                                <span style="background: #fdebd0; padding: 2px 12px; border-radius: 30px; font-size: 13px; font-weight: 500; color: #7b3f00;">priority</span>
                                                <span style="margin-left: 6px; color: #e67e22; font-weight: 600;">${task.priority || 'High'}</span>
                                            </td>
                                            </tr>
                                        </table>
                                        </td>
                                    </tr>

                                    <!-- Reminder footer -->
                                    <tr>
                                        <td style="padding-top: 18px; font-size: 13px; color: #95a5a6; text-align: center; border-top: 1px dashed #fdebd0; margin-top: 16px; padding-top: 18px;">
                                        ⏰ Reminder sent at ${new Date().toLocaleString()}
                                        </td>
                                    </tr>

                                    </table>
                                </td>
                                </tr>
                            </table>
                            </body>`
                        })
                    })
                }
            })
        }

    }
)

export const functions = [
    syncUserCreation,
    syncUserDeletion,
    syncUserUpdation,
    syncWorkspaceCreation,
    syncWorkspaceDeletion,
    syncWorkspaceUpdation,
    syncWorkspaceMemberCreation,
    syncWorkspaceMemberDeletion,
    sendTaskAssignmentEmail,
];