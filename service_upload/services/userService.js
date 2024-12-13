const express = require('express');
const multer = require('multer');
const { Storage } = require('@google-cloud/storage');
const mysql = require('mysql2');
const Joi = require('joi');

const router = express.Router();

// Setup Google Cloud Storage
const storage = new Storage();
const bucketName = process.env.BUCKET_NAME || 'cofflyze-images';
const bucket = storage.bucket(bucketName);

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

// Validation Schema
const userSchema = Joi.object({
  namaLengkap: Joi.string().required(),
  jenisKelamin: Joi.string().valid('Laki-laki', 'Perempuan').required(),
  nomorHp: Joi.string().optional(),
  alamat: Joi.string().optional(),
  tokenFirebase: Joi.string().optional(),
});

// CREATE - Add a new user
router.post('/', upload.single('fotoProfile'), async (req, res) => {
  try {
    const { error } = userSchema.validate(req.body);
    if (error) {
      return res.status(400).send(error.details[0].message);
    }

    const { namaLengkap, jenisKelamin, nomorHp, alamat, tokenFirebase } = req.body;

    if (!req.file) {
      return res.status(400).send('No file uploaded.');
    }

    // Upload image to Cloud Storage
    const fileName = `fotoProfile/${Date.now()}_${req.file.originalname}`;
    const blob = bucket.file(fileName);
    const blobStream = blob.createWriteStream({
      metadata: {
        contentType: req.file.mimetype,
      },
    });

    blobStream.on('error', (err) => {
      console.error('Upload error:', err);
      res.status(500).send('Error uploading file.');
    });

    blobStream.on('finish', () => {
      const publicUrl = `https://storage.googleapis.com/${bucketName}/${fileName}`;

      // Save data to MySQL
      db.query(
        `INSERT INTO tbl_user (namaLengkap, jenisKelamin, fotoProfile, nomorHp, alamat, tokenFirebase)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [namaLengkap, jenisKelamin, publicUrl, nomorHp, alamat, tokenFirebase],
        (err) => {
          if (err) {
            console.error('Database error:', err);
            return res.status(500).send('Error saving to database.');
          }
          res.status(200).send({ message: 'User created successfully', publicUrl });
        }
      );
    });

    blobStream.end(req.file.buffer);
  } catch (error) {
    console.error('Server error:', error);
    res.status(500).send('Server error.');
  }
});

// READ - Get all users
router.get('/', (req, res) => {
  db.query('SELECT * FROM tbl_user', (err, results) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).send('Error retrieving data.');
    }
    res.status(200).json(results);
  });
});

// READ - Get user by ID
// router.put('/:tokenFirebase', upload.single('fotoProfile'), async (req, res) => {
//   const { tokenFirebase } = req.params;
//   db.query('SELECT * FROM tbl_user WHERE idUser = ?', [idUser], (err, results) => {
//     if (err) {
//       console.error('Database error:', err);
//       return res.status(500).send('Error retrieving data.');
//     }
//     if (!tokenFirebase) {
//       return res.status(400).send('Token Firebase is required.');
//     }
//     res.status(200).json(results[0]);
//   });
// });


// READ - Get user by Token Firebase
router.get('/:tokenFirebase', (req, res) => {
  const { tokenFirebase } = req.params;

  // Validasi apakah tokenFirebase diberikan
  if (!tokenFirebase) {
    return res.status(400).send('Token Firebase is required.');
  }

  // Query ke database berdasarkan tokenFirebase
  db.query(
    'SELECT * FROM tbl_user WHERE tokenFirebase = ?',
    [tokenFirebase],
    (err, results) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).send('Error retrieving data.');
      }

      // Jika tidak ada data ditemukan
      if (results.length === 0) {
        return res.status(404).send('User not found with the provided token.');
      }

      // Kirim hasil data
      res.status(200).json(results[0]);
    }
  );
});


// // UPDATE - Update user by ID
// router.put('/:idUser', upload.single('fotoProfile'), async (req, res) => {
//   const { idUser } = req.params;
//   const { namaLengkap, jenisKelamin, nomorHp, alamat, tokenFirebase } = req.body;

//   let publicUrl = null;

//   if (req.file) {
//     const fileName = `${Date.now()}_${req.file.originalname}`;
//     const blob = bucket.file(fileName);
//     const blobStream = blob.createWriteStream({
//       metadata: {
//         contentType: req.file.mimetype,
//       },
//     });

//     await new Promise((resolve, reject) => {
//       blobStream.on('finish', () => {
//         publicUrl = `https://storage.googleapis.com/${bucketName}/${fileName}`;
//         resolve();
//       });
//       blobStream.on('error', reject);
//       blobStream.end(req.file.buffer);
//     });
//   }

//   db.query(
//     `UPDATE tbl_user SET namaLengkap = ?, jenisKelamin = ?, fotoProfile = COALESCE(?, fotoProfile),
//     nomorHp = ?, alamat = ?, tokenFirebase = ? WHERE idUser = ?`,
//     [namaLengkap, jenisKelamin, publicUrl, nomorHp, alamat, tokenFirebase, idUser],
//     (err, results) => {
//       if (err) {
//         console.error('Database error:', err);
//         return res.status(500).send('Error updating user.');
//       }
//       if (results.affectedRows === 0) {
//         return res.status(404).send('User not found.');
//       }
//       res.status(200).send({ message: 'User updated successfully', publicUrl });
//     }
//   );
// });

// UPDATE - Update user by tokenFirebase from URL
router.put('/:tokenFirebase', upload.single('fotoProfile'), async (req, res) => {
  const { tokenFirebase } = req.params; // Ambil tokenFirebase dari URL
  const { namaLengkap, jenisKelamin, nomorHp, alamat } = req.body;

  if (!tokenFirebase) {
    return res.status(400).send('Token Firebase is required.');
  }

  let publicUrl = null;

  // Jika ada file yang diunggah, upload ke Google Cloud Storage
  if (req.file) {
    const fileName = `fotoProfile/${Date.now()}_${req.file.originalname}`;
    const blob = bucket.file(fileName);
    const blobStream = blob.createWriteStream({
      metadata: {
        contentType: req.file.mimetype,
      },
    });

    try {
      await new Promise((resolve, reject) => {
        blobStream.on('finish', () => {
          publicUrl = `https://storage.googleapis.com/${bucketName}/${fileName}`;
          resolve();
        });
        blobStream.on('error', reject);
        blobStream.end(req.file.buffer);
      });
    } catch (error) {
      console.error('Upload error:', error);
      return res.status(500).send('Error uploading file.');
    }
  }

  // Update data di database
  db.query(
    `UPDATE tbl_user SET namaLengkap = ?, jenisKelamin = ?, fotoProfile = COALESCE(?, fotoProfile),
    nomorHp = ?, alamat = ? WHERE tokenFirebase = ?`,
    [namaLengkap, jenisKelamin, publicUrl, nomorHp, alamat, tokenFirebase],
    (err, results) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).send('Error updating user.');
      }
      if (results.affectedRows === 0) {
        return res.status(404).send('User not found with the provided token.');
      }
      res.status(200).send({ message: 'User updated successfully', publicUrl });
    }
  );
});


// DELETE - Delete user by ID
router.delete('/:idUser', (req, res) => {
  const { idUser } = req.params;

  db.query('SELECT fotoProfile FROM tbl_user WHERE idUser = ?', [idUser], (err, results) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).send('Error retrieving data.');
    }
    if (results.length === 0) {
      return res.status(404).send('User not found.');
    }

    const publicUrl = results[0].fotoProfile;
    const fileName = publicUrl.split('/').pop();

    bucket
      .file(fileName)
      .delete()
      .catch((err) => console.error('Error deleting file from GCS:', err));

    db.query('DELETE FROM tbl_user WHERE idUser = ?', [idUser], (err) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).send('Error deleting user.');
      }
      res.status(200).send('User deleted successfully.');
    });
  });
});

module.exports = router;
