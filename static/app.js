// ===== STATE =====
let userPhotoDataURI = null;
let detectedGender = null;
let selectedShow = null;
let generatedImages = []; // array of image URLs for 5 scenes
let scenePrompts = []; // array of scene prompt texts
let videoURL = null;

// ===== DOM REFS =====
const screens = {
    upload: document.getElementById("upload-screen"),
    select: document.getElementById("select-screen"),
    generate: document.getElementById("generate-screen"),
    result: document.getElementById("result-screen"),
};

const els = {
    fileInput: document.getElementById("file-input"),
    cameraInput: document.getElementById("camera-input"),
    uploadArea: document.getElementById("upload-area"),
    uploadBtn: document.getElementById("upload-btn"),
    cameraBtn: document.getElementById("camera-btn"),
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
    showScreen("select");
});

// ===== PHOTO UPLOAD =====
function handleFile(file) {
    if (!file || !file.type.startsWith("image/")) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        userPhotoDataURI = e.target.result;
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

els.cameraBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    els.cameraInput.click();
});

els.uploadArea.addEventListener("click", () => {
    els.fileInput.click();
});

els.fileInput.addEventListener("change", (e) => {
    if (e.target.files[0]) handleFile(e.target.files[0]);
});

els.cameraInput.addEventListener("change", (e) => {
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
    els.cameraInput.value = "";
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
            const err = await storyboardResponse.json();
            throw new Error(err.error || "Failed to generate storyboard");
        }

        const storyboardData = await storyboardResponse.json();
        const scenes = storyboardData.scenes;

        if (!scenes || scenes.length === 0) {
            throw new Error("No scenes returned from storyboard generation");
        }

        // Step 2: Generate images sequentially, showing each as it arrives
        for (let i = 0; i < scenes.length; i++) {
            const scene = scenes[i];
            const sceneNum = scene.scene_number || i + 1;

            els.statusText.textContent = `Generating scene ${sceneNum} of ${scenes.length}...`;
            els.statusDetail.textContent = scene.prompt;

            const imageResponse = await fetch("/api/generate-image", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    photo: userPhotoDataURI,
                    prompt: scene.prompt,
                    show_name: selectedShow,
                    scene_number: sceneNum,
                    gender: detectedGender,
                }),
            });

            if (!imageResponse.ok) {
                const err = await imageResponse.json();
                throw new Error(
                    err.error || `Failed to generate scene ${sceneNum}`
                );
            }

            const imageData = await imageResponse.json();
            const imageURL = extractImageURL(imageData);

            if (!imageURL) {
                console.log(
                    `Scene ${sceneNum} response:`,
                    JSON.stringify(imageData)
                );
                throw new Error(`No image returned for scene ${sceneNum}`);
            }

            generatedImages.push(imageURL);
            scenePrompts.push(scene.prompt);
            showSceneImage(sceneNum, imageURL, scene.prompt);
        }

        // All scenes generated — show Generate Drama button
        els.generateStatus.style.display = "none";
        els.generateDramaBtn.style.display = "";
    } catch (error) {
        console.error("Generation error:", error);
        showError(error.message || "Something went wrong during generation");
    }
}

// ===== VIDEO GENERATION =====
els.generateDramaBtn.addEventListener("click", () => {
    generateVideo();
});

async function generateVideo() {
    els.generateDramaBtn.style.display = "none";
    els.generateStatus.style.display = "";

    try {
        // Generate scene prompt with Claude
        els.statusText.textContent = "Generating drama...";
        els.statusDetail.textContent = "Writing your scene with AI";

        const promptResponse = await fetch("/api/generate-scene-prompt", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ show_name: selectedShow }),
        });

        if (!promptResponse.ok) {
            throw new Error("Failed to generate scene prompt");
        }

        const promptData = await promptResponse.json();
        const scenePrompt = promptData.prompt;

        // Generate video with Kling using the first scene image
        els.statusText.textContent = "Generating drama...";
        els.statusDetail.textContent = "Creating your short drama video";

        const videoResponse = await fetch("/api/generate-video", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                image_url: generatedImages[0],
                prompt: scenePrompt,
            }),
        });

        if (!videoResponse.ok) {
            const err = await videoResponse.json();
            throw new Error(err.error || "Failed to start video generation");
        }

        const videoData = await videoResponse.json();
        const requestId = videoData.request_id;

        if (!requestId) {
            if (videoData.video && videoData.video.url) {
                videoURL = videoData.video.url;
                showVideoResult();
                return;
            }
            throw new Error("No request ID returned from video generation");
        }

        els.statusDetail.textContent = "This may take a minute or two...";
        await pollVideoStatus(requestId);
    } catch (error) {
        console.error("Generation error:", error);
        showError(error.message || "Something went wrong during generation");
    }
}

async function pollVideoStatus(requestId) {
    const maxAttempts = 120;
    let attempt = 0;

    while (attempt < maxAttempts) {
        attempt++;

        try {
            const statusResponse = await fetch(
                `/api/video-status/${requestId}`
            );
            const statusData = await statusResponse.json();
            const status = statusData.status;

            if (status === "COMPLETED") {
                const resultResponse = await fetch(
                    `/api/video-result/${requestId}`
                );
                const resultData = await resultResponse.json();

                if (resultData.video && resultData.video.url) {
                    videoURL = resultData.video.url;
                    showVideoResult();
                    return;
                }
                throw new Error("Video completed but no URL returned");
            }

            if (status === "FAILED") {
                throw new Error("Video generation failed");
            }

            const dots = ".".repeat((attempt % 3) + 1);
            els.statusDetail.textContent = `Rendering your drama${dots}`;
        } catch (error) {
            if (
                error.message === "Video generation failed" ||
                error.message === "Video completed but no URL returned"
            ) {
                throw error;
            }
        }

        await new Promise((resolve) => setTimeout(resolve, 5000));
    }

    throw new Error("Video generation timed out");
}

function showVideoResult() {
    els.resultVideo.src = videoURL;
    showScreen("result");
}

// ===== RESULT ACTIONS =====
els.saveBtn.addEventListener("click", async () => {
    if (!videoURL) return;

    try {
        const response = await fetch(videoURL);
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `SoraShorts-${selectedShow.replace(/\s+/g, "-")}.mp4`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    } catch {
        window.open(videoURL, "_blank");
    }
});

els.tryagainBtn.addEventListener("click", () => {
    videoURL = null;
    generatedImages = [];
    scenePrompts = [];
    detectedGender = null;
    selectedShow = null;
    els.resultVideo.src = "";
    els.customShowInput.value = "";
    showScreen("select");
});
