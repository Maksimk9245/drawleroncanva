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
    <canvas ref="lasso" class="lasso-canvas"></canvas>

    <button @click="cutLassoArea" :disabled="lassoPoints.length < 3">Вырезать лассо</button>
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
const lasso = ref(null);

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

let currentLine = null;

let zoom = 1;
const minZoom = 0.1;
const maxZoom = 10;

let offsetX = 0;
let offsetY = 0;

let panStart = { x: 0, y: 0 };

let img = null;

function resizeCanvases() {
  if (!wrapper.value) return;
  const w = wrapper.value.clientWidth;
  const h = wrapper.value.clientHeight;
  [bgCanvas.value, drawCanvas.value, lasso.value].forEach((canvas) => {
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
  if (img) {
    ctx.drawImage(img, 0, 0);
  } else {
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

  if (isDrawing.value && currentLine && currentLine.points.length && currentTool.value !== "Ластик" && currentTool.value !== "Лассо") {
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
  const ctx = lasso.value.getContext("2d");
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, lasso.value.width, lasso.value.height);

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
    isPanning.value = true;
    panStart.x = e.clientX;
    panStart.y = e.clientY;
    return;
  }
  if (e.button !== 0) return;

  const pos = getMousePos(e);

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
    isDrawing.value = true;
    lassoPoints.value = [pos];
    drawLassoPath();
  }
}

function onPointerMove(e) {
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

  if (!isDrawing.value) return;

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

  if (currentTool.value === "Лассо") {
    lassoPoints.value.push(pos);
    drawBackground();
    redrawDrawing();
    drawLassoPath();
    return;
  }

  if (currentLine) {
    currentLine.points.push(pos);
    redrawDrawing();
  }
}

function onPointerUp(e) {
  if (isDrawing.value) {
    if (
        currentLine &&
        currentLine.points.length > 1 &&
        currentTool.value !== "Ластик" &&
        currentTool.value !== "Лассо"
    ) {
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
  if (tool !== "Лассо") {
    lassoPoints.value = [];
    drawLassoPath();
  }
  showTools.value = false;
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
  const tempCanvas = document.createElement("canvas");
  tempCanvas.width = img.width;
  tempCanvas.height = img.height;
  const tempCtx = tempCanvas.getContext("2d");
  tempCtx.clearRect(0, 0, tempCanvas.width, tempCanvas.height);
  tempCtx.save();
  tempCtx.beginPath();
  const pointsOnImage = lassoPoints.value;
  tempCtx.moveTo(pointsOnImage[0].x, pointsOnImage[0].y);
  for (let i = 1; i < pointsOnImage.length; i++) {
    tempCtx.lineTo(pointsOnImage[i].x, pointsOnImage[i].y);
  }
  tempCtx.closePath();
  tempCtx.clip();
  tempCtx.drawImage(img, 0, 0);
  tempCtx.restore();
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

function undoAction() {
  if (lines.value.length === 0) return;
  const removed = lines.value.pop();
  if (removed) {
    historyRedo.value.push(removed);
  }
  redrawDrawing();
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
