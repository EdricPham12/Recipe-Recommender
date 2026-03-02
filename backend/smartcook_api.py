from __future__ import annotations

import os
import tempfile
import uuid
from collections import defaultdict
from functools import lru_cache
from pathlib import Path
from typing import Any

import cv2
import numpy as np
import torch
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from PIL import Image
from transformers import CLIPModel, CLIPProcessor
from ultralytics import YOLO

BASE_DIR = Path(__file__).resolve().parent
STATIC_DIR = BASE_DIR / "static"
ANNOTATED_DIR = STATIC_DIR / "annotated"
ANNOTATED_DIR.mkdir(parents=True, exist_ok=True)

# Production should use a fine-tuned classifier with a curated dataset.
# This spec improves zero-shot CLIP by using aliases and bilingual prompts.
LABEL_SPECS: list[dict[str, Any]] = [
    {"name": "trung ga", "category": "nguyen_lieu", "aliases": ["trung ga", "egg", "chicken egg", "raw egg"]},
    {"name": "tom", "category": "nguyen_lieu", "aliases": ["tom", "shrimp", "prawn", "raw shrimp"]},
    {"name": "muc", "category": "nguyen_lieu", "aliases": ["muc", "squid", "raw squid"]},
    {"name": "ca", "category": "nguyen_lieu", "aliases": ["ca", "fish", "raw fish"]},
    {"name": "thit heo", "category": "nguyen_lieu", "aliases": ["thit heo", "pork", "raw pork"]},
    {"name": "thit bo", "category": "nguyen_lieu", "aliases": ["thit bo", "beef", "raw beef"]},
    {"name": "thit ga", "category": "nguyen_lieu", "aliases": ["thit ga", "chicken meat", "raw chicken"]},
    {"name": "ca chua", "category": "nguyen_lieu", "aliases": ["ca chua", "tomato", "fresh tomato"]},
    {"name": "dua leo", "category": "nguyen_lieu", "aliases": ["dua leo", "cucumber"]},
    {"name": "hanh tay", "category": "nguyen_lieu", "aliases": ["hanh tay", "onion"]},
    {"name": "ca rot", "category": "nguyen_lieu", "aliases": ["ca rot", "carrot"]},
    {"name": "khoai tay", "category": "nguyen_lieu", "aliases": ["khoai tay", "potato"]},
    {"name": "nam", "category": "nguyen_lieu", "aliases": ["nam", "mushroom"]},
    {"name": "bap cai", "category": "nguyen_lieu", "aliases": ["bap cai", "cabbage"]},
    {"name": "rau cai", "category": "nguyen_lieu", "aliases": ["rau cai", "mustard greens", "bok choy"]},
    {"name": "rau muong", "category": "nguyen_lieu", "aliases": ["rau muong", "water spinach", "morning glory"]},
    {"name": "rau xa lach", "category": "nguyen_lieu", "aliases": ["rau xa lach", "lettuce"]},
    {"name": "hanh la", "category": "nguyen_lieu", "aliases": ["hanh la", "green onion", "scallion"]},
    {"name": "ngo", "category": "nguyen_lieu", "aliases": ["ngo", "corn"]},
    {"name": "dau hu", "category": "nguyen_lieu", "aliases": ["dau hu", "tofu"]},
    {"name": "dau que", "category": "nguyen_lieu", "aliases": ["dau que", "green beans"]},
    {"name": "bi do", "category": "nguyen_lieu", "aliases": ["bi do", "pumpkin"]},
    {"name": "su su", "category": "nguyen_lieu", "aliases": ["su su", "chayote"]},
    {"name": "dua hau", "category": "nguyen_lieu", "aliases": ["dua hau", "watermelon"]},
    {"name": "tao", "category": "nguyen_lieu", "aliases": ["tao", "apple"]},
    {"name": "chuoi", "category": "nguyen_lieu", "aliases": ["chuoi", "banana"]},
    {"name": "toi", "category": "gia_vi", "aliases": ["toi", "garlic"]},
    {"name": "hanh kho", "category": "gia_vi", "aliases": ["hanh kho", "shallot", "dried onion"]},
    {"name": "ot", "category": "gia_vi", "aliases": ["ot", "chili", "pepper"]},
    {"name": "gung", "category": "gia_vi", "aliases": ["gung", "ginger"]},
    {"name": "sa", "category": "gia_vi", "aliases": ["sa", "lemongrass"]},
    {"name": "tieu", "category": "gia_vi", "aliases": ["tieu", "peppercorn", "black pepper"]},
    {"name": "muoi", "category": "gia_vi", "aliases": ["muoi", "salt"]},
    {"name": "duong", "category": "gia_vi", "aliases": ["duong", "sugar"]},
    {"name": "bot ngot", "category": "gia_vi", "aliases": ["bot ngot", "msg", "monosodium glutamate"]},
    {"name": "nuoc mam", "category": "gia_vi", "aliases": ["nuoc mam", "fish sauce"]},
    {"name": "nuoc tuong", "category": "gia_vi", "aliases": ["nuoc tuong", "soy sauce"]},
    {"name": "dau an", "category": "gia_vi", "aliases": ["dau an", "cooking oil", "vegetable oil"]},
    {"name": "dau hao", "category": "gia_vi", "aliases": ["dau hao", "oyster sauce"]},
    {"name": "tuong ot", "category": "gia_vi", "aliases": ["tuong ot", "chili sauce"]},
    {"name": "tuong ca chua", "category": "gia_vi", "aliases": ["tuong ca chua", "ketchup"]},
    {"name": "bo kho", "category": "gia_vi", "aliases": ["bo kho", "dried herbs"]},
    {"name": "la que", "category": "gia_vi", "aliases": ["la que", "basil leaf", "herb"]},
    {"name": "que hoi", "category": "gia_vi", "aliases": ["que hoi", "cinnamon"]},
    {"name": "hoa hoi", "category": "gia_vi", "aliases": ["hoa hoi", "star anise"]},
    {"name": "thao qua", "category": "gia_vi", "aliases": ["thao qua", "black cardamom"]},
]

LABEL_NAMES = [x["name"] for x in LABEL_SPECS]
LABEL_TO_CATEGORY = {x["name"]: x["category"] for x in LABEL_SPECS}

# COCO classes that are almost always non-ingredient in this app.
SEG_IGNORE_CLASSES = {
    "person", "tie", "handbag", "backpack", "suitcase", "cell phone", "remote", "keyboard", "mouse",
    "tv", "laptop", "book", "clock", "vase", "chair", "couch", "bed", "dining table", "toilet", "sink",
    "bottle", "cup", "wine glass", "fork", "knife", "spoon", "bowl", "refrigerator", "oven", "microwave",
}

PROMPT_TEMPLATES = [
    "a close-up photo of raw food ingredient: {alias}",
    "a cooking ingredient on table: {alias}",
    "a food item for cooking, specifically {alias}",
    "an ingredient for home cooking: {alias}",
]


class SegmentationService:
    def __init__(
        self,
        model_path: str,
        device: str,
        conf: float = 0.25,
        iou: float = 0.65,
        min_mask_area: int = 400,
    ) -> None:
        self.model = YOLO(model_path)
        self.device = device
        self.conf = conf
        self.iou = iou
        self.min_mask_area = min_mask_area

    def segment(self, image_bgr: np.ndarray) -> list[dict[str, Any]]:
        results = self.model.predict(
            source=image_bgr,
            conf=self.conf,
            iou=self.iou,
            retina_masks=True,
            verbose=False,
            device=self.device,
        )
        if not results:
            return []

        result = results[0]
        if result.boxes is None or result.masks is None:
            return []

        boxes = result.boxes
        masks = result.masks.data
        h, w = image_bgr.shape[:2]
        n = min(len(boxes), masks.shape[0])
        items: list[dict[str, Any]] = []

        for i in range(n):
            mask = masks[i].detach().cpu().numpy()
            if mask.shape[0] != h or mask.shape[1] != w:
                mask = cv2.resize(mask, (w, h), interpolation=cv2.INTER_NEAREST)
            mask_bin = (mask > 0.5).astype(np.uint8)
            area = int(mask_bin.sum())
            if area < self.min_mask_area:
                continue

            xyxy = boxes.xyxy[i].detach().cpu().numpy().astype(int)
            x1, y1, x2, y2 = xyxy.tolist()
            x1, y1 = max(0, x1), max(0, y1)
            x2, y2 = min(w - 1, x2), min(h - 1, y2)
            if x2 <= x1 or y2 <= y1:
                continue

            cls_id = int(boxes.cls[i].item())
            seg_name = str(self.model.names.get(cls_id, str(cls_id))).lower()
            seg_conf = float(boxes.conf[i].item())
            area_ratio = area / float(max(1, h * w))

            items.append(
                {
                    "bbox": [x1, y1, x2, y2],
                    "mask": mask_bin,
                    "seg_name": seg_name,
                    "seg_conf": seg_conf,
                    "area_ratio": area_ratio,
                }
            )

        return items


class CLIPIngredientClassifier:
    def __init__(self, label_specs: list[dict[str, Any]], model_name: str, device: str) -> None:
        self.device = device
        self.model = CLIPModel.from_pretrained(model_name).to(device)
        self.processor = CLIPProcessor.from_pretrained(model_name)

        self.labels = [x["name"] for x in label_specs]
        self.prompt_texts: list[str] = []
        self.prompt_label_idx: list[int] = []

        for i, spec in enumerate(label_specs):
            aliases = spec.get("aliases") or [spec["name"]]
            for alias in aliases:
                for template in PROMPT_TEMPLATES:
                    self.prompt_texts.append(template.format(alias=alias))
                    self.prompt_label_idx.append(i)

        self.prompt_label_idx_arr = np.array(self.prompt_label_idx, dtype=np.int32)

    def classify(self, crop_rgb: np.ndarray, top_k: int = 3) -> tuple[str, float, list[dict[str, Any]]]:
        image = Image.fromarray(crop_rgb)
        inputs = self.processor(
            text=self.prompt_texts,
            images=image,
            return_tensors="pt",
            padding=True,
        ).to(self.device)

        with torch.no_grad():
            outputs = self.model(**inputs)
            prompt_probs = outputs.logits_per_image.softmax(dim=1)[0].detach().cpu().numpy()

        # Aggregate prompt scores into canonical label scores.
        label_scores = np.zeros(len(self.labels), dtype=np.float32)
        for idx in range(len(self.labels)):
            label_scores[idx] = float(np.max(prompt_probs[self.prompt_label_idx_arr == idx]))

        total = float(np.sum(label_scores))
        if total > 1e-9:
            label_scores = label_scores / total

        best_idx = int(np.argmax(label_scores))
        label = self.labels[best_idx]
        conf = float(label_scores[best_idx])

        top_idx = np.argsort(label_scores)[::-1][: max(1, top_k)]
        top_candidates = [
            {"label": self.labels[int(i)], "score": float(label_scores[int(i)])}
            for i in top_idx
        ]
        return label, conf, top_candidates


def decode_image(raw: bytes) -> np.ndarray:
    arr = np.frombuffer(raw, dtype=np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if img is None:
        raise HTTPException(status_code=400, detail="Khong doc duoc anh dau vao.")
    return img


def extract_frames_from_video(raw: bytes, max_frames: int = 3) -> list[np.ndarray]:
    with tempfile.NamedTemporaryFile(suffix=".mp4", delete=False) as f:
        f.write(raw)
        tmp_path = f.name

    frames: list[np.ndarray] = []
    try:
        cap = cv2.VideoCapture(tmp_path)
        all_frames: list[np.ndarray] = []
        while cap.isOpened():
            ok, frame = cap.read()
            if not ok:
                break
            all_frames.append(frame)
        cap.release()

        if not all_frames:
            return []
        if len(all_frames) <= max_frames:
            return all_frames

        picks = np.linspace(0, len(all_frames) - 1, max_frames, dtype=int)
        frames = [all_frames[int(i)] for i in picks]
        return frames
    finally:
        try:
            os.remove(tmp_path)
        except OSError:
            pass


def crop_by_mask(image_bgr: np.ndarray, mask: np.ndarray, bbox: list[int], pad: int = 8) -> np.ndarray | None:
    h, w = image_bgr.shape[:2]
    x1, y1, x2, y2 = bbox
    x1, y1 = max(0, x1 - pad), max(0, y1 - pad)
    x2, y2 = min(w - 1, x2 + pad), min(h - 1, y2 + pad)

    if x2 <= x1 or y2 <= y1:
        return None

    roi = image_bgr[y1:y2, x1:x2]
    roi_mask = mask[y1:y2, x1:x2]
    if roi.size == 0 or roi_mask.size == 0:
        return None

    fg = cv2.bitwise_and(roi, roi, mask=roi_mask.astype(np.uint8))
    bg = np.full_like(roi, 255)
    bg[roi_mask > 0] = fg[roi_mask > 0]
    return cv2.cvtColor(bg, cv2.COLOR_BGR2RGB)


def full_image_crop(image_bgr: np.ndarray) -> tuple[np.ndarray, list[int], np.ndarray]:
    h, w = image_bgr.shape[:2]
    bbox = [0, 0, max(1, w - 1), max(1, h - 1)]
    mask = np.ones((h, w), dtype=np.uint8)
    rgb = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2RGB)
    return rgb, bbox, mask


def render_annotations(image_bgr: np.ndarray, predictions: list[dict[str, Any]]) -> np.ndarray:
    canvas = image_bgr.copy()
    for item in predictions:
        bbox = item["bbox"]
        mask = item["mask"]
        x1, y1, x2, y2 = bbox
        color = (0, 180, 0) if not item.get("unknown") else (0, 0, 255)

        contours, _ = cv2.findContours(mask.astype(np.uint8), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        cv2.drawContours(canvas, contours, -1, color, 2)
        cv2.rectangle(canvas, (x1, y1), (x2, y2), color, 2)

        text = f"{item['label']} {item['score']:.2f}"
        cv2.putText(canvas, text, (x1, max(20, y1 - 8)), cv2.FONT_HERSHEY_SIMPLEX, 0.55, color, 2, cv2.LINE_AA)
    return canvas


def fuse_scores(
    label_scores: dict[str, list[float]],
    label_views: dict[str, set[int]],
    total_views: int,
    mode: str,
) -> list[dict[str, Any]]:
    fused: list[dict[str, Any]] = []
    for label, scores in label_scores.items():
        if not scores:
            continue

        if mode == "max":
            score = float(np.max(scores))
        elif mode == "voting":
            support = len(label_views.get(label, set())) / max(total_views, 1)
            score = float(np.mean(scores) * support)
        else:
            score = float(np.mean(scores))

        fused.append(
            {
                "name": label,
                "confidence": score,
                "views_supported": len(label_views.get(label, set())),
                "detections": len(scores),
            }
        )

    fused.sort(key=lambda x: x["confidence"], reverse=True)
    return fused


def is_valid_segment(seg: dict[str, Any]) -> bool:
    seg_name = str(seg.get("seg_name", "")).lower()
    seg_conf = float(seg.get("seg_conf", 0.0))
    area_ratio = float(seg.get("area_ratio", 0.0))

    if seg_name in SEG_IGNORE_CLASSES:
        return False
    if seg_conf < 0.30:
        return False
    if area_ratio > 0.90:
        return False
    return True


@lru_cache(maxsize=1)
def get_pipeline() -> tuple[SegmentationService, CLIPIngredientClassifier]:
    device = "cuda" if torch.cuda.is_available() else "cpu"
    seg_model = os.getenv("SEG_MODEL_PATH", str(BASE_DIR / "yolov8x-seg.pt"))
    clip_model = os.getenv("CLIP_MODEL_NAME", "openai/clip-vit-large-patch14")

    segmentor = SegmentationService(model_path=seg_model, device=device)
    classifier = CLIPIngredientClassifier(label_specs=LABEL_SPECS, model_name=clip_model, device=device)
    return segmentor, classifier


app = FastAPI(title="SmartCook Vision API", version="1.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/api/smartcook/recognize")
async def recognize_ingredients(
    images: list[UploadFile] | None = File(default=None),
    video: UploadFile | None = File(default=None),
    confidence_threshold: float = Form(default=0.62),
    fusion_mode: str = Form(default="mean"),
    return_annotated: bool = Form(default=True),
    top_k_per_crop: int = Form(default=3),
    reject_margin: float = Form(default=0.08),
) -> dict[str, Any]:
    if fusion_mode not in {"mean", "max", "voting"}:
        raise HTTPException(status_code=400, detail="fusion_mode phai la mean|max|voting")

    if not (0.0 <= confidence_threshold <= 1.0):
        raise HTTPException(status_code=400, detail="confidence_threshold phai trong [0, 1]")

    if not (0.0 <= reject_margin <= 1.0):
        raise HTTPException(status_code=400, detail="reject_margin phai trong [0, 1]")

    views: list[np.ndarray] = []

    if images:
        if len(images) > 3:
            raise HTTPException(status_code=400, detail="Chi nhan toi da 3 anh")
        for image_file in images[:3]:
            raw = await image_file.read()
            views.append(decode_image(raw))

    if video is not None and len(views) < 3:
        raw_video = await video.read()
        frames = extract_frames_from_video(raw_video, max_frames=3 - len(views))
        views.extend(frames)

    if not views:
        raise HTTPException(status_code=400, detail="Can gui 1-3 anh hoac 1 video ngan")

    segmentor, classifier = get_pipeline()

    label_scores: dict[str, list[float]] = defaultdict(list)
    label_views: dict[str, set[int]] = defaultdict(set)
    raw_detections: list[dict[str, Any]] = []
    annotated_urls: list[str] = []

    for view_idx, image_bgr in enumerate(views):
        segments = segmentor.segment(image_bgr)
        valid_segments = [x for x in segments if is_valid_segment(x)]

        # If segmentation fails on food classes (common with egg/shrimp in COCO),
        # fallback to classifying the full image instead of returning random objects.
        if not valid_segments:
            full_rgb, full_bbox, full_mask = full_image_crop(image_bgr)
            valid_segments = [{
                "bbox": full_bbox,
                "mask": full_mask,
                "seg_name": "fallback_full_image",
                "seg_conf": 1.0,
                "area_ratio": 1.0,
                "__full": True,
                "__full_rgb": full_rgb,
            }]

        view_predictions: list[dict[str, Any]] = []

        for seg in valid_segments:
            if seg.get("__full"):
                crop_rgb = seg["__full_rgb"]
            else:
                crop_rgb = crop_by_mask(image_bgr, seg["mask"], seg["bbox"])
                if crop_rgb is None:
                    continue

            label, score, top_candidates = classifier.classify(crop_rgb, top_k=top_k_per_crop)
            category = LABEL_TO_CATEGORY.get(label, "unknown")

            top2_gap = 0.0
            if len(top_candidates) >= 2:
                top2_gap = float(top_candidates[0]["score"] - top_candidates[1]["score"])

            is_unknown = score < confidence_threshold or top2_gap < reject_margin

            prediction = {
                "view_index": view_idx,
                "bbox": seg["bbox"],
                "mask": seg["mask"],
                "segmentation": {"class": seg["seg_name"], "confidence": seg["seg_conf"]},
                "label": "Unknown" if is_unknown else label,
                "raw_label": label,
                "category": category,
                "score": score,
                "unknown": is_unknown,
                "top2_gap": round(top2_gap, 4),
                "top_candidates": top_candidates,
            }
            raw_detections.append(
                {
                    "view_index": view_idx,
                    "bbox": seg["bbox"],
                    "segmentation": {"class": seg["seg_name"], "confidence": seg["seg_conf"]},
                    "label": prediction["label"],
                    "score": score,
                    "top2_gap": round(top2_gap, 4),
                    "top_candidates": top_candidates,
                }
            )
            view_predictions.append(prediction)

            if not is_unknown:
                label_scores[label].append(score)
                label_views[label].add(view_idx)

        if return_annotated:
            canvas = render_annotations(image_bgr, view_predictions)
            filename = f"{uuid.uuid4().hex}_view{view_idx}.jpg"
            path = ANNOTATED_DIR / filename
            cv2.imwrite(str(path), canvas)
            annotated_urls.append(f"/static/annotated/{filename}")

    fused = fuse_scores(label_scores, label_views, total_views=len(views), mode=fusion_mode)

    nguyen_lieu: list[dict[str, Any]] = []
    gia_vi: list[dict[str, Any]] = []
    unknown: list[dict[str, Any]] = []

    for item in fused:
        out = {
            "name": item["name"],
            "confidence": round(item["confidence"], 4),
            "views_supported": item["views_supported"],
            "detections": item["detections"],
        }

        if item["confidence"] < confidence_threshold:
            unknown.append(out)
            continue

        category = LABEL_TO_CATEGORY.get(item["name"])
        if category == "nguyen_lieu":
            nguyen_lieu.append(out)
        elif category == "gia_vi":
            gia_vi.append(out)
        else:
            unknown.append(out)

    return {
        "nguyen_lieu": nguyen_lieu,
        "gia_vi": gia_vi,
        "unknown": unknown,
        "meta": {
            "views_used": len(views),
            "fusion_mode": fusion_mode,
            "confidence_threshold": confidence_threshold,
            "reject_margin": reject_margin,
            "total_objects_detected": len(raw_detections),
            "annotated_urls": annotated_urls if return_annotated else [],
            "note": "For best accuracy, train a domain model on SmartCook ingredient dataset.",
        },
        "detections": raw_detections,
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("smartcook_api:app", host="0.0.0.0", port=9000, reload=False)
