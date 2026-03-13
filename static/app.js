// ===== STATE =====
let userPhotoDataURI = null;
let detectedGender = null;
let selectedShow = null;
let generatedImages = []; // array of image URLs for 5 scenes
let scenePrompts = []; // array of scene prompt texts
let videoURL = null;
let generatedClips = []; // array of video URLs per clip
let currentClipIndex = 0; // which clip we're generating

// ===== DOM REFS =====
const screens = {
    upload: document.getElementById("upload-screen"),
    select: document.getElementById("select-screen"),
    generate: document.getElementById("generate-screen"),
    result: document.getElementById("result-screen"),
};

const els = {
    fileInput: document.getElementById("file-input"),
    uploadArea: document.getElementById("upload-area"),
    uploadBtn: document.getElementById("upload-btn"),
    cameraBtn: document.getElementById("camera-btn"),
    cameraContainer: document.getElementById("camera-container"),
    cameraVideo: document.getElementById("camera-video"),
    cameraCaptureBtn: document.getElementById("camera-capture-btn"),
    cameraCancelBtn: document.getElementById("camera-cancel-btn"),
    previewContainer: document.getElementById("preview-container"),
    photoPreview: document.getElementById("photo-preview"),
    retakeBtn: document.getElementById("retake-btn"),
    continueBtn: document.getElementById("continue-btn"),
    navPhoto: document.getElementById("nav-photo"),
    customShowInput: document.getElementById("custom-show"),
    customShowBtn: document.getElementById("custom-show-btn"),
    storyboard: document.getElementById("storyboard"),
    storyboardHeading: document.getElementById("storyboard-heading"),
    generateStatus: document.getElementById("generate-status"),
    statusText: document.getElementById("status-text"),
    statusDetail: document.getElementById("status-detail"),
    generateDramaBtn: document.getElementById("generate-drama-btn"),
    resultVideo: document.getElementById("result-video"),
    saveBtn: document.getElementById("save-btn"),
    tryagainBtn: document.getElementById("tryagain-btn"),
    lightboxOverlay: document.getElementById("lightbox-overlay"),
    lightboxImage: document.getElementById("lightbox-image"),
    lightboxCaption: document.getElementById("lightbox-caption"),
    lightboxClose: document.getElementById("lightbox-close"),
    errorOverlay: document.getElementById("error-overlay"),
    errorMessage: document.getElementById("error-message"),
    errorCloseBtn: document.getElementById("error-close-btn"),
    clipsTimeline: document.getElementById("clips-timeline"),
    clipStatus: document.getElementById("clip-status"),
    clipStatusText: document.getElementById("clip-status-text"),
    clipStatusDetail: document.getElementById("clip-status-detail"),
    clipActions: document.getElementById("clip-actions"),
    regenerateClipBtn: document.getElementById("regenerate-clip-btn"),
    nextClipBtn: document.getElementById("next-clip-btn"),
    finalActions: document.getElementById("final-actions"),
    resultHeading: document.getElementById("result-heading"),
};

// ===== SCREEN MANAGEMENT =====
function showScreen(name) {
    Object.values(screens).forEach((s) => s.classList.remove("active"));
    screens[name].classList.add("active");
    window.scrollTo(0, 0);
}

// ===== ERROR HANDLING =====
function showError(message) {
    els.errorMessage.textContent = message;
    els.errorOverlay.style.display = "flex";
}

els.errorCloseBtn.addEventListener("click", () => {
    els.errorOverlay.style.display = "none";
});

// ===== PHOTO UPLOAD =====
function compressImage(dataURI, maxSize, quality) {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement("canvas");
            let w = img.width;
            let h = img.height;
            if (w > maxSize || h > maxSize) {
                if (w > h) {
                    h = Math.round((h * maxSize) / w);
                    w = maxSize;
                } else {
                    w = Math.round((w * maxSize) / h);
                    h = maxSize;
                }
            }
            canvas.width = w;
            canvas.height = h;
            canvas.getContext("2d").drawImage(img, 0, 0, w, h);
            resolve(canvas.toDataURL("image/jpeg", quality));
        };
        img.src = dataURI;
    });
}

function handleFile(file) {
    if (!file || !file.type.startsWith("image/")) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
        // Compress to max 800px, 80% JPEG quality to keep payload small
        userPhotoDataURI = await compressImage(e.target.result, 800, 0.8);
        els.photoPreview.src = userPhotoDataURI;
        els.uploadArea.style.display = "none";
        els.previewContainer.style.display = "block";
    };
    reader.readAsDataURL(file);
}

els.uploadBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    els.fileInput.click();
});

// ===== LIVE CAMERA =====
let cameraStream = null;

function stopCamera() {
    if (cameraStream) {
        cameraStream.getTracks().forEach((t) => t.stop());
        cameraStream = null;
    }
    els.cameraVideo.srcObject = null;
}

els.cameraBtn.addEventListener("click", async (e) => {
    e.stopPropagation();
    try {
        cameraStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
            audio: false,
        });
        els.cameraVideo.srcObject = cameraStream;
        els.uploadArea.style.display = "none";
        els.cameraContainer.style.display = "block";
    } catch {
        showError("Could not access camera. Please allow camera permissions or upload a photo instead.");
    }
});

els.cameraCaptureBtn.addEventListener("click", async () => {
    const video = els.cameraVideo;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    // Mirror the capture to match the viewfinder
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0);
    stopCamera();
    els.cameraContainer.style.display = "none";

    const dataURI = canvas.toDataURL("image/jpeg", 0.9);
    userPhotoDataURI = await compressImage(dataURI, 800, 0.8);
    els.photoPreview.src = userPhotoDataURI;
    els.previewContainer.style.display = "block";
});

els.cameraCancelBtn.addEventListener("click", () => {
    stopCamera();
    els.cameraContainer.style.display = "none";
    els.uploadArea.style.display = "block";
});

els.uploadArea.addEventListener("click", () => {
    els.fileInput.click();
});

els.fileInput.addEventListener("change", (e) => {
    if (e.target.files[0]) handleFile(e.target.files[0]);
});

// Drag & drop
els.uploadArea.addEventListener("dragover", (e) => {
    e.preventDefault();
    els.uploadArea.classList.add("drag-over");
});

els.uploadArea.addEventListener("dragleave", () => {
    els.uploadArea.classList.remove("drag-over");
});

els.uploadArea.addEventListener("drop", (e) => {
    e.preventDefault();
    els.uploadArea.classList.remove("drag-over");
    if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
});

// Retake / Continue
els.retakeBtn.addEventListener("click", () => {
    userPhotoDataURI = null;
    els.photoPreview.src = "";
    els.previewContainer.style.display = "none";
    els.uploadArea.style.display = "block";
    els.fileInput.value = "";
});

els.continueBtn.addEventListener("click", async () => {
    if (!userPhotoDataURI) return;

    // Detect gender from photo
    const origText = els.continueBtn.textContent;
    els.continueBtn.textContent = "Analyzing...";
    els.continueBtn.disabled = true;

    try {
        const resp = await fetch("/api/detect-gender", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ photo: userPhotoDataURI }),
        });
        if (resp.ok) {
            const data = await resp.json();
            detectedGender = data.gender;
            console.log("Detected gender:", detectedGender);
        } else {
            detectedGender = "male"; // fallback
        }
    } catch {
        detectedGender = "male"; // fallback
    }

    els.continueBtn.textContent = origText;
    els.continueBtn.disabled = false;
    els.navPhoto.style.backgroundImage = `url(${userPhotoDataURI})`;
    showScreen("select");
});

// ===== SHOW SELECTION =====
// Clicking a show card
document.querySelectorAll(".show-card").forEach((card) => {
    card.addEventListener("click", () => {
        selectedShow = card.dataset.show;
        startGeneration();
    });
});

// Custom show input
els.customShowBtn.addEventListener("click", () => {
    const val = els.customShowInput.value.trim();
    if (!val) return;
    selectedShow = val;
    startGeneration();
});

els.customShowInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
        const val = els.customShowInput.value.trim();
        if (!val) return;
        selectedShow = val;
        startGeneration();
    }
});

// ===== LIGHTBOX =====
function openLightbox(imageURL, caption) {
    els.lightboxImage.src = imageURL;
    els.lightboxCaption.textContent = caption || "";
    els.lightboxOverlay.style.display = "flex";
}

function closeLightbox() {
    els.lightboxOverlay.style.display = "none";
    els.lightboxImage.src = "";
}

els.lightboxClose.addEventListener("click", closeLightbox);
els.lightboxOverlay.addEventListener("click", (e) => {
    if (e.target === els.lightboxOverlay) closeLightbox();
});

// ===== HELPER: extract image URL from fal.ai response =====
function extractImageURL(imageData) {
    if (imageData.images && imageData.images.length > 0) {
        return imageData.images[0].url;
    } else if (imageData.image && imageData.image.url) {
        return imageData.image.url;
    } else if (imageData.output && imageData.output.images) {
        return imageData.output.images[0].url;
    }
    return null;
}

// ===== STORYBOARD GENERATION =====
function resetStoryboard() {
    generatedImages = [];
    scenePrompts = [];
    const scenes = els.storyboard.querySelectorAll(".storyboard-scene");
    scenes.forEach((scene) => {
        const img = scene.querySelector(".scene-image");
        const placeholder = scene.querySelector(".scene-placeholder");
        const tooltip = scene.querySelector(".scene-tooltip");
        img.classList.remove("visible");
        img.src = "";
        img.onclick = null;
        placeholder.classList.remove("hidden");
        if (tooltip) tooltip.textContent = "";
    });
}

function showSceneImage(sceneNumber, imageURL, promptText) {
    const scene = els.storyboard.querySelector(
        `.storyboard-scene[data-scene="${sceneNumber}"]`
    );
    if (!scene) return;

    const img = scene.querySelector(".scene-image");
    const placeholder = scene.querySelector(".scene-placeholder");
    const tooltip = scene.querySelector(".scene-tooltip");

    // Set tooltip text (hover description)
    tooltip.textContent = promptText || "";

    img.src = imageURL;
    img.onload = () => {
        placeholder.classList.add("hidden");
        img.classList.add("visible");
    };

    // Click to enlarge
    img.onclick = () => {
        openLightbox(imageURL, promptText);
    };
}

async function pollImageStatus(requestId, sceneNum) {
    const maxAttempts = 180;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        await new Promise((resolve) => setTimeout(resolve, 2000));

        try {
            const statusResp = await fetch(`/api/image-status/${requestId}`);
            const statusData = await statusResp.json();
            const status = statusData.status;

            if (status === "COMPLETED") {
                const resultResp = await fetch(`/api/image-result/${requestId}`);
                const resultData = await resultResp.json();
                const imageURL = extractImageURL(resultData);
                if (!imageURL) {
                    console.log(`Scene ${sceneNum} result:`, JSON.stringify(resultData));
                    throw new Error(`No image returned for scene ${sceneNum}`);
                }
                return imageURL;
            }

            if (status === "FAILED") {
                throw new Error(`Image generation failed for scene ${sceneNum}`);
            }
        } catch (error) {
            if (error.message.includes("failed") || error.message.includes("No image")) {
                throw error;
            }
            // Network error — keep polling
        }
    }
    throw new Error(`Scene ${sceneNum} timed out`);
}

async function startGeneration() {
    showScreen("generate");
    resetStoryboard();
    els.generateStatus.style.display = "";
    els.generateDramaBtn.style.display = "none";
    els.statusText.textContent = "Writing your storyboard...";
    els.statusDetail.textContent =
        "AI is crafting a 5-scene plot for " + selectedShow;

    try {
        // Step 1: Generate 5 storyboard prompts with Claude
        const storyboardResponse = await fetch("/api/generate-storyboard", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ show_name: selectedShow, gender: detectedGender }),
        });

        if (!storyboardResponse.ok) {
            let errMsg = "Failed to generate storyboard";
            try {
                const err = await storyboardResponse.json();
                errMsg = err.error || errMsg;
            } catch {
                errMsg += ` (server returned ${storyboardResponse.status})`;
            }
            throw new Error(errMsg);
        }

        let storyboardData;
        try {
            storyboardData = await storyboardResponse.json();
        } catch {
            throw new Error("Invalid response from storyboard API");
        }
        const scenes = storyboardData.scenes;

        if (!scenes || scenes.length === 0) {
            throw new Error("No scenes returned from storyboard generation");
        }

        // Step 2: Upload photo once, then submit ALL images in parallel
        let completedCount = 0;

        els.statusText.textContent = `Generating ${scenes.length} story scenes...`;
        els.statusDetail.textContent = "Preparing image requests...";

        // Upload photo once to avoid sending large base64 with every request
        const uploadResp = await fetch("/api/upload-photo", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ photo: userPhotoDataURI }),
        });
        if (!uploadResp.ok) throw new Error("Failed to upload photo");
        const { photo_token } = await uploadResp.json();

        els.statusDetail.textContent = "Submitting image requests...";

        // Submit all scenes to fal.ai queue simultaneously
        const submissions = await Promise.all(
            scenes.map(async (scene, i) => {
                const sceneNum = scene.scene_number || i + 1;
                const submitResponse = await fetch("/api/generate-image", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        photo_token: photo_token,
                        prompt: scene.prompt,
                        show_name: selectedShow,
                        scene_number: sceneNum,
                        gender: detectedGender,
                    }),
                });

                if (!submitResponse.ok) {
                    let errMsg = `Failed to submit scene ${sceneNum}`;
                    try {
                        const text = await submitResponse.text();
                        try {
                            const err = JSON.parse(text);
                            errMsg = err.error || errMsg;
                        } catch {
                            errMsg += `: ${text.substring(0, 200)}`;
                        }
                    } catch {
                        errMsg += ` (server returned ${submitResponse.status})`;
                    }
                    throw new Error(errMsg);
                }

                let submitData;
                try {
                    submitData = await submitResponse.json();
                } catch {
                    throw new Error(`Invalid response submitting scene ${sceneNum}`);
                }

                return { scene, sceneNum, submitData };
            })
        );

        els.statusDetail.textContent = "All scenes submitted, waiting for results...";

        // Pre-allocate arrays so parallel results land in correct order
        generatedImages = new Array(scenes.length);
        scenePrompts = new Array(scenes.length);

        // Poll all scenes in parallel, but reveal images sequentially
        const imageResults = new Array(scenes.length);
        const resolvers = new Array(scenes.length);
        // Create a promise for each slot that resolves when that scene's image is ready
        const readyPromises = scenes.map((_, i) => new Promise((resolve) => { resolvers[i] = resolve; }));

        // Parallel polling — each stores its result and signals ready
        const pollAll = Promise.all(
            submissions.map(async ({ scene, sceneNum, submitData }, idx) => {
                const requestId = submitData.request_id;
                let imageURL;

                if (!requestId) {
                    imageURL = extractImageURL(submitData);
                    if (!imageURL) throw new Error(`No image returned for scene ${sceneNum}`);
                } else {
                    imageURL = await pollImageStatus(requestId, sceneNum);
                }

                imageResults[idx] = { imageURL, scene, sceneNum };
                generatedImages[idx] = imageURL;
                scenePrompts[idx] = scene.prompt;
                resolvers[idx]();
            })
        );

        // Sequential display — wait for scene 1 first, then 2, etc.
        for (let i = 0; i < scenes.length; i++) {
            await readyPromises[i];
            const { imageURL, scene, sceneNum } = imageResults[i];
            showSceneImage(sceneNum, imageURL, scene.prompt);
            completedCount++;
            const dots = ".".repeat((completedCount % 3) + 1);
            els.statusText.textContent = `${completedCount} of ${scenes.length} scenes ready${dots}`;
            els.statusDetail.textContent = scene.prompt;
        }

        await pollAll;

        // All scenes generated — show Generate Drama button
        els.generateStatus.style.display = "none";
        els.generateDramaBtn.style.display = "";
    } catch (error) {
        console.error("Generation error:", error);
        els.generateStatus.style.display = "none";
        // If some images were generated, still allow generating drama with them
        if (generatedImages.length > 0) {
            els.generateDramaBtn.style.display = "";
        }
        showError(error.message || "Something went wrong during generation");
    }
}

// ===== VIDEO GENERATION (CLIP-BY-CLIP) =====
els.generateDramaBtn.addEventListener("click", () => {
    startClipGeneration();
});

function resetClipsUI() {
    generatedClips = [];
    currentClipIndex = 0;
    els.clipsTimeline.innerHTML = "";
    els.clipActions.style.display = "none";
    els.finalActions.style.display = "none";
    els.clipStatus.style.display = "";
}

function createClipCard(index, isGenerating) {
    const card = document.createElement("div");
    card.className = `clip-card ${isGenerating ? "current" : "past"}`;
    card.dataset.clip = index;

    const wrapper = document.createElement("div");
    wrapper.className = "clip-video-wrapper";

    if (isGenerating) {
        const generating = document.createElement("div");
        generating.className = "clip-generating";
        generating.innerHTML = `<div class="spinner-small"></div><span class="clip-generating-text">Generating...</span>`;
        wrapper.appendChild(generating);
    }

    const label = document.createElement("span");
    label.className = "clip-label";
    label.textContent = `Clip ${index + 1}`;

    card.appendChild(wrapper);
    card.appendChild(label);
    els.clipsTimeline.appendChild(card);

    // Scroll to make the new card visible
    card.scrollIntoView({ behavior: "smooth", inline: "center" });

    return card;
}

function showClipVideo(index, videoUrl) {
    const card = els.clipsTimeline.querySelector(`.clip-card[data-clip="${index}"]`);
    if (!card) return;

    const wrapper = card.querySelector(".clip-video-wrapper");
    wrapper.innerHTML = "";

    const video = document.createElement("video");
    video.src = videoUrl;
    video.controls = true;
    video.playsinline = true;
    video.autoplay = true;
    video.loop = true;
    video.muted = true;
    wrapper.appendChild(video);
}

async function startClipGeneration() {
    showScreen("result");
    resetClipsUI();
    await generateClip(0);
}

async function generateClip(index) {
    currentClipIndex = index;
    const totalClips = generatedImages.length;

    els.resultHeading.textContent = `Generating Clip ${index + 1} of ${totalClips}`;
    els.clipActions.style.display = "none";
    els.finalActions.style.display = "none";
    els.clipStatus.style.display = "";
    els.clipStatusText.textContent = `Generating clip ${index + 1}...`;
    els.clipStatusDetail.textContent = scenePrompts[index] || "This may take a minute or two...";

    // Mark previous clips as past
    els.clipsTimeline.querySelectorAll(".clip-card").forEach((c) => c.classList.replace("current", "past"));

    // Create or replace the card for this clip
    let existingCard = els.clipsTimeline.querySelector(`.clip-card[data-clip="${index}"]`);
    if (existingCard) {
        existingCard.remove();
    }
    createClipCard(index, true);

    try {
        // Use the scene prompt for this clip
        const scenePrompt = scenePrompts[index] || `Scene ${index + 1}`;

        const videoResponse = await fetch("/api/generate-video", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                image_url: generatedImages[index],
                prompt: scenePrompt,
            }),
        });

        if (!videoResponse.ok) {
            const err = await videoResponse.json();
            throw new Error(err.error || `Failed to start clip ${index + 1}`);
        }

        const videoData = await videoResponse.json();
        const requestId = videoData.request_id;

        if (!requestId) {
            if (videoData.video && videoData.video.url) {
                onClipReady(index, videoData.video.url);
                return;
            }
            throw new Error("No request ID returned from video generation");
        }

        await pollClipStatus(requestId, index);
    } catch (error) {
        console.error(`Clip ${index + 1} error:`, error);
        els.clipStatus.style.display = "none";
        showError(error.message || `Failed to generate clip ${index + 1}`);
        // Show regenerate button even on error
        els.clipActions.style.display = "";
        els.nextClipBtn.style.display = index < totalClips - 1 ? "" : "none";
    }
}

async function pollClipStatus(requestId, clipIndex) {
    const maxAttempts = 120;
    let attempt = 0;

    while (attempt < maxAttempts) {
        attempt++;

        try {
            const statusResponse = await fetch(`/api/video-status/${requestId}`);
            const statusData = await statusResponse.json();
            const status = statusData.status;

            if (status === "COMPLETED") {
                const resultResponse = await fetch(`/api/video-result/${requestId}`);
                const resultData = await resultResponse.json();

                if (resultData.video && resultData.video.url) {
                    onClipReady(clipIndex, resultData.video.url);
                    return;
                }
                throw new Error("Video completed but no URL returned");
            }

            if (status === "FAILED") {
                throw new Error(`Clip ${clipIndex + 1} generation failed`);
            }

            // Keep showing the scene prompt during polling (no change needed)
        } catch (error) {
            if (
                error.message.includes("failed") ||
                error.message.includes("no URL")
            ) {
                throw error;
            }
        }

        await new Promise((resolve) => setTimeout(resolve, 3000));
    }

    throw new Error(`Clip ${clipIndex + 1} timed out`);
}

function onClipReady(index, videoUrl) {
    generatedClips[index] = videoUrl;
    showClipVideo(index, videoUrl);

    els.clipStatus.style.display = "none";

    const totalClips = generatedImages.length;
    const isLastClip = index >= totalClips - 1;

    if (isLastClip) {
        // All clips done
        els.resultHeading.textContent = "Your Drama Clips Are Ready";
        els.clipActions.style.display = "none";
        els.finalActions.style.display = "";
    } else {
        // Show regenerate + next buttons
        els.resultHeading.textContent = `Clip ${index + 1} of ${totalClips} Ready`;
        els.clipActions.style.display = "";
        els.nextClipBtn.style.display = "";
    }
}

// Regenerate current clip
els.regenerateClipBtn.addEventListener("click", () => {
    generateClip(currentClipIndex);
});

// Generate next clip
els.nextClipBtn.addEventListener("click", () => {
    // Mark current clip card as past
    const currentCard = els.clipsTimeline.querySelector(`.clip-card[data-clip="${currentClipIndex}"]`);
    if (currentCard) currentCard.classList.replace("current", "past");

    generateClip(currentClipIndex + 1);
});

// ===== RESULT ACTIONS =====
els.saveBtn.addEventListener("click", async () => {
    // Download each clip
    for (let i = 0; i < generatedClips.length; i++) {
        const url = generatedClips[i];
        if (!url) continue;
        try {
            const response = await fetch(url);
            const blob = await response.blob();
            const blobUrl = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = blobUrl;
            a.download = `SoraShorts-${selectedShow.replace(/\s+/g, "-")}-clip${i + 1}.mp4`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(blobUrl);
        } catch {
            window.open(url, "_blank");
        }
    }
});

els.tryagainBtn.addEventListener("click", () => {
    videoURL = null;
    generatedImages = [];
    scenePrompts = [];
    generatedClips = [];
    currentClipIndex = 0;
    detectedGender = null;
    selectedShow = null;
    els.clipsTimeline.innerHTML = "";
    els.customShowInput.value = "";
    showScreen("select");
});
