from dotenv import load_dotenv
load_dotenv()
from flask import Flask, request, jsonify
from flask_cors import CORS
import json
import os
import re
import random

app = Flask(__name__)
CORS(app)

# OpenAI client
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


def _dedupe_results(results):
    seen = set()
    out = []
    for r in results:
        title = (r.get('title') or 'Mon goi y').strip()
        key = title.lower()
        if key in seen:
            continue
        seen.add(key)
        out.append(r)
    return out


def _fallback_recipes(ingredients, count):
    styles = ["Xao", "Kho", "Canh", "Nuong", "Chien", "Hap", "Sup", "Salad", "Sot", "Rim"]
    bases = [s for s in ingredients if s]
    if not bases:
        bases = ["rau cu"]
    main = bases[0]
    out = []
    for i in range(max(0, count)):
        style = styles[i % len(styles)]
        title = f"{style} {main}"
        used = []
        for item in bases:
            if item.lower() not in [x.lower() for x in used]:
                used.append(item)
            if len(used) >= 5:
                break
        out.append({
            'title': title,
            'ingredients': used,
            'steps': [
                "So che nguyen lieu, cat vua an.",
                "Lam nong chao, phi thom hanh/toi neu co.",
                f"Cho {main} vao che bien, nem muoi/nuoc mam vua an.",
                "Hoan thien va dung nong."
            ],
            'tips': ["Co the dieu chinh gia vi theo khau vi."],
            'time': {'prep_min': 8 + i, 'cook_min': 12 + i},
            'servings': 2,
            'difficulty': 'easy'
        })
    return out


@app.after_request
def add_cors_headers(resp):
    resp.headers['Access-Control-Allow-Origin'] = '*'
    resp.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization'
    resp.headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS'
    return resp


@app.route('/api/identify-food', methods=['OPTIONS'])
def identify_food_options():
    return ('', 200)


@app.route('/api/suggest-recipes', methods=['OPTIONS'])
def suggest_recipes_options():
    return ('', 200)


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
        "Ban la dau bep. Hay nhan dien mon an/ nguyen lieu trong anh. "
        "Uu tien nguyen lieu chinh (thit, rau, ca, trung, gia vi). "
        "Bo qua do dung khong phai nguyen lieu (dia, muong, dao, bat, nen ban). "
        "Tra ve JSON thuan: {\"dish\": string, \"ingredients\": [string], \"confidence\": number}."
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
        text = (resp.output_text or '').strip()
        parsed = _extract_json(text) or {}
        dish = parsed.get('dish') or ''
        ingredients = parsed.get('ingredients') or []
        confidence = parsed.get('confidence') or 0
        return jsonify({'dish': dish, 'ingredients': ingredients, 'confidence': confidence})
    except Exception as e:
        print('OpenAI identify call failed', e)
        return jsonify({'error': 'openai identify failed'}), 500


@app.route('/api/suggest-recipes', methods=['POST'])
def suggest_recipes():
    if openai_client is None:
        return jsonify({'error': 'OpenAI client not configured. Install openai and set OPENAI_API_KEY.'}), 500

    data = request.get_json(silent=True) or {}
    raw_ingredients = data.get('ingredients')

    if isinstance(raw_ingredients, str):
        ingredients = [s.strip() for s in raw_ingredients.split(',') if s.strip()]
    elif isinstance(raw_ingredients, list):
        ingredients = [str(s).strip() for s in raw_ingredients if str(s).strip()]
    else:
        ingredients = []

    if not ingredients:
        return jsonify({'error': 'no ingredients provided'}), 400

    try:
        count = int(data.get('count') or (data.get('constraints') or {}).get('recipe_count') or 0)
    except Exception:
        count = 0

    if count <= 0:
        n = len(ingredients)
        if n < 3:
            count = 1
        elif n < 6:
            count = 2
        else:
            count = 3
    count = max(1, count)

    prompt = (
        f"Ban la dau bep. Hay goi y DUNG {count} mon an phu hop tu danh sach nguyen lieu. "
        "Moi mon can khac nhau ve phong cach (xao, kho, canh, nuong, hap, salad, sup, chien, sot...). "
        "Tranh lap lai ten mon. Khong duoc tra ve it hon so luong yeu cau. "
        "Uu tien mon Viet, huong dan vua phai (khong qua dai), de lam. "
        "Tra ve JSON thuan theo schema: "
        "{\"results\":[{\"title\":string,"
        "\"ingredients\":[{\"name\":string,\"qty\":string}],"
        "\"steps\":[string],\"tips\":[string],"
        "\"time\":{\"prep_min\":number,\"cook_min\":number},"
        "\"servings\":number,\"difficulty\":\"easy|medium|hard\"}]}. "
        "Trong ingredients, them so luong uoc tinh (vd: 200g, 1 muong, 2 qua). "
        "Khong them giai thich."
    )

    try:
        resp = openai_client.responses.create(
            model="gpt-4.1-mini",
            input=[{
                "role": "user",
                "content": [
                    {"type": "input_text", "text": prompt + "\nNguyen lieu: " + ", ".join(ingredients)},
                ],
            }],
        )
        text = (resp.output_text or '').strip()
        parsed = _extract_json(text) or {}
        results = parsed.get('results') or []
        norm = []
        for r in results:
            if not isinstance(r, dict):
                continue
            raw_ing = r.get('ingredients') or []
            ingredients = []
            if isinstance(raw_ing, list):
                for it in raw_ing:
                    if isinstance(it, dict):
                        name = it.get('name') or it.get('ingredient') or ''
                        qty = it.get('qty') or it.get('quantity') or ''
                        if name:
                            ingredients.append({'name': name, 'qty': qty})
                    elif isinstance(it, str):
                        ingredients.append({'name': it, 'qty': ''})
            norm.append({
                'title': r.get('title') or 'Mon goi y',
                'ingredients': ingredients,
                'steps': r.get('steps') or [],
                'tips': r.get('tips') or [],
                'time': r.get('time') or {},
                'servings': r.get('servings') or 2,
                'difficulty': r.get('difficulty') or 'easy'
            })
        norm = _dedupe_results(norm)
        if len(norm) < count:
            need = count - len(norm)
            fillers = _fallback_recipes(ingredients, need)
            norm.extend(_dedupe_results(fillers))
        return jsonify({'results': norm[:count]})
    except Exception as e:
        print('OpenAI suggest call failed', e)
        return jsonify({'error': 'openai suggest failed'}), 500


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 8000))
    app.run(host='0.0.0.0', port=port, debug=True)
