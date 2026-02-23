import os
import sys
import json
import logging
import requests
from dotenv import load_dotenv
from flask import Flask, render_template, request, jsonify
from flask_cors import CORS
from anthropic import Anthropic

load_dotenv()

app = Flask(__name__)
CORS(app)

# Force unbuffered logging to stderr
logging.basicConfig(stream=sys.stderr, level=logging.DEBUG)
log = app.logger

FAL_KEY = os.environ.get("FAL_KEY")
ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY")


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/generate-storyboard", methods=["POST"])
def generate_storyboard():
    data = request.json
    show_name = data["show_name"]

    client = Anthropic(api_key=ANTHROPIC_API_KEY)
    message = client.messages.create(
        model="claude-opus-4-6",
        max_tokens=1500,
        messages=[
            {
                "role": "user",
                "content": (
                    f"You are a storyboard artist for a short drama fan fiction of '{show_name}'. "
                    f"Create a 5-scene storyboard that tells a consistent, compelling mini-plot "
                    f"inspired by '{show_name}'. Each scene should build on the previous one.\n\n"
                    f"For each scene, write an image generation prompt (2-3 sentences) describing:\n"
                    f"- The visual composition and setting\n"
                    f"- The protagonist's action, pose, and expression\n"
                    f"- Cinematic lighting, mood, and camera angle\n"
                    f"- Keep it in 9:16 portrait format\n\n"
                    f"Return ONLY a JSON array of 5 objects, each with 'scene_number' (1-5) and 'prompt'. "
                    f"No markdown, no explanation, just the JSON array."
                ),
            }
        ],
    )

    raw = message.content[0].text.strip()
    # Strip markdown code fences if present
    if raw.startswith("```"):
        raw = raw.split("\n", 1)[1] if "\n" in raw else raw[3:]
        if raw.endswith("```"):
            raw = raw[:-3].strip()

    log.info(f"[STORYBOARD] Raw Claude response: {raw[:500]}")

    scenes = json.loads(raw)
    return jsonify({"scenes": scenes})


@app.route("/api/generate-image", methods=["POST"])
def generate_image():
    data = request.json
    user_photo = data["photo"]  # base64 data URI
    prompt = data["prompt"]  # scene prompt from storyboard
    scene_number = data.get("scene_number", 1)

    # Prepend instruction to use the reference photo for every scene
    full_prompt = (
        f"Using the person from the reference image as the protagonist, "
        f"put them into this scene: {prompt}"
    )

    log.info(f"[GENERATE-IMAGE] Scene {scene_number}, prompt: {full_prompt[:150]}...")

    payload = {
        "prompt": full_prompt,
        "image_urls": [user_photo],
        "aspect_ratio": "9:16",
        "output_format": "jpeg",
        "num_images": 1,
    }

    response = requests.post(
        "https://fal.run/fal-ai/nano-banana/edit",
        headers={
            "Authorization": f"Key {FAL_KEY}",
            "Content-Type": "application/json",
        },
        json=payload,
        timeout=120,
    )

    log.info(f"[GENERATE-IMAGE] Scene {scene_number} response: {response.status_code}")

    if response.status_code != 200:
        return jsonify({"error": response.text}), response.status_code

    return jsonify(response.json())


@app.route("/api/generate-scene-prompt", methods=["POST"])
def generate_scene_prompt():
    data = request.json
    show_name = data["show_name"]

    client = Anthropic(api_key=ANTHROPIC_API_KEY)
    message = client.messages.create(
        model="claude-opus-4-6",
        max_tokens=300,
        messages=[
            {
                "role": "user",
                "content": (
                    f"Describe the iconic opening/first scene of '{show_name}' in 2-3 sentences "
                    f"as a video generation prompt. Focus on: visual action, mood, camera movement, "
                    f"and cinematic style. Make it vivid and specific for generating a short 5-second "
                    f"video clip. The scene should feature the protagonist in a dramatic moment. "
                    f"Do not include any preamble - just output the scene description directly."
                ),
            }
        ],
    )

    return jsonify({"prompt": message.content[0].text})


@app.route("/api/generate-video", methods=["POST"])
def generate_video():
    data = request.json
    image_url = data["image_url"]
    prompt = data["prompt"]

    response = requests.post(
        "https://queue.fal.run/fal-ai/kling-video/v2.5-turbo/pro/image-to-video",
        headers={
            "Authorization": f"Key {FAL_KEY}",
            "Content-Type": "application/json",
        },
        json={
            "prompt": prompt,
            "image_url": image_url,
            "duration": "5",
            "aspect_ratio": "9:16",
        },
    )

    if response.status_code != 200:
        return jsonify({"error": response.text}), response.status_code

    return jsonify(response.json())


@app.route("/api/video-status/<request_id>")
def video_status(request_id):
    response = requests.get(
        f"https://queue.fal.run/fal-ai/kling-video/v2.5-turbo/pro/image-to-video/requests/{request_id}/status",
        headers={"Authorization": f"Key {FAL_KEY}"},
    )
    log.info(f"[VIDEO-STATUS] raw response ({response.status_code}): {response.text[:300]}")
    try:
        return jsonify(response.json())
    except Exception:
        return jsonify({"status": "IN_PROGRESS", "raw": response.text[:200]})


@app.route("/api/video-result/<request_id>")
def video_result(request_id):
    response = requests.get(
        f"https://queue.fal.run/fal-ai/kling-video/v2.5-turbo/pro/image-to-video/requests/{request_id}",
        headers={"Authorization": f"Key {FAL_KEY}"},
    )
    log.info(f"[VIDEO-RESULT] raw response ({response.status_code}): {response.text[:500]}")
    try:
        return jsonify(response.json())
    except Exception:
        return jsonify({"error": "Invalid response", "raw": response.text[:200]}), 502


if __name__ == "__main__":
    app.run(debug=True, port=3000)
