from flask import Flask, request, jsonify
import base64
import json
import os
import re

app = Flask(__name__)

# OpenAI Vision
try:
    from openai import OpenAI
    openai_client = OpenAI()
except Exception as e:
    openai_client = None
    print('OpenAI client not available:', e)


def _extract_json(text: str):
    if not text:
        return None
    match = re.search(r"\{.*\}", text, re.DOTALL)
    if not match:
        return None
    try:
        return json.loads(match.group(0))
    except Exception:
        return None


@app.route('/api/identify-food', methods=['POST'])
def identify_food():
    if openai_client is None:
        return jsonify({'error': 'OpenAI client not configured. Install openai and set OPENAI_API_KEY.'}), 500
    data = request.get_json(silent=True) or {}
    img = data.get('image')
    if not img:
        return jsonify({'error': 'no image provided'}), 400

    if img.startswith('data:'):
        image_url = img
    else:
        image_url = f"data:image/jpeg;base64,{img}"

    prompt = (
        "Ban la tro ly nhan dien thuc pham. CHI lay NGUYEN LIEU an duoc (thit, rau, gia vi). TUYET DOI bo qua do vat khong phai nguyen lieu: dia, to, chen, ly, muong, dua, dao, ban, go, thot, khan, hop. Neu khong chac chan do la nguyen lieu, KHONG them vao danh sach. Tap trung vao NGUYEN LIEU an duoc (thit, rau, gia vi). Bo qua do vat khong phai nguyen lieu: dia, to, chen, ly, muong, dua, dao, ban, go, thot. "
        "Hay xac dinh mon an (neu ro) va liet ke nguyen lieu nhin thay ro, "
        "bao gom ca cac nguyen lieu phu xung quanh (vi du: tieu, rau, gia vi). "
        "Tra ve JSON thuan theo schema: "
        "{\"dish\": string|null, \"ingredients\": [string], \"confidence\": number 0-1}. "
        "Khong them giai thich."
    )

    try:
        resp = openai_client.responses.create(
            model="gpt-4.1-mini",
            input=[{
                "role": "user",
                "content": [
                    {"type": "input_text", "text": prompt},
                    {"type": "input_image", "image_url": image_url},
                ],
            }],
        )
        text = (resp.output_text or "").strip()
        parsed = _extract_json(text) or {}
        dish = parsed.get('dish')
        ingredients = parsed.get('ingredients') or []
        confidence = parsed.get('confidence', 0)
        if not isinstance(ingredients, list):
            ingredients = []
        return jsonify({'dish': dish, 'ingredients': ingredients, 'confidence': confidence})
    except Exception as e:
        print('OpenAI vision call failed', e)
        return jsonify({'error': 'openai vision failed'}), 500


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 8000))
    app.run(host='0.0.0.0', port=port, debug=True)


