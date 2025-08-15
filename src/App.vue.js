/// <reference types="../node_modules/.vue-global-types/vue_3.5_0_0_0.d.ts" />
import { ref, onMounted, onBeforeUnmount, computed, watch } from "vue";
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
const cutButtonPos = ref({ x: 0, y: 0 });
const showCutButton = computed(() => currentTool.value === "Лассо");
watch(lassoPoints, (points) => {
    if (points.length > 0) {
        const lastPoint = points[points.length - 1];
        cutButtonPos.value = {
            x: lastPoint.x * zoom + offsetX,
            y: lastPoint.y * zoom + offsetY,
        };
    }
});
let currentLine = null;
let zoom = 1;
const minZoom = 0.1;
const maxZoom = 10;
let offsetX = 0;
let offsetY = 0;
let panStart = { x: 0, y: 0 };
let img = null;
function resizeCanvases() {
    if (!wrapper.value)
        return;
    const w = wrapper.value.clientWidth;
    const h = wrapper.value.clientHeight;
    [bgCanvas.value, drawCanvas.value, lasso.value].forEach((canvas) => {
        if (!canvas)
            return;
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
    }
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
        if (!line.points.length)
            continue;
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
        }
        else {
            for (let i = 0; i < line.points.length; i++) {
                const p = line.points[i];
                const px = p.x * zoom + offsetX;
                const py = p.y * zoom + offsetY;
                if (i === 0)
                    ctx.moveTo(px, py);
                else
                    ctx.lineTo(px, py);
            }
            ctx.stroke();
        }
    }
    if (isDrawing.value &&
        currentLine &&
        currentLine.points.length &&
        currentTool.value !== "Ластик" &&
        currentTool.value !== "Лассо") {
        const p0 = currentLine.points[0];
        const px0 = p0.x * zoom + offsetX;
        const py0 = p0.y * zoom + offsetY;
        ctx.strokeStyle = currentLine.color;
        ctx.lineWidth = currentLine.size;
        ctx.beginPath();
        ctx.moveTo(px0, py0);
        for (let i = 1; i < currentLine.points.length; i++) {
            const p = currentLine.points[i];
            const px = p.x * zoom + offsetX;
            const py = p.y * zoom + offsetY;
            ctx.lineTo(px, py);
        }
        ctx.stroke();
    }
}
function drawLassoPath() {
    const ctx = lasso.value.getContext("2d");
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, lasso.value.width, lasso.value.height);
    if (lassoPoints.value.length === 0)
        return;
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
    if (!drawCanvas.value)
        return { x: 0, y: 0 };
    const rect = drawCanvas.value.getBoundingClientRect();
    return {
        x: (e.clientX - rect.left - offsetX) / zoom,
        y: (e.clientY - rect.top - offsetY) / zoom,
    };
}
function onPointerDown(e) {
    if (e.target && e.target.closest && e.target.closest(".cut-button"))
        return;
    if (e.button === 2) {
        isPanning.value = true;
        panStart.x = e.clientX;
        panStart.y = e.clientY;
        return;
    }
    if (e.button !== 0)
        return;
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
    }
    else if (currentTool.value === "Ластик") {
        isDrawing.value = true;
        redrawDrawing();
    }
    else if (currentTool.value === "Лассо") {
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
    if (!isDrawing.value)
        return;
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
        drawLassoPath();
        return;
    }
    if (currentLine) {
        currentLine.points.push(pos);
        redrawDrawing();
    }
}
function onPointerUp() {
    if (isDrawing.value) {
        if (currentLine &&
            currentLine.points.length > 1 &&
            currentTool.value !== "Ластик" &&
            currentTool.value !== "Лассо") {
            lines.value.push(currentLine);
            historyRedo.value = [];
        }
    }
    isDrawing.value = false;
    isPanning.value = false;
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
    if (!file)
        return;
    const image = new Image();
    image.crossOrigin = "anonymous";
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
}
function downloadImage() {
    const bg = bgCanvas.value;
    const draw = drawCanvas.value;
    if (!bg || !draw)
        return;
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
function pointInPolygon(point, polygon) {
    const x = point.x, y = point.y;
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const xi = polygon[i].x, yi = polygon[i].y;
        const xj = polygon[j].x, yj = polygon[j].y;
        const intersect = ((yi > y) !== (yj > y)) &&
            (x < ((xj - xi) * (y - yi)) / (yj - yi) + xi);
        if (intersect)
            inside = !inside;
    }
    return inside;
}
function cutLassoArea() {
    console.log("cutLassoArea work");
    if (lassoPoints.value.length < 3) {
        console.warn("Мало точек");
        return;
    }
    const polygon = lassoPoints.value.map(p => ({ x: p.x, y: p.y }));
    lines.value = lines.value.filter(line => {
        return !line.points.some(point => pointInPolygon(point, polygon));
    });
    if (!img) {
        lassoPoints.value = [];
        drawLassoPath();
        redrawDrawing();
        return;
    }
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = img.width;
    tempCanvas.height = img.height;
    const tempCtx = tempCanvas.getContext('2d');
    tempCtx.drawImage(img, 0, 0);
    tempCtx.globalCompositeOperation = 'destination-out';
    tempCtx.beginPath();
    tempCtx.moveTo(polygon[0].x, polygon[0].y);
    for (let i = 1; i < polygon.length; i++) {
        tempCtx.lineTo(polygon[i].x, polygon[i].y);
    }
    tempCtx.closePath();
    tempCtx.fill();
    const newImg = new Image();
    newImg.onload = () => {
        img = newImg;
        drawBackground();
        redrawDrawing();
    };
    newImg.src = tempCanvas.toDataURL();
    lassoPoints.value = [];
    drawLassoPath();
}
function undoAction() {
    if (lines.value.length === 0)
        return;
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
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_components;
let __VLS_directives;
/** @type {__VLS_StyleScopedClasses['tools-toggle']} */ ;
/** @type {__VLS_StyleScopedClasses['toolbar']} */ ;
/** @type {__VLS_StyleScopedClasses['tools-list']} */ ;
/** @type {__VLS_StyleScopedClasses['tools-list']} */ ;
/** @type {__VLS_StyleScopedClasses['tools-list']} */ ;
/** @type {__VLS_StyleScopedClasses['upload-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['upload-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['clear-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['undo-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['undo-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['cut-button']} */ ;
// CSS variable injection 
// CSS variable injection end 
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ onWheel: (__VLS_ctx.handleWheel) },
    ...{ onMousedown: (__VLS_ctx.onPointerDown) },
    ...{ onMousemove: (__VLS_ctx.onPointerMove) },
    ...{ onMouseup: (__VLS_ctx.onPointerUp) },
    ...{ onMouseleave: (__VLS_ctx.onPointerUp) },
    ...{ onContextmenu: () => { } },
    ...{ class: "draw-app" },
    ref: "wrapper",
});
/** @type {typeof __VLS_ctx.wrapper} */ ;
__VLS_asFunctionalElement(__VLS_intrinsicElements.canvas, __VLS_intrinsicElements.canvas)({
    ref: "bgCanvas",
    ...{ class: "canvas bg-canvas" },
});
/** @type {typeof __VLS_ctx.bgCanvas} */ ;
__VLS_asFunctionalElement(__VLS_intrinsicElements.canvas, __VLS_intrinsicElements.canvas)({
    ref: "drawCanvas",
    ...{ class: "canvas draw-canvas" },
});
/** @type {typeof __VLS_ctx.drawCanvas} */ ;
__VLS_asFunctionalElement(__VLS_intrinsicElements.canvas, __VLS_intrinsicElements.canvas)({
    ref: "lasso",
    ...{ class: "lasso-canvas" },
});
/** @type {typeof __VLS_ctx.lasso} */ ;
__VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
    ...{ onMousedown: () => { } },
    ...{ onMouseup: () => { } },
    ...{ onClick: (__VLS_ctx.cutLassoArea) },
    ...{ class: "cut-button" },
    ...{ style: ({ top: __VLS_ctx.cutButtonPos.y + 'px', left: __VLS_ctx.cutButtonPos.x + 'px' }) },
});
__VLS_asFunctionalDirective(__VLS_directives.vShow)(null, { ...__VLS_directiveBindingRestFields, value: (__VLS_ctx.showCutButton && __VLS_ctx.lassoPoints.length > 2) }, null, null);
__VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.showTools = !__VLS_ctx.showTools;
        } },
    ...{ class: "tools-toggle" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "toolbar" },
    ...{ class: ({ visible: __VLS_ctx.showTools }) },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "tools-list" },
});
for (const [tool] of __VLS_getVForSourceType((__VLS_ctx.tools))) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (...[$event]) => {
                __VLS_ctx.selectTool(tool);
            } },
        key: (tool),
        ...{ class: ({ active: __VLS_ctx.currentTool === tool }) },
    });
    (tool);
}
__VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({
    ...{ class: "upload-btn" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
    ...{ onChange: (__VLS_ctx.loadImage) },
    type: "file",
    accept: "image/*",
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
    type: "color",
});
(__VLS_ctx.color);
__VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
    type: "range",
    min: "1",
    max: "30",
});
(__VLS_ctx.size);
__VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
    ...{ onClick: (__VLS_ctx.clearDrawing) },
    ...{ class: "clear-btn" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
    ...{ onClick: (__VLS_ctx.undoAction) },
    ...{ class: "undo-btn" },
    disabled: (__VLS_ctx.lines.length === 0),
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
    ...{ onClick: (__VLS_ctx.downloadImage) },
});
/** @type {__VLS_StyleScopedClasses['draw-app']} */ ;
/** @type {__VLS_StyleScopedClasses['canvas']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-canvas']} */ ;
/** @type {__VLS_StyleScopedClasses['canvas']} */ ;
/** @type {__VLS_StyleScopedClasses['draw-canvas']} */ ;
/** @type {__VLS_StyleScopedClasses['lasso-canvas']} */ ;
/** @type {__VLS_StyleScopedClasses['cut-button']} */ ;
/** @type {__VLS_StyleScopedClasses['tools-toggle']} */ ;
/** @type {__VLS_StyleScopedClasses['toolbar']} */ ;
/** @type {__VLS_StyleScopedClasses['visible']} */ ;
/** @type {__VLS_StyleScopedClasses['tools-list']} */ ;
/** @type {__VLS_StyleScopedClasses['active']} */ ;
/** @type {__VLS_StyleScopedClasses['upload-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['clear-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['undo-btn']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            wrapper: wrapper,
            bgCanvas: bgCanvas,
            drawCanvas: drawCanvas,
            lasso: lasso,
            showTools: showTools,
            tools: tools,
            currentTool: currentTool,
            color: color,
            size: size,
            lines: lines,
            lassoPoints: lassoPoints,
            cutButtonPos: cutButtonPos,
            showCutButton: showCutButton,
            onPointerDown: onPointerDown,
            onPointerMove: onPointerMove,
            onPointerUp: onPointerUp,
            handleWheel: handleWheel,
            loadImage: loadImage,
            clearDrawing: clearDrawing,
            selectTool: selectTool,
            downloadImage: downloadImage,
            cutLassoArea: cutLassoArea,
            undoAction: undoAction,
        };
    },
});
export default (await import('vue')).defineComponent({
    setup() {
        return {};
    },
});
; /* PartiallyEnd: #4569/main.vue */
