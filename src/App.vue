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
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from "vue";

const wrapper = ref(null);
const bgCanvas = ref(null);
const drawCanvas = ref(null);

const showTools = ref(false);
const tools = ["Карандаш", "Ластик"];
const currentTool = ref("Карандаш");
const color = ref("#000000");
const size = ref(5);

const lines = ref([]);
const historyRedo = ref([]);

let zoom = 1;
const minZoom = 0.1;
const maxZoom = 10;

let offsetX = 0;
let offsetY = 0;

let isPanning = false;
let panStart = { x: 0, y: 0 };

let isDrawing = false;
let currentLine = null;

let img = null;

function resizeCanvases() {
  if (!wrapper.value) return;
  const w = wrapper.value.clientWidth;
  const h = wrapper.value.clientHeight;
  [bgCanvas.value, drawCanvas.value].forEach(canvas => {
    if (!canvas) return;
    canvas.width = w;
    canvas.height = h;
    canvas.style.width = w + "px";
    canvas.style.height = h + "px";
  });
  drawBackground();
  redrawDrawing();
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
      ctx.line=line.size/zoom
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
  if (isDrawing &&
      currentLine &&
      currentLine.points.length &&
      currentTool.value !== "Ластик") {
    ctx.strokeStyle = currentLine.color;
    ctx.lineWidth = currentLine.size;
    ctx.line=line.size/zoom
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

function getMousePos(e) {
  if (!drawCanvas.value) return { x: 0, y: 0 };
  const rect = drawCanvas.value.getBoundingClientRect();
  return {
    x: (e.clientX - rect.left - offsetX) / zoom,
    y: (e.clientY - rect.top - offsetY) / zoom
  };
}

function onPointerDown(e) {
  if (e.button === 2) {
    isPanning = true;
    panStart.x = e.clientX;
    panStart.y = e.clientY;
  } else if (e.button === 0) {
    const pos = getMousePos(e);
    if (currentTool.value === "Карандаш") {
      isDrawing = true;
      currentLine = {
        points: [pos],
        color: color.value,
        size: size.value,
      };
      historyRedo.value = [];
      redrawDrawing();
    } else if (currentTool.value === "Ластик") {
      isDrawing = true;
      redrawDrawing();
    }
  }
}

const pos=getMousePos(e);
function onPointerMove(e){
  if (isPanning) {
    const dx = e.clientX - panStart.x;
    const dy = e.clientY - panStart.y;
    panStart.x = e.clientX;
    panStart.y = e.clientY;
    offsetX += dx;
    offsetY += dy;
    drawBackground();
    redrawDrawing();
  } else if (isDrawing) {
   if(currentTool.value === "Ластик"){
     lines.value=lines.value.filter((line)=>{
       return !line.points.some((p)=>{
         const dx=p.x-pos.x;
         const dy=p.y-pos.y;
         return Math.sqrt(dx*dx+dy*dy)<size.value/zoom;
       });
     });
    redrawDrawing();
    return;
  }}
   currentLine.points.push(pos);
}

function onPointerUp() {
  if (isDrawing) {
    if (currentLine && currentLine.points.length > 1 && currentTool.value!=="Ластик") {
      lines.value.push(currentLine);
      historyRedo.value = [];
    }
    currentLine = null;
  }
  isDrawing = false;
  isPanning = false;
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
}

function undoAction() {
  if (lines.value.length === 0) return;
  const removed = lines.value.pop();
  if (removed) {
    historyRedo.value.push(removed);
  }
  redrawDrawing();
}
//TODO Кнопка Redo для возврата!
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
}

.bg-canvas {
  z-index: 0;
  background: #fff;
}

.draw-canvas {
  z-index: 1;
  cursor: crosshair;
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
  border-radius: 8px;
  cursor: pointer;
  overflow: hidden;
  transition: background 0.3s ease;
}
.upload-btn:hover {
  background: #357abd;
}
.upload-btn input[type="file"] {
  position: absolute;
  left: 0;
  top: 0;
  opacity: 0;
  cursor: pointer;
  width: 100%;
  height: 100%;
}

.clear-btn {
  background: #f2f6ff;
  border: none;
  padding: 10px;
  font-weight: bold;
  border-radius: 10px;
  cursor: pointer;
  transition: background 0.3s ease;
}
.clear-btn:hover {
  background: #e0ebff;
}

.undo-btn {
  background: #fff5f5;
  border: none;
  padding: 10px;
  font-weight: bold;
  font-size: 14px;
  border-radius: 10px;
  cursor: pointer;
  transition: background 0.3s ease;
  color: #d9534f;
  box-shadow: 0 2px 6px rgba(217, 83, 79, 0.2);
}
.undo-btn:disabled {
  opacity: 0.5;
  cursor: default;
}
.undo-btn:hover:not(:disabled) {
  background: #ffeaea;
}
</style>
