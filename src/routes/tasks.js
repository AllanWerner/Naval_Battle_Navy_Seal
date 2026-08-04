const express = require('express');
const router = express.Router();
const taskController = require('../controllers/taskController');
const { validateTaskCreate, validateTaskUpdate  } = require('../middleware/errorHandler');

// Routes CRUD avec validation
router.get('/', taskController.getAllTasks);
router.get('/:id', taskController.getTaskById);
router.post('/', validateTaskCreate, taskController.createTask);  
router.put('/:id', validateTaskUpdate, taskController.updateTask); 
router.delete('/:id', taskController.deleteTask);

module.exports = router;