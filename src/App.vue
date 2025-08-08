<template>
  <div
      class="draw-app"
      ref="wrapper"
      @wheel.prevent="handleWheel"
      @mousedown="onPointerDown"
      @mousemove="onPointerMove"
      @mouseup="onPointerUp"
      @mouseleave="onPointerUp"
      @contextmenu.prevent
  >
    <canvas ref="bgCanvas" class="canvas bg-canvas"></canvas>
    <canvas ref="drawCanvas" class="canvas draw-canvas"></canvas>
    <canvas ref="lassoCanvas" class="canvas lasso-canvas"></canvas>

    <button @click="cutLassoArea" :disabled="lassoPoints.length < 1">Лассо</button>
    <button class="tools-toggle" @click="showTools = !showTools">🛠️ Инструменты</button>
    <div class="toolbar" :class="{ visible: showTools }">
      <div class="tools-list">
        <button
            v-for="tool in tools"
            :key="tool"
            :class="{ active: currentTool === tool }"
            @click="selectTool(tool)"
        >
          {{ tool }}
        </button>
      </div>
      <label class="upload-btn">
        Загрузить изображение
        <input type="file" accept="image/*" @change="loadImage" />
      </label>
      <input type="color" v-model="color" />
      <input type="range" min="1" max="30" v-model.number="size" />
      <button class="clear-btn" @click="clearDrawing">Очистить</button>
      <button class="undo-btn" @click="undoAction" :disabled="lines.length === 0">Отменить</button>
      <button @click="downloadImage">Скачать изображение</button>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from "vue";

const wrapper = ref(null);
const bgCanvas = ref(null);
const drawCanvas = ref(null);
const lassoCanvas = ref(null);

const showTools = ref(false);
const tools = ["Карандаш", "Ластик", "Лассо"];
const currentTool = ref("Карандаш");
const color = ref("#000000");
const size = ref(5);

const lines = ref([]);
const historyRedo = ref([]);

const lassoPoints = ref([]);
const isDrawing = ref(false);
const isPanning = ref(false);

let zoom = 1;
const minZoom = 0.1;
const maxZoom = 10;
let offsetX = 0;
let offsetY = 0;

let panStart = { x: 0, y: 0 };
let currentLine = null;
let img = null;

function resizeCanvases() {
  if (!wrapper.value) return;
  const w = wrapper.value.clientWidth;
  const h = wrapper.value.clientHeight;
  [bgCanvas.value, drawCanvas.value, lassoCanvas.value].forEach((canvas) => {
    if (!canvas) return;
    canvas.width = w;
    canvas.height = h;
    canvas.style.width = w + "px";
    canvas.style.height = h + "px";
  });
  drawBackground();
  redrawDrawing();
  drawLassoPath();
}

function drawBackground() {
  const ctx = bgCanvas.value.getContext("2d");
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, bgCanvas.value.width, bgCanvas.value.height);
  ctx.setTransform(zoom, 0, 0, zoom, offsetX, offsetY);
  if (img) ctx.drawImage(img, 0, 0);
  else {
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, bgCanvas.value.width / zoom, bgCanvas.value.height / zoom);
  }
}

function redrawDrawing() {
  const ctx = drawCanvas.value.getContext("2d");
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, drawCanvas.value.width, drawCanvas.value.height);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  for (const line of lines.value) {
    if (!line.points.length) continue;
    ctx.strokeStyle = line.color;
    ctx.lineWidth = line.size;
    ctx.beginPath();
    if (line.points.length === 1) {
      const p = line.points[0];
      const px = p.x * zoom + offsetX;
      const py = p.y * zoom + offsetY;
      ctx.fillStyle = line.color;
      ctx.arc(px, py, line.size / 2, 0, Math.PI * 2);
      ctx.fill();
    } else {
      for (let i = 0; i < line.points.length; i++) {
        const p = line.points[i];
        const px = p.x * zoom + offsetX;
        const py = p.y * zoom + offsetY;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
    }
  }

  if (isDrawing.value && currentLine && currentTool.value !== "Ластик" && currentTool.value !== "Лассо") {
    ctx.strokeStyle = currentLine.color;
    ctx.lineWidth = currentLine.size;
    ctx.beginPath();
    if (currentLine.points.length === 1) {
      const p = currentLine.points[0];
      const px = p.x * zoom + offsetX;
      const py = p.y * zoom + offsetY;
      ctx.fillStyle = currentLine.color;
      ctx.arc(px, py, currentLine.size / 2, 0, Math.PI * 2);
      ctx.fill();
    } else {
      for (let i = 0; i < currentLine.points.length; i++) {
        const p = currentLine.points[i];
        const px = p.x * zoom + offsetX;
        const py = p.y * zoom + offsetY;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
    }
  }
}

function drawLassoPath() {
  const ctx = lassoCanvas.value.getContext("2d");
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, lassoCanvas.value.width, lassoCanvas.value.height);
  if (lassoPoints.value.length === 0) return;
  ctx.beginPath();
  ctx.strokeStyle = "rgba(0, 0, 255, 0.8)";
  ctx.lineWidth = 2;
  const start = lassoPoints.value[0];
  ctx.moveTo(start.x * zoom + offsetX, start.y * zoom + offsetY);
  for (let i = 1; i < lassoPoints.value.length; i++) {
    const p = lassoPoints.value[i];
    ctx.lineTo(p.x * zoom + offsetX, p.y * zoom + offsetY);
  }
  ctx.closePath();
  ctx.stroke();
}

function getMousePos(e) {
  if (!drawCanvas.value) return { x: 0, y: 0 };
  const rect = drawCanvas.value.getBoundingClientRect();
  return {
    x: (e.clientX - rect.left - offsetX) / zoom,
    y: (e.clientY - rect.top - offsetY) / zoom,
  };
}

function onPointerDown(e) {
  if (e.button === 2) {
    // Правая кнопка — панорамирование
    isPanning.value = true;
    panStart.x = e.clientX;
    panStart.y = e.clientY;
    return;
  }

  const pos = getMousePos(e);

  if (e.button === 0) {
    if (currentTool.value === "Карандаш") {
      isDrawing.value = true;
      currentLine = {
        points: [pos],
        color: color.value,
        size: size.value,
      };
      historyRedo.value = [];
      redrawDrawing();
    } else if (currentTool.value === "Ластик") {
      isDrawing.value = true;
      redrawDrawing();
    } else if (currentTool.value === "Лассо") {
      // Начинаем рисовать лассо
      lassoPoints.value = [pos];
      isDrawing.value = true;
      drawLassoPath();
    }
  }
}

function onPointerMove(e) {
  if (!isDrawing.value && !isPanning.value) return;

  const pos = getMousePos(e);

  if (isPanning.value) {
    const dx = e.clientX - panStart.x;
    const dy = e.clientY - panStart.y;
    panStart.x = e.clientX;
    panStart.y = e.clientY;
    offsetX += dx;
    offsetY += dy;
    drawBackground();
    redrawDrawing();
    drawLassoPath();
    return;
  }

  if (currentTool.value === "Лассо") {
    lassoPoints.value.push(pos);
    drawLassoPath();
    return;
  }

  if (currentTool.value === "Ластик") {
    lines.value = lines.value.filter((line) => {
      return !line.points.some((p) => {
        const dx = p.x - pos.x;
        const dy = p.y - pos.y;
        return Math.sqrt(dx * dx + dy * dy) < size.value / zoom;
      });
    });
    redrawDrawing();
    return;
  }

  if (currentLine) {
    currentLine.points.push(pos);
    redrawDrawing();
  }
}

function onPointerUp(e) {
  if (isDrawing.value) {
    if (currentTool.value === "Лассо") {
      // Лассо закончили рисовать, просто выключаем isDrawing
      isDrawing.value = false;
      drawLassoPath();
      return;
    }
    if (currentLine && currentLine.points.length > 1 && currentTool.value !== "Ластик") {
      lines.value.push(currentLine);
      historyRedo.value = [];
    }
    currentLine = null;
  }
  isDrawing.value = false;
  isPanning.value = false;
  drawLassoPath();
  redrawDrawing();
}

function handleWheel(e) {
  const rect = bgCanvas.value.getBoundingClientRect();
  const mouseX = e.clientX - rect.left;
  const mouseY = e.clientY - rect.top;
  const prevX = (mouseX - offsetX) / zoom;
  const prevY = (mouseY - offsetY) / zoom;
  zoom *= e.deltaY < 0 ? 1.1 : 0.9;
  zoom = Math.min(Math.max(zoom, minZoom), maxZoom);
  offsetX = mouseX - prevX * zoom;
  offsetY = mouseY - prevY * zoom;
  drawBackground();
  redrawDrawing();
  drawLassoPath();
}

function loadImage(e) {
  const file = e.target.files[0];
  if (!file) return;
  const image = new Image();
  image.onload = () => {
    img = image;
    zoom = 1;
    offsetX = 0;
    offsetY = 0;
    drawBackground();
    redrawDrawing();
  };
  image.src = URL.createObjectURL(file);
}

function clearDrawing() {
  lines.value = [];
  historyRedo.value = [];
  redrawDrawing();
}

function selectTool(tool) {
  currentTool.value = tool;
  showTools.value = false;
  if (tool !== "Лассо") {
    lassoPoints.value = [];
    drawLassoPath();
  }
}

function undoAction() {
  if (lines.value.length === 0) return;
  const removed = lines.value.pop();
  if (removed) {
    historyRedo.value.push(removed);
  }
  redrawDrawing();
}

function downloadImage() {
  const bg = bgCanvas.value;
  const draw = drawCanvas.value;
  if (!bg || !draw) return;
  const tempCanvas = document.createElement("canvas");
  tempCanvas.width = bg.width;
  tempCanvas.height = bg.height;
  const ctx = tempCanvas.getContext("2d");
  ctx.drawImage(bg, 0, 0);
  ctx.drawImage(draw, 0, 0);

  const link = document.createElement("a");
  link.download = "drawing.png";
  link.href = tempCanvas.toDataURL("image/png");
  link.click();
}

function cutLassoArea() {
  if (!img || lassoPoints.value.length < 3) return;

  const w = bgCanvas.value.width;
  const h = bgCanvas.value.height;

  // Создаем временный canvas
  const tempCanvas = document.createElement("canvas");
  tempCanvas.width = w;
  tempCanvas.height = h;
  const tempCtx = tempCanvas.getContext("2d");

  // Сброс трансформации перед рисованием изображения
  tempCtx.setTransform(1, 0, 0, 1, 0, 0);
  tempCtx.clearRect(0, 0, w, h);

  // Устанавливаем трансформацию zoom + offset
  tempCtx.setTransform(zoom, 0, 0, zoom, offsetX, offsetY);

  // Рисуем исходное изображение
  tempCtx.drawImage(img, 0, 0);

  // Создаем маску лассо
  tempCtx.globalCompositeOperation = "destination-in";
  tempCtx.beginPath();
  const start = lassoPoints.value[0];
  tempCtx.moveTo(start.x, start.y);
  for (let i = 1; i < lassoPoints.value.length; i++) {
    const p = lassoPoints.value[i];
    tempCtx.lineTo(p.x, p.y);
  }
  tempCtx.closePath();
  tempCtx.fill();

  // Получаем новое изображение из tempCanvas
  const newImage = new Image();
  newImage.onload = () => {
    img = newImage;
    lassoPoints.value = [];
    drawBackground();
    redrawDrawing();
    drawLassoPath();
  };
  newImage.src = tempCanvas.toDataURL();
}

function onResize() {
  resizeCanvases();
}

onMounted(() => {
  resizeCanvases();
  window.addEventListener("resize", onResize);
});

onBeforeUnmount(() => {
  window.removeEventListener("resize", onResize);
});
</script>

<style scoped>
.draw-app {
  position: relative;
  width: 100vw;
  height: 100vh;
  user-select: none;
  background: #fdfdfd;
  font-family: "Segoe UI", Tahoma, Geneva, Verdana, sans-serif;
  overflow: hidden;
}

.canvas {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  touch-action: none;
  border: 1px solid black;
}

.bg-canvas {
  z-index: 0;
  background: #fff;
}

.draw-canvas {
  z-index: 1;
  cursor: crosshair;
}

.lasso-canvas {
  z-index: 10;
  pointer-events: none;
}

.tools-toggle {
  position: absolute;
  top: 20px;
  left: 20px;
  background: linear-gradient(135deg, #4a90e2, #357abd);
  color: white;
  font-weight: bold;
  font-size: 16px;
  padding: 12px 20px;
  border: none;
  border-radius: 14px;
  cursor: pointer;
  z-index: 11;
  box-shadow: 0 4px 12px rgba(53, 122, 189, 0.5);
  transition: background 0.3s ease, box-shadow 0.3s ease;
}
.tools-toggle:hover {
  background: linear-gradient(135deg, #357abd, #285a8f);
}

.toolbar {
  position: absolute;
  top: 80px;
  left: 20px;
  width: 260px;
  padding: 20px;
  background: #fff;
  border-radius: 16px;
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.12);
  display: none;
  flex-direction: column;
  gap: 14px;
  z-index: 10;
}
.toolbar.visible {
  display: flex;
}

.tools-list {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  justify-content: center;
}

.tools-list button {
  flex: 1 0 45%;
  padding: 8px;
  background: #f0f0f0;
  border: none;
  border-radius: 8px;
  font-weight: 500;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s ease-in-out;
  text-align: center;
}
.tools-list button.active,
.tools-list button:hover {
  background: #4a90e2;
  color: white;
}

input[type="color"],
input[type="range"] {
  width: 100%;
  height: 36px;
  border: none;
  border-radius: 8px;
  box-shadow: inset 0 0 6px rgba(0, 0, 0, 0.1);
  cursor: pointer;
}
input[type="range"] {
  padding: 0;
  margin-top: 6px;
  appearance: none;
  background: #eee;
  height: 8px;
  border-radius: 6px;
}
input[type="range"]::-webkit-slider-thumb {
  appearance: none;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: red;
  cursor: pointer;
  border: none;
  margin-top: -5px;
  box-shadow: 0 0 4px rgba(0, 0, 0, 0.2);
}

.upload-btn {
  position: relative;
  display: inline-block;
  background: #4a90e2;
  color: white;
  font-weight: 600;
  font-size: 13px;
  padding: 10px;
  text-align: center;
  border-radius: 14px;
  cursor: pointer;
  overflow: hidden;
  user-select: none;
}
.upload-btn input[type="file"] {
  position: absolute;
  left: 0;
  top: 0;
  opacity: 0;
  width: 100%;
  height: 100%;
  cursor: pointer;
}

.clear-btn,
.undo-btn,
button {
  padding: 12px 20px;
  font-weight: 600;
  font-size: 14px;
  border-radius: 12px;
  border: none;
  cursor: pointer;
  background: #ef5350;
  color: white;
  transition: background-color 0.3s ease;
  user-select: none;
}
.clear-btn:hover,
.undo-btn:hover,
button:hover {
  background: #d32f2f;
}
.clear-btn:disabled,
.undo-btn:disabled,
button:disabled {
  background: #ccc;
  cursor: not-allowed;
  color: #666;
}
</style>
