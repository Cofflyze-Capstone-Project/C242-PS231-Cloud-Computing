const express = require('express');
require('dotenv').config();

const userService = require('./services/userService');
const historyService = require('./services/historyService');
const articleService = require('./services/articleService'); 
const app = express();
const PORT = process.env.PORT || 8000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Route untuk userService
app.use('/users', userService);

// Route historyService
app.use('/history', historyService);

// Route articleService
app.use('/articles', articleService); 

// Home route
app.get('/', (req, res) => {
  res.send('Welcome to the User Service API!');
});

// Start Server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
