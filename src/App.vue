<template>
  <div class="draw-app">
    <canvas ref="canvasRef" class="drawing-board"></canvas>

    <button class="tools-toggle" @click="showTools = !showTools">
      🛠️ Инструменты
    </button>

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
      <input type="range" min="1" max="30" v-model="size" />
      <button class="clear-btn" @click="clearCanvas">Очистить</button>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
const canvasRef = ref(null)
const showTools = ref(false)
const tools = [
  "Карандаш",
  "Ластик",
  "Заливка",
  "Линия",
  "Прямоугольник",
  "Круг",
  "Текст",
  "Пипетка"
]
const currentTool = ref("Карандаш")
const color = ref("#000000")
const size = ref(5)
let isDrawing = false
let lastX = 0
let lastY = 0
const selectTool = (tool) => {
  currentTool.value = tool
  showTools.value = false
}
function clearCanvas() {
  const canvas = canvasRef.value
  const ctx = canvas.getContext("2d")
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  ctx.fillStyle = "#ffffff"
  ctx.fillRect(0, 0, canvas.width, canvas.height)
}
function startDrawing(e) {
  if (currentTool.value !== "Карандаш") return
  isDrawing = true
  const rect = canvasRef.value.getBoundingClientRect()
  lastX = e.clientX - rect.left
  lastY = e.clientY - rect.top
}
function draw(e) {
  if (!isDrawing || currentTool.value !== "Карандаш") return
  const canvas = canvasRef.value
  const ctx = canvas.getContext("2d")
  const rect = canvas.getBoundingClientRect()
  const currentX = e.clientX - rect.left
  const currentY = e.clientY - rect.top
  ctx.strokeStyle = color.value
  ctx.lineWidth = size.value
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(lastX, lastY)
  ctx.lineTo(currentX, currentY)
  ctx.stroke()
  lastX = currentX
  lastY = currentY
}
function stopDrawing() {
  isDrawing = false
}
onMounted(() => {
  const canvas = canvasRef.value
  canvas.width = window.innerWidth
  canvas.height = window.innerHeight
  const ctx = canvas.getContext("2d")
  ctx.fillStyle = "#ffffff"
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  canvas.addEventListener("mousedown", startDrawing)
  canvas.addEventListener("mousemove", draw)
  canvas.addEventListener("mouseup", stopDrawing)
  canvas.addEventListener("mouseleave", stopDrawing)
})
function loadImage(event){
  const file=event.target.files[0]
  if(!file)return
  const img=new Image()
  img.onload=()=>{
    const canvas=canvasRef.value
    const ctx=canvas.getContext("2d")
    const x=(canvas.width-img.width)/2
    const y=(canvas.height-img.height)/2
    ctx.drawImage(img,0,0,canvas.width,canvas.height)
  }
  img.src=URL.createObjectURL(file)
}
</script>
<style scoped>
.draw-app {
  position: relative;
  width: 100vw;
  height: 100vh;
  background: #fdfdfd;
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  overflow: hidden;
  user-select: none;
}

.drawing-board {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: white;
  cursor: crosshair;
  box-shadow: inset 0 0 8px rgba(0,0,0,0.1);
}

.tools-toggle {
  position: absolute;
  top: 20px;
  left: 20px;
  background: linear-gradient(135deg, #4a90e2, #357ABD);
  color: white;
  font-weight: bold;
  font-size: 16px;
  padding: 12px 20px;
  border: none;
  border-radius: 14px;
  cursor: pointer;
  z-index: 11;
  box-shadow: 0 4px 12px rgba(53,122,189,0.5);
  transition: background 0.3s ease, box-shadow 0.3s ease;
}

.tools-toggle:hover {
  background: linear-gradient(135deg, #357ABD, #285a8f);
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
  box-shadow: 0 0 4px rgba(0,0,0,0.2);
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
  background: #357ABD;
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

</style>