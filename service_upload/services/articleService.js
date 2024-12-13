const express = require('express');
const multer = require('multer');
const mysql = require('mysql2');
require('dotenv').config();

const router = express.Router();

// Setup MySQL Connection
const db = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

// Multer Configuration
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // Max file size: 5MB
});

// CREATE - Add a new article
router.post('/', async (req, res) => {
  const { judul, article, foto } = req.body;

  if (!judul || !article) {
    return res.status(400).send({ error: 'Missing required fields: judul or article' });
  }

  try {
    const [result] = await db.promise().query(
      'INSERT INTO tbl_articles (judul, article, foto) VALUES (?, ?, ?)',
      [judul, article, foto || null]
    );

    const articleId = result.insertId;
    const [newArticle] = await db.promise().query('SELECT * FROM tbl_articles WHERE id = ?', [articleId]);

    res.status(201).send(newArticle[0]);
  } catch (error) {
    console.error('Error adding article:', error.message);
    res.status(500).send({ error: 'Failed to add article' });
  }
});

// READ - Get all articles
router.get('/', async (req, res) => {
  try {
    const [rows] = await db.promise().query('SELECT * FROM tbl_articles');
    res.status(200).json(rows);
  } catch (error) {
    console.error('Error fetching articles:', error.message);
    res.status(500).send({ error: 'Failed to retrieve articles' });
  }
});

// READ - Get article by ID
router.get('/:id', async (req, res) => {
  const { id } = req.params;

  if (!id || isNaN(id)) {
    return res.status(400).send({ error: 'Invalid article ID' });
  }

  try {
    const [rows] = await db.promise().query('SELECT * FROM tbl_articles WHERE id = ?', [id]);

    if (rows.length === 0) {
      return res.status(404).send({ error: 'Article not found' });
    }

    res.status(200).json(rows[0]);
  } catch (error) {
    console.error('Error fetching article by ID:', error.message);
    res.status(500).send({ error: 'Failed to retrieve article' });
  }
});

// UPDATE - Update article by ID
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { judul, article, foto } = req.body;

  if (!judul || !article) {
    return res.status(400).send({ error: 'Missing required fields: judul or article' });
  }

  try {
    const [result] = await db.promise().query(
      'UPDATE tbl_articles SET judul = ?, article = ?, foto = ? WHERE id = ?',
      [judul, article, foto || null, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).send({ error: 'Article not found' });
    }

    const [updatedArticle] = await db.promise().query('SELECT * FROM tbl_articles WHERE id = ?', [id]);

    res.status(200).send({ message: 'Article updated successfully', article: updatedArticle[0] });
  } catch (error) {
    console.error('Error updating article:', error.message);
    res.status(500).send({ error: 'Failed to update article' });
  }
});

// DELETE - Delete article by ID
router.delete('/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const [result] = await db.promise().query('DELETE FROM tbl_articles WHERE id = ?', [id]);

    if (result.affectedRows === 0) {
      return res.status(404).send({ error: 'Article not found' });
    }

    res.status(200).send({ message: 'Article deleted successfully' });
  } catch (error) {
    console.error('Error deleting article:', error.message);
    res.status(500).send({ error: 'Failed to delete article' });
  }
});

module.exports = router;
