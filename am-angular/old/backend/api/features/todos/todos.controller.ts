import { prisma } from '../../lib/prisma';
import type { Request, Response, NextFunction } from 'express';

export const getTodos = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const todos = await prisma.todo.findMany();
  res.json(todos);
};

export const getTodoById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const { id } = req.params;
  const todo = await prisma.todo.findUnique({ where: { id: Number(id) } });
  if (!todo) {
    res.status(404).json({ message: 'Todo not found' });
    return;
  }
  res.json(todo);
};

export const createTodo = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const { title, description } = req.body;
  const todo = await prisma.todo.create({
    data: { title, description },
  });
  res.status(201).json(todo);
};

export const updateTodo = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const { id } = req.params;
  const { title, description, completed } = req.body;
  const todo = await prisma.todo.update({
    where: { id: Number(id) },
    data: { title, description, completed },
  });
  res.json(todo);
};

export const deleteTodo = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const { id } = req.params;
  await prisma.todo.delete({ where: { id: Number(id) } });
  res.status(204).send();
};