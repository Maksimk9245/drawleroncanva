var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
import { ref, onMounted, onBeforeUnmount, computed, watch } from "vue";
var wrapper = ref(null);
var bgCanvas = ref(null);
var drawCanvas = ref(null);
var lasso = ref(null);
var showTools = ref(false);
var tools = ["Карандаш", "Ластик", "Лассо"];
var currentTool = ref("Карандаш");
var color = ref("#000000");
var size = ref(5);
var lines = ref([]);
var historyRedo = ref([]);
var lassoPoints = ref([]);
var isDrawing = ref(false);
var isPanning = ref(false);
var cutButtonPos = ref({ x: 0, y: 0 });
var showCutButton = computed(function () { return currentTool.value === "Лассо"; });
watch(lassoPoints, function (points) {
    if (points.length > 0) {
        var lastPoint = points[points.length - 1];
        cutButtonPos.value = {
            x: lastPoint.x * zoom + offsetX,
            y: lastPoint.y * zoom + offsetY,
        };
    }
});
var currentLine = null;
var zoom = 1;
var minZoom = 0.1;
var maxZoom = 10;
var offsetX = 0;
var offsetY = 0;
var panStart = { x: 0, y: 0 };
var img = null;
function resizeCanvases() {
    if (!wrapper.value)
        return;
    var w = wrapper.value.clientWidth;
    var h = wrapper.value.clientHeight;
    [bgCanvas.value, drawCanvas.value, lasso.value].forEach(function (canvas) {
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
    var ctx = bgCanvas.value.getContext("2d");
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
    var ctx = drawCanvas.value.getContext("2d");
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, drawCanvas.value.width, drawCanvas.value.height);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    for (var _i = 0, _a = lines.value; _i < _a.length; _i++) {
        var line = _a[_i];
        if (!line.points.length)
            continue;
        ctx.strokeStyle = line.color;
        ctx.lineWidth = line.size;
        ctx.beginPath();
        if (line.points.length === 1) {
            var p = line.points[0];
            var px = p.x * zoom + offsetX;
            var py = p.y * zoom + offsetY;
            ctx.fillStyle = line.color;
            ctx.arc(px, py, line.size / 2, 0, Math.PI * 2);
            ctx.fill();
        }
        else {
            for (var i = 0; i < line.points.length; i++) {
                var p = line.points[i];
                var px = p.x * zoom + offsetX;
                var py = p.y * zoom + offsetY;
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
        var p0 = currentLine.points[0];
        var px0 = p0.x * zoom + offsetX;
        var py0 = p0.y * zoom + offsetY;
        ctx.strokeStyle = currentLine.color;
        ctx.lineWidth = currentLine.size;
        ctx.beginPath();
        ctx.moveTo(px0, py0);
        for (var i = 1; i < currentLine.points.length; i++) {
            var p = currentLine.points[i];
            var px = p.x * zoom + offsetX;
            var py = p.y * zoom + offsetY;
            ctx.lineTo(px, py);
        }
        ctx.stroke();
    }
}
function drawLassoPath() {
    var ctx = lasso.value.getContext("2d");
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, lasso.value.width, lasso.value.height);
    if (lassoPoints.value.length === 0)
        return;
    ctx.beginPath();
    ctx.strokeStyle = "rgba(0, 0, 255, 0.8)";
    ctx.lineWidth = 2;
    var start = lassoPoints.value[0];
    ctx.moveTo(start.x * zoom + offsetX, start.y * zoom + offsetY);
    for (var i = 1; i < lassoPoints.value.length; i++) {
        var p = lassoPoints.value[i];
        ctx.lineTo(p.x * zoom + offsetX, p.y * zoom + offsetY);
    }
    ctx.closePath();
    ctx.stroke();
}
function getMousePos(e) {
    if (!drawCanvas.value)
        return { x: 0, y: 0 };
    var rect = drawCanvas.value.getBoundingClientRect();
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
    var pos = getMousePos(e);
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
    var pos = getMousePos(e);
    if (isPanning.value) {
        var dx = e.clientX - panStart.x;
        var dy = e.clientY - panStart.y;
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
        lines.value = lines.value.filter(function (line) {
            return !line.points.some(function (p) {
                var dx = p.x - pos.x;
                var dy = p.y - pos.y;
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
    var rect = bgCanvas.value.getBoundingClientRect();
    var mouseX = e.clientX - rect.left;
    var mouseY = e.clientY - rect.top;
    var prevX = (mouseX - offsetX) / zoom;
    var prevY = (mouseY - offsetY) / zoom;
    zoom *= e.deltaY < 0 ? 1.1 : 0.9;
    zoom = Math.min(Math.max(zoom, minZoom), maxZoom);
    offsetX = mouseX - prevX * zoom;
    offsetY = mouseY - prevY * zoom;
    drawBackground();
    redrawDrawing();
    drawLassoPath();
}
function loadImage(e) {
    var file = e.target.files[0];
    if (!file)
        return;
    var image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = function () {
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
    var bg = bgCanvas.value;
    var draw = drawCanvas.value;
    if (!bg || !draw)
        return;
    var tempCanvas = document.createElement("canvas");
    tempCanvas.width = bg.width;
    tempCanvas.height = bg.height;
    var ctx = tempCanvas.getContext("2d");
    ctx.drawImage(bg, 0, 0);
    ctx.drawImage(draw, 0, 0);
    var link = document.createElement("a");
    link.download = "drawing.png";
    link.href = tempCanvas.toDataURL("image/png");
    link.click();
}
function pointInPolygon(point, polygon) {
    var x = point.x, y = point.y;
    var inside = false;
    for (var i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        var xi = polygon[i].x, yi = polygon[i].y;
        var xj = polygon[j].x, yj = polygon[j].y;
        var intersect = ((yi > y) !== (yj > y)) &&
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
    var polygon = lassoPoints.value.map(function (p) { return ({ x: p.x, y: p.y }); });
    lines.value = lines.value.filter(function (line) {
        return !line.points.some(function (point) { return pointInPolygon(point, polygon); });
    });
    if (!img) {
        lassoPoints.value = [];
        drawLassoPath();
        redrawDrawing();
        return;
    }
    var tempCanvas = document.createElement('canvas');
    tempCanvas.width = img.width;
    tempCanvas.height = img.height;
    var tempCtx = tempCanvas.getContext('2d');
    tempCtx.drawImage(img, 0, 0);
    tempCtx.globalCompositeOperation = 'destination-out';
    tempCtx.beginPath();
    tempCtx.moveTo(polygon[0].x, polygon[0].y);
    for (var i = 1; i < polygon.length; i++) {
        tempCtx.lineTo(polygon[i].x, polygon[i].y);
    }
    tempCtx.closePath();
    tempCtx.fill();
    var newImg = new Image();
    newImg.onload = function () {
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
    var removed = lines.value.pop();
    if (removed) {
        historyRedo.value.push(removed);
    }
    redrawDrawing();
}
function onResize() {
    resizeCanvases();
}
onMounted(function () {
    resizeCanvases();
    window.addEventListener("resize", onResize);
});
onBeforeUnmount(function () {
    window.removeEventListener("resize", onResize);
});
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
var __VLS_ctx = {};
var __VLS_components;
var __VLS_directives;
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
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign(__assign(__assign(__assign(__assign(__assign(__assign({ onWheel: (__VLS_ctx.handleWheel) }, { onMousedown: (__VLS_ctx.onPointerDown) }), { onMousemove: (__VLS_ctx.onPointerMove) }), { onMouseup: (__VLS_ctx.onPointerUp) }), { onMouseleave: (__VLS_ctx.onPointerUp) }), { onContextmenu: function () { } }), { class: "draw-app" }), { ref: "wrapper" }));
/** @type {typeof __VLS_ctx.wrapper} */ ;
__VLS_asFunctionalElement(__VLS_intrinsicElements.canvas, __VLS_intrinsicElements.canvas)(__assign({ ref: "bgCanvas" }, { class: "canvas bg-canvas" }));
/** @type {typeof __VLS_ctx.bgCanvas} */ ;
__VLS_asFunctionalElement(__VLS_intrinsicElements.canvas, __VLS_intrinsicElements.canvas)(__assign({ ref: "drawCanvas" }, { class: "canvas draw-canvas" }));
/** @type {typeof __VLS_ctx.drawCanvas} */ ;
__VLS_asFunctionalElement(__VLS_intrinsicElements.canvas, __VLS_intrinsicElements.canvas)(__assign({ ref: "lasso" }, { class: "lasso-canvas" }));
/** @type {typeof __VLS_ctx.lasso} */ ;
__VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)(__assign(__assign(__assign(__assign({ onMousedown: function () { } }, { onMouseup: function () { } }), { onClick: (__VLS_ctx.cutLassoArea) }), { class: "cut-button" }), { style: ({ top: __VLS_ctx.cutButtonPos.y + 'px', left: __VLS_ctx.cutButtonPos.x + 'px' }) }));
__VLS_asFunctionalDirective(__VLS_directives.vShow)(null, __assign(__assign({}, __VLS_directiveBindingRestFields), { value: (__VLS_ctx.showCutButton && __VLS_ctx.lassoPoints.length > 2) }), null, null);
__VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)(__assign({ onClick: function () {
        var _a = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            _a[_i] = arguments[_i];
        }
        var $event = _a[0];
        __VLS_ctx.showTools = !__VLS_ctx.showTools;
    } }, { class: "tools-toggle" }));
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "toolbar" }, { class: ({ visible: __VLS_ctx.showTools }) }));
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "tools-list" }));
var _loop_1 = function (tool) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)(__assign(__assign({ onClick: function () {
            var _a = [];
            for (var _i = 0; _i < arguments.length; _i++) {
                _a[_i] = arguments[_i];
            }
            var $event = _a[0];
            __VLS_ctx.selectTool(tool);
        } }, { key: (tool) }), { class: ({ active: __VLS_ctx.currentTool === tool }) }));
    (tool);
};
for (var _i = 0, _a = __VLS_getVForSourceType((__VLS_ctx.tools)); _i < _a.length; _i++) {
    var tool = _a[_i][0];
    _loop_1(tool);
}
__VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)(__assign({ class: "upload-btn" }));
__VLS_asFunctionalElement(__VLS_intrinsicElements.input)(__assign({ onChange: (__VLS_ctx.loadImage) }, { type: "file", accept: "image/*" }));
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
__VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)(__assign({ onClick: (__VLS_ctx.clearDrawing) }, { class: "clear-btn" }));
__VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)(__assign(__assign({ onClick: (__VLS_ctx.undoAction) }, { class: "undo-btn" }), { disabled: (__VLS_ctx.lines.length === 0) }));
__VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)(__assign({ onClick: (__VLS_ctx.downloadImage) }));
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
var __VLS_self = (await import('vue')).defineComponent({
    setup: function () {
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
    setup: function () {
        return {};
    },
});
; /* PartiallyEnd: #4569/main.vue */
