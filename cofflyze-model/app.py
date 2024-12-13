import os
os.environ["CUDA_VISIBLE_DEVICES"] = "-1" 

from flask import Flask, request, jsonify
from google.cloud import storage
import tensorflow as tf
import uuid
import mysql.connector
from dotenv import load_dotenv
from datetime import datetime
from io import BytesIO
from PIL import Image
import pytz  # Untuk penanganan zona waktu

# Muat variabel lingkungan dari .env
load_dotenv()

app = Flask(__name__)

# Load model
MODEL_PATH = 'model/my_model.h5'
try:
    model = tf.keras.models.load_model(MODEL_PATH)
except Exception as e:
    raise RuntimeError(f"Failed to load model: {str(e)}")

# Konfigurasi GCS
GCS_BUCKET_NAME = os.getenv('GCS_BUCKET_NAME')
if not GCS_BUCKET_NAME:
    raise RuntimeError("GCS_BUCKET_NAME not set in environment variables")

storage_client = storage.Client()
bucket = storage_client.bucket(GCS_BUCKET_NAME)

# Konfigurasi Database
db_config = {
    "host": os.getenv("DB_HOST"),
    "user": os.getenv("DB_USER"),
    "password": os.getenv("DB_PASSWORD"),
    "database": os.getenv("DB_NAME")
}

# Data penyakit
DISEASE_DETAILS = {
    "Rust": {
        "deskripsi": "Rust atau karat daun kopi adalah penyakit yang disebabkan oleh jamur Hemileia vastatrix. Penyakit ini menyerang daun kopi, ditandai dengan bercak kuning-jingga seperti serbuk pada permukaan atas dan bawah daun. Bercak ini awalnya kuning muda, kemudian berubah menjadi jingga atau oranye yang mirip serbuk. Daun yang terinfeksi akan rontok, membuat pohon menjadi gundul dan hasil kopi menurun drastis. Dalam beberapa kasus, infeksi yang tidak terkendali dapat menyebabkan pohon mati dalam beberapa tahun. Menurut Bhattacharyya et al. (2020), varietas tahan seperti S795 dan USDA762 telah dikembangkan untuk mengatasi penyakit ini. Pengendalian juga melibatkan penggunaan fungisida berbahan aktif tembaga seperti Nordox atau Bayleton, yang efektif jika digunakan sebelum infeksi terjadi. Sanitasi kebun dan pengelolaan naungan juga penting untuk menurunkan kelembapan dan mencegah penyebaran spora.",
        "penyebab": "Jamur Hemileia vastatrix yang menyebar melalui spora di udara.",
        "gejala": "Bercak kuning di daun yang berubah cokelat. Bercak jingga pada bagian bawah daun dengan serbuk oranye. Daun rontok, pohon gundul.",
        "faktor_risiko": "Kelembapan tinggi, curah hujan tinggi, varietas kopi yang rentan.",
        "penanganan": "Gunakan varietas tahan seperti S795 dan USDA762. Aplikasikan fungisida berbahan aktif tembaga dengan konsentrasi 0,3% atau fungisida sistemik berbahan triadimefon.",
        "pencegahan": "Sanitasi kebun, pemangkasan, dan pengelolaan naungan. Gunakan ekstrak biji mahoni atau bubur bordo sebagai fungisida nabati."
    },
    "Phoma": {
        "deskripsi": "Penyakit Phoma disebabkan oleh jamur Phoma costarricensis atau Phoma sp., yang menyebar melalui spora yang terbawa angin, air hujan, atau kontak langsung dengan daun yang terinfeksi. Gejala utamanya adalah bercak cokelat gelap atau hitam pada daun dengan tepi tidak beraturan. Pada kondisi parah, infeksi dapat menyebar ke batang atau buah kopi. Menurut Zambrano et al. (2021), kelembapan tinggi dan drainase tanah yang buruk merupakan faktor utama yang meningkatkan risiko penyakit ini. Pemangkasan untuk meningkatkan ventilasi, penggunaan fungisida berbasis tembaga, dan pemberian nutrisi yang cukup sangat dianjurkan sebagai langkah pengendalian. Selain itu, sanitasi kebun dengan membuang daun yang terinfeksi dapat memutus siklus hidup jamur.",
        "penyebab": "Jamur Phoma costarricensis yang menyebar melalui spora melalui angin, air hujan, atau kontak langsung.",
        "gejala": "Bercak cokelat gelap atau hitam dengan tepi tidak beraturan. Daun mengering dan rontok, infeksi parah dapat menjalar ke batang.",
        "faktor_risiko": "Kelembapan tinggi, suhu optimal 20-25°C, drainase buruk, stres tanaman akibat kurang nutrisi.",
        "penanganan": "Sanitasi kebun dengan menghilangkan daun yang terinfeksi. Gunakan fungisida berbasis tembaga atau sistemik.",
        "pencegahan": "Pemangkasan untuk meningkatkan ventilasi, pemberian nutrisi yang cukup, dan pengelolaan drainase tanah."

    },
    "Miner": {
        "deskripsi": "Miner atau leaf miner pada tanaman kopi adalah penyakit yang disebabkan oleh larva serangga dari keluarga Lepidoptera (ngengat) atau Diptera (lalat). Larva ini hidup dalam jaringan daun dan membentuk terowongan kecil saat memakan lapisan sel daun. Gejala yang terlihat adalah jalur atau terowongan kecil pada daun, yang menyebabkan daun menjadi kuning, mengering, dan rontok. Akibatnya, fotosintesis terganggu, yang berdampak pada penurunan kualitas dan hasil panen. Menurut Rathore et al. (2019), pengendalian biologis dengan memperkenalkan musuh alami seperti parasitoid dapat membantu menekan populasi leaf miner. Selain itu, pemantauan rutin dan penggunaan pestisida selektif yang ramah lingkungan sangat efektif dalam mencegah kerusakan yang lebih parah.",
        "penyebab": "Larva serangga dari keluarga Lepidoptera (ngengat) atau Diptera (lalat) yang hidup dalam daun.",
        "gejala": "Jalur atau terowongan kecil pada daun. Daun menjadi kuning, mengering, dan rontok. Penurunan fotosintesis.",
        "faktor_risiko": "Kelebihan populasi serangga, kebun yang tidak disanitasi, kurangnya pemantauan rutin.",
        "penanganan": "Sanitasi kebun dengan menghancurkan daun yang terinfeksi. Gunakan pestisida selektif yang ramah lingkungan.",
        "pencegahan": "Introduksi musuh alami seperti parasitoid. Pemantauan rutin untuk deteksi dini, dan pemberian pupuk untuk meningkatkan daya tahan tanaman."
    },
    "Healthy": {
        "deskripsi": "Tanaman kopi yang sehat memiliki daun hijau tua dengan permukaan yang bersih tanpa adanya bercak, jalur, atau kerusakan lainnya. Tanaman yang sehat menunjukkan pertumbuhan yang optimal, daun tidak menguning atau rontok, dan tidak ada tanda-tanda infeksi penyakit atau serangan hama. Selain itu, tanaman yang sehat memberikan hasil panen yang maksimal dengan kualitas biji yang baik. Menurut penelitian oleh Silva et al. (2018), praktik budidaya yang baik, termasuk penggunaan pupuk organik, irigasi yang tepat, dan pemangkasan rutin, dapat menjaga kesehatan tanaman kopi.",
        "penyebab": "Kondisi tumbuh yang optimal, seperti keseimbangan nutrisi, drainase tanah yang baik, dan sanitasi kebun yang terjaga.",
        "gejala": "Daun hijau tua tanpa bercak atau kerusakan. Tanaman menunjukkan pertumbuhan yang seragam dan sehat.",
        "faktor_risiko": "Perawatan tanaman yang kurang, kekurangan nutrisi, pengelolaan kebun yang buruk.",
        "penanganan": "Pastikan pemberian pupuk yang cukup, irigasi teratur, dan lakukan pemangkasan untuk menjaga ventilasi.",
        "pencegahan": "Sanitasi kebun secara berkala, gunakan pupuk organik, dan pantau tanaman secara rutin untuk mendeteksi perubahan awal."
    }
}

def save_to_gcs(file, filename):
    """Simpan file ke Google Cloud Storage."""
    blob = bucket.blob(filename)
    file.seek(0)  # Reset cursor file sebelum mengunggah
    blob.upload_from_file(file)
    blob.make_public()  # Buat URL publik
    return blob.public_url

# Fungsi untuk mendapatkan waktu lokal Indonesia
def get_indonesia_time():
    timezone = pytz.timezone('Asia/Jakarta')
    return datetime.now(timezone)

@app.route('/predict', methods=['GET', 'POST'])
def predict():
    if request.method == 'GET':
        try:
            with mysql.connector.connect(**db_config) as conn:
                with conn.cursor(dictionary=True) as cursor:
                    cursor.execute("SELECT * FROM tbl_predict ORDER BY tanggal DESC")
                    predictions = cursor.fetchall()
        except Exception as e:
            return jsonify({"error": f"Database error: {str(e)}"}), 500

        return jsonify(predictions)

    if request.method == 'POST':
        if 'image' not in request.files:
            return jsonify({"error": "No image provided"}), 400

        image = request.files['image']
        if image.filename == '':
            return jsonify({"error": "No file selected"}), 400

        if not image.mimetype.startswith("image/"):
            return jsonify({"error": "File is not an image"}), 400

        image.seek(0)
        unique_filename = f"{uuid.uuid4()}.jpg"
        try:
            image_url = save_to_gcs(image, unique_filename)
        except Exception as e:
            return jsonify({"error": f"Failed to save image to GCS: {str(e)}"}), 500

        image.seek(0)
        try:
            img = BytesIO(image.read())
            # pil_img = Image.open(img).convert("RGB")
            # pil_img = pil_img.resize((150, 150))
            # img_array = tf.keras.utils.img_to_array(pil_img)
            # img_array = img_array / 255.0

            pil_img = Image.open(img).convert("RGB")
            pil_img = pil_img.resize((150, 150))
            img_array = tf.keras.utils.img_to_array(pil_img)  # Hasilnya (150, 150, 3)
            img_array = img_array / 255.0  # Normalisasi ke [0, 1]
            img_array = tf.expand_dims(img_array, axis=0)  # Tambahkan dimensi batch, jadi (1, 150, 150, 3)

            prediction = model.predict(img_array)[0]  # Hasil prediksi adalah array 1D
            predicted_class_index = int(tf.argmax(prediction).numpy())
            confidence = float(prediction[predicted_class_index])

            class_names = ['Miner', 'Healthy', 'Phoma', 'Rust']
            predicted_class_name = class_names[predicted_class_index]

            CONFIDENCE_THRESHOLD = 0.7  
            if confidence < CONFIDENCE_THRESHOLD:
                return jsonify({
                    "error": "The uploaded image is not recognized as a coffee leaf.",
                    "confidence": f"{confidence * 100:.2f}%"
                }), 400

            disease_info = DISEASE_DETAILS.get(predicted_class_name, {})
        except Exception as e:
            return jsonify({"error": f"Prediction error: {str(e)}"}), 500

        current_timestamp = get_indonesia_time()

        try:
            with mysql.connector.connect(**db_config) as conn:
                with conn.cursor() as cursor:
                    sql = """
                    INSERT INTO tbl_predict (
                        gambar, akurasi, tanggal, penyakit, deskripsi, penyebab, gejala, 
                        faktor_risiko, penanganan, pencegahan
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    """
                    cursor.execute(sql, (
                        image_url, f"{confidence * 100:.2f}", current_timestamp.strftime("%Y-%m-%d %H:%M:%S"),
                        predicted_class_name, disease_info.get("deskripsi"),
                        disease_info.get("penyebab"), disease_info.get("gejala"),
                        disease_info.get("faktor_risiko"), disease_info.get("penanganan"),
                        disease_info.get("pencegahan")
                    ))
                    conn.commit()
        except Exception as e:
            return jsonify({"error": f"Database error: {str(e)}"}), 500

        return jsonify({
            "image_url": image_url,
            "confidence": f"{confidence * 100:.2f}%",
            "penyakit": predicted_class_name,
            "deskripsi": disease_info.get("deskripsi", ""),
            "penyebab": disease_info.get("penyebab", ""),
            "gejala": disease_info.get("gejala", ""),
            "faktor_risiko": disease_info.get("faktor_risiko", ""),
            "penanganan": disease_info.get("penanganan", ""),
            "pencegahan": disease_info.get("pencegahan", ""),
            "tanggal": current_timestamp.strftime("%Y-%m-%d %H:%M:%S")
        })

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8080)