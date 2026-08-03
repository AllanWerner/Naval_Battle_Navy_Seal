const express = require('express');
const router = express.Router();
const TaskModel = require('../models/task');
const { validateTaskInput } = require('../middleware/errorHandler');

// POST /api/tasks : Créer une tâche
router.post('/', validateTaskInput, (req, res, next) => {
  try {
    const { description, status } = req.body;
    const task = TaskModel.create(description, status);
    res.status(201).json(task);
  } catch (error) {
    next(error);
  }
});

// GET /api/tasks : Lister toutes les tâches
router.get('/', (req, res, next) => {
  try {
    const tasks = TaskModel.getAll();
    res.json(tasks);
  } catch (error) {
    next(error);
  }
});

// GET /api/tasks/:id : Voir une tâche
router.get('/:id', (req, res, next) => {
  try {
    const task = TaskModel.getById(req.params.id);
    if (!task) {
      const error = new Error('Tâche non trouvée');
      error.status = 404;
      return next(error);
    }
    res.json(task);
  } catch (error) {
    next(error);
  }
});

// PUT /api/tasks/:id : Modifier une tâche
router.put('/:id', validateTaskInput, (req, res, next) => {
  try {
    const { description, status } = req.body;
    const task = TaskModel.update(req.params.id, description, status);
    if (!task) {
      const error = new Error('Tâche non trouvée');
      error.status = 404;
      return next(error);
    }
    res.json(task);
  } catch (error) {
    next(error);
  }
});

// DELETE /api/tasks/:id : Supprimer une tâche
router.delete('/:id', (req, res, next) => {
  try {
    const deleted = TaskModel.delete(req.params.id);
    if (!deleted) {
      const error = new Error('Tâche non trouvée');
      error.status = 404;
      return next(error);
    }
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

module.exports = router;