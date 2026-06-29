import express from "express";
import { addComment, getTaskComments } from "../controllers/commentController.js";


const commentRoute = express.Router();

commentRoute.post("/", addComment);
commentRoute.get("/:taskId", getTaskComments);

export default commentRoute;