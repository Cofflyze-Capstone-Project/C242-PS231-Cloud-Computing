const express = require('express');
const router = express.Router();
const mysql = require('mysql2');
const Joi = require('joi');
const moment = require('moment-timezone');
require('dotenv').config();

// Setup MySQL Connection
const db = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

// Validation Schema for History
const historySchema = Joi.object({
  gambar: Joi.string().optional(), // Gambar sebagai teks (URL atau base64)
  akurasi: Joi.string().required(),
  nama_penyakit: Joi.string().max(100).required(),
  deskripsi: Joi.string().required(),
  penyebab: Joi.string().optional(),
  gejala: Joi.string().optional(),
  faktor_risiko: Joi.string().optional(),
  penanganan: Joi.string().optional(),
  pencegahan: Joi.string().optional(),
  tokenFirebase: Joi.string().required(),
});

// Fungsi untuk mendapatkan waktu lokal Indonesia
function getIndonesiaTime() {
  return moment.tz('Asia/Jakarta').format('YYYY-MM-DD HH:mm:ss');
}

// CREATE - Add a new history record
router.post('/', async (req, res) => {
  try {
    const { error } = historySchema.validate(req.body);
    if (error) {
      return res.status(400).send(error.details[0].message);
    }

    const {
      gambar, // Gambar langsung diterima sebagai teks
      akurasi,
      nama_penyakit,
      deskripsi,
      penyebab,
      gejala,
      faktor_risiko,
      penanganan,
      pencegahan,
      tokenFirebase,
    } = req.body;

    const tanggal = getIndonesiaTime();

    // Save data to MySQL
    db.query(
      `INSERT INTO tbl_history 
      (gambar, akurasi, tanggal, nama_penyakit, deskripsi, penyebab, gejala, faktor_risiko, penanganan, pencegahan, tokenFirebase)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        gambar || null, 
        akurasi,
        tanggal,
        nama_penyakit,
        deskripsi,
        penyebab || null,
        gejala || null,
        faktor_risiko || null,
        penanganan || null,
        pencegahan || null,
        tokenFirebase,
      ],
      (err) => {
        if (err) {
          console.error('Database error:', err);
          return res.status(500).send('Error saving to database.');
        }
        res.status(201).send({ message: 'History created successfully' });
      }
    );
  } catch (error) {
    console.error('Server error:', error);
    res.status(500).send('Server error.');
  }
});

// READ - Get all history records
router.get('/', (req, res) => {
  db.query('SELECT * FROM tbl_history', (err, results) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).send('Error retrieving data.');
    }
    res.status(200).json(results);
  });
});

// READ - Get history record by tokenFirebase
router.get('/:tokenFirebase', (req, res) => {
  const { tokenFirebase } = req.params;

  if (!tokenFirebase) {
    return res.status(400).send('Token Firebase is required.');
  }

  db.query(
    'SELECT * FROM tbl_history WHERE tokenFirebase = ?',
    [tokenFirebase],
    (err, results) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).send('Error retrieving data.');
      }
      if (results.length === 0) {
        return res.status(404).send('No history records found for the provided token.');
      }
      res.status(200).json(results);
    }
  );
});

// READ - Get history record by tokenFirebase and id_history
router.get('/:tokenFirebase/:id_history', (req, res) => {
  const { tokenFirebase, id_history } = req.params;

  if (!tokenFirebase || !id_history) {
    return res.status(400).send('Token Firebase and ID are required.');
  }

  db.query(
    'SELECT * FROM tbl_history WHERE tokenFirebase = ? AND id_history = ?',
    [tokenFirebase, id_history],
    (err, results) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).send('Error retrieving data.');
      }
      if (results.length === 0) {
        return res.status(404).send('No history records found for the provided token and ID.');
      }
      res.status(200).json(results);
    }
  );
});


// DELETE - Delete history record by ID
router.delete('/:id_history', (req, res) => {
  const { id_history } = req.params;

  db.query('DELETE FROM tbl_history WHERE id_history = ?', [id_history], (err) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).send('Error deleting history record.');
    }
    res.status(200).send('History record deleted successfully.');
  });
});

module.exports = router;
