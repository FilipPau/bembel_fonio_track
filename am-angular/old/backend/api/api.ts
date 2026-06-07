import { Request, Response, Router } from "express";
import todosRoute from "./features/todos/todos.routes";

const router = Router();
router.use("/todos", todosRoute);

/**
 * Health check route
 * This route can be used to check if the API is running and healthy
 */
router.get('/health', (req: Request, res: Response) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        environment: process.env['NODE_ENV'] || 'development'
    });
});

export default router;