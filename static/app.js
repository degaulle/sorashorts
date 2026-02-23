// ===== STATE =====
let userPhotoDataURI = null;
let selectedShow = null;
let generatedImages = []; // array of image URLs for 5 scenes
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
    storyboard: document.getElementById("storyboard"),
    storyboardHeading: document.getElementById("storyboard-heading"),
    generateStatus: document.getElementById("generate-status"),
    statusText: document.getElementById("status-text"),
    statusDetail: document.getElementById("status-detail"),
    generateDramaBtn: document.getElementById("generate-drama-btn"),
    resultVideo: document.getElementById("result-video"),
    saveBtn: document.getElementById("save-btn"),
    tryagainBtn: document.getElementById("tryagain-btn"),
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

els.continueBtn.addEventListener("click", () => {
    if (!userPhotoDataURI) return;
    els.navPhoto.style.backgroundImage = `url(${userPhotoDataURI})`;
    showScreen("select");
});

// ===== SHOW SELECTION =====
document.querySelectorAll(".show-card").forEach((card) => {
    card.addEventListener("click", () => {
        selectedShow = card.dataset.show;
        startGeneration();
    });
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
    const scenes = els.storyboard.querySelectorAll(".storyboard-scene");
    scenes.forEach((scene) => {
        const img = scene.querySelector(".scene-image");
        const placeholder = scene.querySelector(".scene-placeholder");
        img.classList.remove("visible");
        img.src = "";
        placeholder.classList.remove("hidden");
    });
}

function showSceneImage(sceneNumber, imageURL) {
    const scene = els.storyboard.querySelector(
        `.storyboard-scene[data-scene="${sceneNumber}"]`
    );
    if (!scene) return;

    const img = scene.querySelector(".scene-image");
    const placeholder = scene.querySelector(".scene-placeholder");

    img.src = imageURL;
    img.onload = () => {
        placeholder.classList.add("hidden");
        img.classList.add("visible");
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
            body: JSON.stringify({ show_name: selectedShow }),
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
            els.statusDetail.textContent = scene.prompt.substring(0, 80) + "...";

            const imageResponse = await fetch("/api/generate-image", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    photo: userPhotoDataURI,
                    prompt: scene.prompt,
                    show_name: selectedShow,
                    scene_number: sceneNum,
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
            showSceneImage(sceneNum, imageURL);
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
    selectedShow = null;
    els.resultVideo.src = "";
    showScreen("select");
});
