const { Task } = require('../models');

// Récupérer toutes les tâches
exports.getAllTasks = async (req, res, next) => {
  try {
    const tasks = await Task.findAll({
      order: [['createdAt', 'DESC']]
    });
    res.json({ success: true, data: tasks });
  } catch (error) {
    next(error);
  }
};

// Récupérer une tâche par ID
exports.getTaskById = async (req, res, next) => {
  try {
    const task = await Task.findByPk(req.params.id);
    if (!task) {
      const error = new Error('Task not found');
      error.status = 404;
      return next(error);
    }
    res.json({ success: true, data: task });
  } catch (error) {
    next(error);
  }
};

// Créer une nouvelle tâche (validation déjà faite par validateTaskInput)
exports.createTask = async (req, res, next) => {
  try {
    // Les données sont déjà validées par validateTaskInput
    const taskData = {
      title: req.body.title || 'Sans titre',
      description: req.body.description,
      status: req.body.status || 'pending',
      priority: req.body.priority || 'medium',
      dueDate: req.body.dueDate || null
    };

    const task = await Task.create(taskData);
    res.status(201).json({ 
      success: true, 
      data: task 
    });
  } catch (error) {
    // Gestion des erreurs Sequelize (validation, contraintes, etc.)
    if (error.name === 'SequelizeValidationError') {
      const err = new Error(error.errors.map(e => e.message).join(', '));
      err.status = 400;
      err.details = error.errors.map(e => ({
        field: e.path,
        message: e.message,
        value: e.value
      }));
      return next(err);
    }
    next(error);
  }
};

// Mettre à jour une tâche (validation déjà faite par validateTaskInput)
exports.updateTask = async (req, res, next) => {
  try {
    const task = await Task.findByPk(req.params.id);
    if (!task) {
      const error = new Error('Task not found');
      error.status = 404;
      return next(error);
    }
    
    // Seuls les champs fournis sont mis à jour
    const updateData = {};
    if (req.body.title !== undefined) updateData.title = req.body.title;
    if (req.body.description !== undefined) updateData.description = req.body.description;
    if (req.body.status !== undefined) updateData.status = req.body.status;
    if (req.body.priority !== undefined) updateData.priority = req.body.priority;
    if (req.body.dueDate !== undefined) updateData.dueDate = req.body.dueDate;
    
    // Si le status passe à 'completed', on ajoute la date
    if (req.body.status === 'completed' && task.status !== 'completed') {
      updateData.completedAt = new Date();
    }
    
    await task.update(updateData);
    res.json({ success: true, data: task });
  } catch (error) {
    if (error.name === 'SequelizeValidationError') {
      const err = new Error(error.errors.map(e => e.message).join(', '));
      err.status = 400;
      err.details = error.errors.map(e => ({
        field: e.path,
        message: e.message,
        value: e.value
      }));
      return next(err);
    }
    next(error);
  }
};

// Supprimer une tâche
exports.deleteTask = async (req, res, next) => {
  try {
    const task = await Task.findByPk(req.params.id);
    if (!task) {
      const error = new Error('Task not found');
      error.status = 404;
      return next(error);
    }
    
    await task.destroy();
    res.json({ 
      success: true, 
      message: 'Task deleted successfully' 
    });
  } catch (error) {
    next(error);
  }
};