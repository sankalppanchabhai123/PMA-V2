import express from "express";
import { addMember, createProject, updateProject } from "../controllers/projectController.js";

const projectRoute = express.Router();

projectRoute.post("/", createProject);
projectRoute.put("/", updateProject);
projectRoute.post("/:projectId/addMember", addMember);

export default projectRoute;