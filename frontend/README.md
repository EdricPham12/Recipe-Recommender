# Frontend (no-build)

Mở trực tiếp `index.html` là chạy được, nhưng khuyến nghị chạy server tĩnh:

```bash
cd frontend
python -m http.server 5173
```

Vào `http://127.0.0.1:5173`.

## OCR
- OCR dùng Tesseract.js qua CDN.
- Ngôn ngữ: `vie+eng`.

## API
Frontend gọi `POST /api/generate` ở `http://127.0.0.1:8000` (mặc định).
Nếu backend chưa chạy, app sẽ tự fallback “demo recipe” để bạn test UI trước.

