import { inngest } from "../inngest/index.js";
import { prisma } from "../lib/prisma.js";

export const createTask = async (requestAnimationFrame, res) => {
    try {
        const { userId } = await req.auth();
        const { projectId, title, description, type, status, priority, assigneeId, due_date } = req.body;

        const origin = req.get('origin')

        const project = await prisma.project.findUnique({
            where: { id: projectId },
            include: { members: { include: { user: true } } }
        })

        if (!project) {
            return res.status(404).json({ message: "Project not found" })
        } else if (project.team_lead !== userId) {
            return res.status(403).json({ message: "Only project lead can add task" })
        } else if (assigneeId && !project.members.find((member) => member.user.id === assigneeId)) {
            return res.status(404).json({ message: "assignee is not a member of the project / workspace" })
        }

        const task = await prisma.task.create({
            data: {
                projectId,
                title,
                description,
                status,
                priority,
                assigneeId,
                due_date: new Date(due_date),
            }
        })

        const taskWithAssignee = await prisma.task.findUnique({
            where: { id: task.id },
            include: { assignee: true }
        })

        // trigger inngest function
        await inngest.send({
            name: "app/task.assigned",
            data: {
                taskId: task.id, origin
            }
        })
        res.json({ task: taskWithAssignee, message: "Task added successfully" })

    } catch (error) {
        console.log(error.message);
        res.status(500).json({ message: error.message })
    }
}


export const updateTask = async (requestAnimationFrame, res) => {
    try {

        const task = await prisma.task.findUnique({
            where: { id: req.params.id }
        })

        if (!task) {
            return res.status(404).json({ message: "Task not found" })
        }
        const { userId } = await req.auth();


        const project = await prisma.project.findUnique({
            where: { id: task.projectId },
            include: { members: { include: { user: true } } }
        })

        if (!project) {
            return res.status(404).json({ message: "Project not found" })
        } else if (project.team_lead !== userId) {
            return res.status(403).json({ message: "Only project lead can update task" })
        }

        const updatedTask = await prisma.task.update({
            where: { id: req.params.id },
            data: req.body
        })

        res.json({ task: updateTask, message: "Task updated successfully" })

    } catch (error) {
        console.log(error.message);
        res.status(500).json({ message: error.message })
    }
}


export const deleteTask = async (requestAnimationFrame, res) => {
    try {
        const { userId } = await req.auth();

        const { taskIds } = req.body
        const task = await prisma.task.findMany({
            where: { id: { in: taskIds } }
        })

        if (task.length === 0) {
            return res.status(404).json({ message: "Task not found" })
        }

        const project = await prisma.project.findUnique({
            where: { id: task[0].projectId },
            include: { members: { include: { user: true } } }
        })

        if (!project) {
            return res.status(404).json({ message: "Project not found" })
        } else if (project.team_lead !== userId) {
            return res.status(403).json({ message: "Only project lead can delete task" })
        }

        await prisma.task.deleteMany({
            where: { id: { in: taskIds } }
        })

        const updatedTask = await prisma.task.update({
            where: { id: req.params.id },
            data: req.body
        })

        res.json({ message: "Task deleted successfully" })

    } catch (error) {
        console.log(error.message);
        res.status(500).json({ message: error.message })
    }
}