const express = require('express');
const router = express.Router();
const taskController = require('../controllers/taskController');
const { validateTaskInput } = require('../middleware/errorHandler');

// Routes CRUD avec validation
router.get('/', taskController.getAllTasks);
router.get('/:id', taskController.getTaskById);
router.post('/', validateTaskInput, taskController.createTask);  
router.put('/:id', validateTaskInput, taskController.updateTask); 
router.delete('/:id', taskController.deleteTask);

module.exports = router;