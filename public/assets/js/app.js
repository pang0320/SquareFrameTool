(() => {
    'use strict';

    const MAX_FILE_SIZE_BYTES = 40 * 1024 * 1024;
    const PREVIEW_MAX_SIZE = 720;
    const PREVIEW_BATCH_SIZE = 4;
    const IMAGE_DECODE_CONCURRENCY = 2;
    const IMAGE_EXPORT_CONCURRENCY = 2;
    const ACCEPTED_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);
    const EXTENSIONS = {
        'image/png': 'png',
        'image/jpeg': 'jpg',
        'image/webp': 'webp',
    };
    const ASPECT_RATIOS = {
        '1:1': { width: 1, height: 1 },
        '4:5': { width: 4, height: 5 },
        '9:16': { width: 9, height: 16 },
        '16:9': { width: 16, height: 9 },
    };
    const DEFAULT_SETTINGS = {
        backgroundColor: '#ffffff',
        padding: 0,
        aspectRatio: '1:1',
        alignment: 'middle-center',
        watermarkOpacity: 0.7,
        watermarkSize: 18,
        watermarkMargin: 48,
        watermarkPosition: 'bottom-right',
        prefix: '',
        suffix: '-1x1',
        sort: 'added',
    };

    const state = {
        items: [],
        fileKeys: new Set(),
        nextId: 1,
        manualDownloadUrl: '',
        noticeText: '',
        rerenderTimer: null,
        previewGeneration: 0,
        watermark: {
            file: null,
            image: null,
            width: 0,
            height: 0,
            previewUrl: '',
        },
    };

    const elements = {
        dropZone: document.getElementById('dropZone'),
        fileInput: document.getElementById('fileInput'),
        chooseFilesButton: document.getElementById('chooseFilesButton'),
        clearAllButton: document.getElementById('clearAllButton'),
        downloadAllButton: document.getElementById('downloadAllButton'),
        downloadImagesButton: document.getElementById('downloadImagesButton'),
        gallery: document.getElementById('gallery'),
        template: document.getElementById('imageCardTemplate'),
        formatSelect: document.getElementById('formatSelect'),
        qualityInput: document.getElementById('qualityInput'),
        qualityOutput: document.getElementById('qualityOutput'),
        summaryText: document.getElementById('summaryText'),
        detailText: document.getElementById('detailText'),
        manualDownloadLink: document.getElementById('manualDownloadLink'),
        backgroundColorInput: document.getElementById('backgroundColorInput'),
        backgroundColorHexInput: document.getElementById('backgroundColorHexInput'),
        paddingInput: document.getElementById('paddingInput'),
        paddingOutput: document.getElementById('paddingOutput'),
        filePrefixInput: document.getElementById('filePrefixInput'),
        fileSuffixInput: document.getElementById('fileSuffixInput'),
        sortSelect: document.getElementById('sortSelect'),
        resetSettingsButton: document.getElementById('resetSettingsButton'),
        watermarkFileInput: document.getElementById('watermarkFileInput'),
        chooseWatermarkButton: document.getElementById('chooseWatermarkButton'),
        removeWatermarkButton: document.getElementById('removeWatermarkButton'),
        watermarkStatus: document.getElementById('watermarkStatus'),
        watermarkPreviewImage: document.getElementById('watermarkPreviewImage'),
        watermarkOpacityInput: document.getElementById('watermarkOpacityInput'),
        watermarkOpacityOutput: document.getElementById('watermarkOpacityOutput'),
        watermarkSizeInput: document.getElementById('watermarkSizeInput'),
        watermarkSizeOutput: document.getElementById('watermarkSizeOutput'),
        watermarkMarginInput: document.getElementById('watermarkMarginInput'),
        watermarkMarginOutput: document.getElementById('watermarkMarginOutput'),
        aspectInputs: Array.from(document.querySelectorAll('input[name="aspectRatio"]')),
        alignmentInputs: Array.from(document.querySelectorAll('input[name="alignment"]')),
        watermarkPositionInputs: Array.from(document.querySelectorAll('input[name="watermarkPosition"]')),
        colorSwatches: Array.from(document.querySelectorAll('.color-swatch')),
    };

    const crcTable = buildCrcTable();

    elements.chooseFilesButton.addEventListener('click', () => elements.fileInput.click());
    elements.fileInput.addEventListener('change', async () => {
        await addFiles(elements.fileInput.files);
        elements.fileInput.value = '';
    });
    elements.clearAllButton.addEventListener('click', clearAll);
    elements.downloadAllButton.addEventListener('click', downloadAll);
    elements.downloadImagesButton.addEventListener('click', downloadAllImages);
    elements.formatSelect.addEventListener('change', () => {
        updateQualityState();
        refreshFileNames();
    });
    elements.qualityInput.addEventListener('input', () => {
        elements.qualityOutput.textContent = `${Math.round(Number(elements.qualityInput.value) * 100)}%`;
    });
    elements.backgroundColorInput.addEventListener('input', () => {
        setBackgroundColor(elements.backgroundColorInput.value);
        scheduleRerender();
    });
    elements.backgroundColorHexInput.addEventListener('input', () => {
        const color = normalizeHexColor(elements.backgroundColorHexInput.value);
        elements.backgroundColorHexInput.classList.toggle('is-invalid', color === null);
        if (color !== null) {
            setBackgroundColor(color);
            scheduleRerender();
        }
    });
    elements.backgroundColorHexInput.addEventListener('change', () => {
        const color = normalizeHexColor(elements.backgroundColorHexInput.value);
        setBackgroundColor(color || getBackgroundColor());
        if (state.items.length > 0) {
            rerenderAll();
        }
    });
    elements.paddingInput.addEventListener('input', () => {
        elements.paddingOutput.textContent = `${getPadding()} px`;
        scheduleRerender();
    });
    elements.aspectInputs.forEach((input) => input.addEventListener('change', rerenderAll));
    elements.alignmentInputs.forEach((input) => input.addEventListener('change', rerenderAll));
    elements.colorSwatches.forEach((button) => {
        button.addEventListener('click', () => {
            setBackgroundColor(button.dataset.color);
            rerenderAll();
        });
    });
    if (elements.chooseWatermarkButton) {
        elements.chooseWatermarkButton.addEventListener('click', () => elements.watermarkFileInput.click());
        elements.watermarkFileInput.addEventListener('change', async () => {
            await setWatermarkFile(elements.watermarkFileInput.files[0] || null);
            elements.watermarkFileInput.value = '';
        });
        elements.removeWatermarkButton.addEventListener('click', removeWatermark);
        elements.watermarkOpacityInput.addEventListener('input', () => {
            updateWatermarkOutputs();
            scheduleRerender();
        });
        elements.watermarkSizeInput.addEventListener('input', () => {
            updateWatermarkOutputs();
            scheduleRerender();
        });
        elements.watermarkMarginInput.addEventListener('input', () => {
            updateWatermarkOutputs();
            scheduleRerender();
        });
        elements.watermarkPositionInputs.forEach((input) => input.addEventListener('change', rerenderAll));
    }
    elements.filePrefixInput.addEventListener('input', refreshFileNames);
    elements.fileSuffixInput.addEventListener('input', refreshFileNames);
    elements.sortSelect.addEventListener('change', sortItems);
    elements.resetSettingsButton.addEventListener('click', resetSettings);

    ['dragenter', 'dragover'].forEach((eventName) => {
        elements.dropZone.addEventListener(eventName, (event) => {
            event.preventDefault();
            event.stopPropagation();
            elements.dropZone.classList.add('is-dragging');
        });
    });

    ['dragleave', 'drop'].forEach((eventName) => {
        elements.dropZone.addEventListener(eventName, (event) => {
            event.preventDefault();
            event.stopPropagation();
            elements.dropZone.classList.remove('is-dragging');
        });
    });

    elements.dropZone.addEventListener('drop', async (event) => {
        await addFiles(event.dataTransfer.files);
    });

    async function addFiles(fileList) {
        hideManualDownload();

        const files = Array.from(fileList || []);
        const validFiles = files.filter(validateImageFile);

        if (validFiles.length === 0) {
            updateStatus();
            return;
        }

        setBusy(true);

        try {
            const newFiles = await filterNewImageFiles(validFiles);

            if (newFiles.length === 0) {
                return;
            }

            const decodedImages = await mapWithConcurrency(
                newFiles,
                IMAGE_DECODE_CONCURRENCY,
                decodeImageFile
            );

            for (const decoded of decodedImages) {
                if (decoded) {
                    addImage(decoded.file, decoded.fileKey, decoded.image, decoded.width, decoded.height);
                }
            }
        } finally {
            sortItems();
            setBusy(false);
            updateStatus();
        }
    }

    function validateImageFile(file) {
        if (!ACCEPTED_TYPES.has(file.type)) {
            alert(`ไฟล์ "${file.name}" ไม่ใช่ PNG, JPG หรือ WEBP`);
            return false;
        }

        if (file.size > MAX_FILE_SIZE_BYTES) {
            alert(`ไฟล์ "${file.name}" ใหญ่เกิน 40MB`);
            return false;
        }

        return true;
    }

    async function filterNewImageFiles(files) {
        const newFiles = [];
        const batchKeys = new Set();
        const duplicateNames = [];

        for (const file of files) {
            const fileKey = await createFileKey(file);
            if (state.fileKeys.has(fileKey) || batchKeys.has(fileKey)) {
                duplicateNames.push(file.name);
                continue;
            }

            batchKeys.add(fileKey);
            newFiles.push({ file, fileKey });
        }

        if (duplicateNames.length > 0) {
            showDuplicateWarning(duplicateNames);
        }

        return newFiles;
    }

    async function createFileKey(file) {
        if (window.crypto && window.crypto.subtle && typeof file.arrayBuffer === 'function') {
            try {
                const buffer = await file.arrayBuffer();
                const digest = await window.crypto.subtle.digest('SHA-256', buffer);
                return `sha256:${bytesToHex(new Uint8Array(digest))}:${file.size}`;
            } catch (error) {
                console.warn('Cannot hash file; falling back to metadata key.', error);
            }
        }

        return [
            'meta',
            normalizeFileKeyPart(file.name),
            String(file.size),
            String(file.lastModified || 0),
            normalizeFileKeyPart(file.type),
        ].join(':');
    }

    function bytesToHex(bytes) {
        return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
    }

    function normalizeFileKeyPart(value) {
        return String(value || '').trim().toLowerCase();
    }

    function showDuplicateWarning(fileNames) {
        const uniqueNames = Array.from(new Set(fileNames));
        const visibleNames = uniqueNames.slice(0, 5).map((name) => `"${name}"`).join(', ');
        const hiddenCount = Math.max(0, uniqueNames.length - 5);
        const suffix = hiddenCount > 0 ? ` และอีก ${hiddenCount} ไฟล์` : '';
        const title = `ข้ามไฟล์ซ้ำ ${fileNames.length} ไฟล์`;
        const message = `${visibleNames}${suffix}`;
        const notice = `${title}: ${message}`;

        state.noticeText = notice;

        if (window.Swal && typeof window.Swal.fire === 'function') {
            window.Swal.fire({
                toast: true,
                position: 'top-end',
                icon: 'warning',
                title,
                text: message,
                showConfirmButton: false,
                timer: 3800,
                timerProgressBar: true,
                customClass: {
                    popup: 'duplicate-file-toast',
                    title: 'duplicate-file-toast-title',
                    htmlContainer: 'duplicate-file-toast-text',
                    timerProgressBar: 'duplicate-file-toast-progress',
                },
                didOpen: (toast) => {
                    toast.addEventListener('mouseenter', window.Swal.stopTimer);
                    toast.addEventListener('mouseleave', window.Swal.resumeTimer);
                },
            });
            return;
        }

        alert(notice);
    }

    async function decodeImageFile(fileEntry) {
        const file = fileEntry.file;
        try {
            const sourceImage = await loadImage(file);
            const width = sourceImage.naturalWidth || sourceImage.width;
            const height = sourceImage.naturalHeight || sourceImage.height;
            const previewImage = await createPreviewImage(sourceImage, width, height);

            if (previewImage !== sourceImage) {
                releaseImage(sourceImage);
            }

            return {
                file,
                fileKey: fileEntry.fileKey,
                image: previewImage,
                width,
                height,
            };
        } catch (error) {
            console.error(error);
            alert(`ไม่สามารถอ่านไฟล์ "${file.name}" ได้`);
            return null;
        }
    }

    async function mapWithConcurrency(items, concurrency, worker) {
        const results = new Array(items.length);
        let nextIndex = 0;

        async function runWorker() {
            while (nextIndex < items.length) {
                const index = nextIndex;
                nextIndex += 1;
                results[index] = await worker(items[index], index);
            }
        }

        const workerCount = Math.min(concurrency, items.length);
        await Promise.all(Array.from({ length: workerCount }, runWorker));
        return results;
    }

    function addImage(file, fileKey, image, width, height) {
        const item = {
            id: state.nextId,
            file,
            fileKey,
            image,
            width,
            height,
            outputSize: Math.max(width, height),
            outputWidth: Math.max(width, height),
            outputHeight: Math.max(width, height),
            rotation: 0,
            element: null,
            canvas: null,
            outputSizeElement: null,
            lastFileName: '',
        };
        state.nextId += 1;
        state.fileKeys.add(fileKey);
        state.items.push(item);
        renderCard(item);
        renderPreview(item);
    }

    async function loadImage(file) {
        if (typeof window.createImageBitmap === 'function') {
            try {
                return await window.createImageBitmap(file, { imageOrientation: 'from-image' });
            } catch (error) {
                console.warn('ImageBitmap decode failed; using image element fallback.', error);
            }
        }

        return new Promise((resolve, reject) => {
            const url = URL.createObjectURL(file);
            const image = new Image();

            image.onload = () => {
                URL.revokeObjectURL(url);
                resolve(image);
            };
            image.onerror = () => {
                URL.revokeObjectURL(url);
                reject(new Error(`Cannot read image: ${file.name}`));
            };
            image.src = url;
        });
    }

    async function setWatermarkFile(file) {
        if (!file) {
            return;
        }

        if (!validateImageFile(file)) {
            updateWatermarkUi();
            return;
        }

        try {
            const image = await loadImage(file);
            const width = image.naturalWidth || image.width;
            const height = image.naturalHeight || image.height;

            releaseWatermark();
            state.watermark.file = file;
            state.watermark.image = image;
            state.watermark.width = width;
            state.watermark.height = height;
            state.watermark.previewUrl = URL.createObjectURL(file);
            updateWatermarkUi();
            await rerenderAll();
        } catch (error) {
            console.error(error);
            alert(`ไม่สามารถอ่านไฟล์ลายน้ำ "${file.name}" ได้`);
        }
    }

    async function removeWatermark() {
        releaseWatermark();
        updateWatermarkUi();
        await rerenderAll();
    }

    function releaseWatermark() {
        releaseImage(state.watermark.image);
        if (state.watermark.previewUrl) {
            URL.revokeObjectURL(state.watermark.previewUrl);
        }

        state.watermark.file = null;
        state.watermark.image = null;
        state.watermark.width = 0;
        state.watermark.height = 0;
        state.watermark.previewUrl = '';
    }

    function updateWatermarkUi() {
        if (!elements.watermarkStatus) {
            return;
        }

        const hasWatermark = Boolean(state.watermark.image);
        elements.watermarkStatus.textContent = hasWatermark
            ? `${state.watermark.file.name} · ${state.watermark.width} x ${state.watermark.height}px`
            : 'ยังไม่ได้เลือกลายน้ำ';
        elements.removeWatermarkButton.hidden = !hasWatermark;
        elements.watermarkPreviewImage.hidden = !hasWatermark;

        if (hasWatermark) {
            elements.watermarkPreviewImage.src = state.watermark.previewUrl;
        } else {
            elements.watermarkPreviewImage.removeAttribute('src');
        }
    }

    async function createPreviewImage(sourceImage, width, height) {
        const scale = Math.min(1, PREVIEW_MAX_SIZE / Math.max(width, height));
        if (scale === 1) {
            return sourceImage;
        }

        const previewWidth = Math.max(1, Math.round(width * scale));
        const previewHeight = Math.max(1, Math.round(height * scale));

        if (typeof window.createImageBitmap === 'function') {
            try {
                return await window.createImageBitmap(sourceImage, {
                    resizeWidth: previewWidth,
                    resizeHeight: previewHeight,
                    resizeQuality: 'high',
                });
            } catch (error) {
                console.warn('Preview bitmap resize failed; using canvas fallback.', error);
            }
        }

        const canvas = document.createElement('canvas');
        canvas.width = previewWidth;
        canvas.height = previewHeight;
        const context = canvas.getContext('2d', { alpha: false });
        context.imageSmoothingEnabled = true;
        context.imageSmoothingQuality = 'high';
        context.drawImage(sourceImage, 0, 0, previewWidth, previewHeight);
        return canvas;
    }

    function renderCard(item) {
        const fragment = elements.template.content.cloneNode(true);
        const card = fragment.querySelector('.image-card');
        const canvas = fragment.querySelector('.preview-canvas');
        const name = fragment.querySelector('.image-name');
        const originalSize = fragment.querySelector('.original-size');
        const outputSize = fragment.querySelector('.output-size');
        const downloadButton = fragment.querySelector('.download-one');
        const removeButton = fragment.querySelector('.remove-one');
        const rotateLeftButton = fragment.querySelector('.rotate-left');
        const rotateRightButton = fragment.querySelector('.rotate-right');

        name.textContent = item.file.name;
        name.title = item.file.name;
        originalSize.textContent = `${item.width} x ${item.height}px`;
        outputSize.textContent = `${item.outputWidth} x ${item.outputHeight}px`;
        downloadButton.addEventListener('click', () => downloadOne(item));
        removeButton.addEventListener('click', () => removeItem(item.id));
        rotateLeftButton.addEventListener('click', () => rotateItem(item, -90));
        rotateRightButton.addEventListener('click', () => rotateItem(item, 90));

        item.element = card;
        item.canvas = canvas;
        item.outputSizeElement = outputSize;
        elements.gallery.appendChild(fragment);
    }

    function renderPreview(item) {
        const canvas = item.canvas;
        const padding = getPadding();
        const dimensions = getRotatedDimensions(item);
        const outputDimensions = calculateOutputDimensions(dimensions.width, dimensions.height, padding);
        const position = calculateImagePosition(
            outputDimensions.width,
            outputDimensions.height,
            dimensions.width,
            dimensions.height,
            padding
        );
        const longestSide = Math.max(outputDimensions.width, outputDimensions.height);
        const scale = Math.min(1, PREVIEW_MAX_SIZE / longestSide);
        const previewWidth = Math.max(1, Math.round(outputDimensions.width * scale));
        const previewHeight = Math.max(1, Math.round(outputDimensions.height * scale));
        const context = canvas.getContext('2d', { alpha: false });

        item.outputWidth = outputDimensions.width;
        item.outputHeight = outputDimensions.height;
        item.outputSize = Math.max(outputDimensions.width, outputDimensions.height);
        canvas.width = previewWidth;
        canvas.height = previewHeight;
        context.setTransform(scale, 0, 0, scale, 0, 0);
        context.imageSmoothingEnabled = scale < 1;
        context.imageSmoothingQuality = 'high';
        context.fillStyle = getBackgroundColor();
        context.fillRect(0, 0, outputDimensions.width, outputDimensions.height);
        drawRotatedImage(context, item, position.x, position.y, dimensions);
        drawWatermark(context, outputDimensions.width, outputDimensions.height);

        item.lastFileName = buildOutputName(item.file.name, getOutputType());
        item.outputSizeElement.textContent = `${outputDimensions.width} x ${outputDimensions.height}px`;
    }

    async function createExportBlob(item) {
        const padding = getPadding();
        const dimensions = getRotatedDimensions(item);
        const outputDimensions = calculateOutputDimensions(dimensions.width, dimensions.height, padding);
        const position = calculateImagePosition(
            outputDimensions.width,
            outputDimensions.height,
            dimensions.width,
            dimensions.height,
            padding
        );
        const canvas = createExportCanvas(outputDimensions.width, outputDimensions.height);
        const context = canvas.getContext('2d', { alpha: false });
        const sourceImage = await loadImage(item.file);

        try {
            context.imageSmoothingEnabled = false;
            context.fillStyle = getBackgroundColor();
            context.fillRect(0, 0, outputDimensions.width, outputDimensions.height);
            drawRotatedImage(context, item, position.x, position.y, dimensions, sourceImage);
            drawWatermark(context, outputDimensions.width, outputDimensions.height);
            return await canvasToBlob(canvas, getOutputType(), getOutputQuality());
        } finally {
            releaseImage(sourceImage);
            releaseCanvas(canvas);
        }
    }

    function createExportCanvas(width, height) {
        if (typeof window.OffscreenCanvas === 'function') {
            return new OffscreenCanvas(width, height);
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        return canvas;
    }

    function releaseCanvas(canvas) {
        if (canvas instanceof HTMLCanvasElement) {
            canvas.width = 1;
            canvas.height = 1;
        }
    }

    function getRotatedDimensions(item) {
        const quarterTurn = Math.abs(item.rotation % 180) === 90;
        return {
            width: quarterTurn ? item.height : item.width,
            height: quarterTurn ? item.width : item.height,
        };
    }

    function calculateOutputDimensions(imageWidth, imageHeight, padding) {
        const aspectRatio = ASPECT_RATIOS[getAspectRatio()] || ASPECT_RATIOS[DEFAULT_SETTINGS.aspectRatio];
        const minimumWidth = imageWidth + (padding * 2);
        const minimumHeight = imageHeight + (padding * 2);
        const ratio = aspectRatio.width / aspectRatio.height;
        let outputWidth = minimumWidth;
        let outputHeight = Math.round(outputWidth / ratio);

        if (outputHeight < minimumHeight) {
            outputHeight = minimumHeight;
            outputWidth = Math.round(outputHeight * ratio);
        }

        return {
            width: Math.max(1, outputWidth),
            height: Math.max(1, outputHeight),
        };
    }

    function calculateImagePosition(canvasWidth, canvasHeight, width, height, padding) {
        const alignment = getAlignment().split('-');
        const verticalFactor = alignment[0] === 'top' ? 0 : (alignment[0] === 'bottom' ? 1 : 0.5);
        const horizontalFactor = alignment[1] === 'left' ? 0 : (alignment[1] === 'right' ? 1 : 0.5);
        const availableWidth = Math.max(0, canvasWidth - (padding * 2) - width);
        const availableHeight = Math.max(0, canvasHeight - (padding * 2) - height);

        return {
            x: padding + Math.round(availableWidth * horizontalFactor),
            y: padding + Math.round(availableHeight * verticalFactor),
        };
    }

    function drawRotatedImage(context, item, x, y, dimensions, sourceImage = item.image) {
        context.save();
        context.translate(x, y);

        if (item.rotation === 90) {
            context.translate(dimensions.width, 0);
            context.rotate(Math.PI / 2);
        } else if (item.rotation === 180) {
            context.translate(dimensions.width, dimensions.height);
            context.rotate(Math.PI);
        } else if (item.rotation === 270) {
            context.translate(0, dimensions.height);
            context.rotate(-Math.PI / 2);
        }

        context.drawImage(sourceImage, 0, 0, item.width, item.height);
        context.restore();
    }

    function drawWatermark(context, canvasWidth, canvasHeight) {
        const watermark = state.watermark;
        if (!watermark.image || watermark.width <= 0 || watermark.height <= 0) {
            return;
        }

        const shortestSide = Math.min(canvasWidth, canvasHeight);
        const maxTargetWidth = Math.max(1, Math.round(shortestSide * (getWatermarkSize() / 100)));
        const aspectRatio = watermark.height / watermark.width;
        let targetWidth = maxTargetWidth;
        let targetHeight = Math.max(1, Math.round(targetWidth * aspectRatio));

        if (targetHeight > canvasHeight) {
            targetHeight = canvasHeight;
            targetWidth = Math.max(1, Math.round(targetHeight / aspectRatio));
        }

        const marginLimit = Math.max(0, Math.floor((shortestSide - Math.max(targetWidth, targetHeight)) / 2));
        const margin = Math.min(getWatermarkMargin(), marginLimit);
        const position = calculateWatermarkPosition(canvasWidth, canvasHeight, targetWidth, targetHeight, margin);

        context.save();
        context.globalAlpha = getWatermarkOpacity();
        context.imageSmoothingEnabled = true;
        context.imageSmoothingQuality = 'high';
        context.drawImage(watermark.image, position.x, position.y, targetWidth, targetHeight);
        context.restore();
    }

    function calculateWatermarkPosition(canvasWidth, canvasHeight, width, height, margin) {
        const alignment = getWatermarkPosition().split('-');
        const verticalFactor = alignment[0] === 'top' ? 0 : (alignment[0] === 'bottom' ? 1 : 0.5);
        const horizontalFactor = alignment[1] === 'left' ? 0 : (alignment[1] === 'right' ? 1 : 0.5);
        const availableWidth = Math.max(0, canvasWidth - (margin * 2) - width);
        const availableHeight = Math.max(0, canvasHeight - (margin * 2) - height);

        return {
            x: margin + Math.round(availableWidth * horizontalFactor),
            y: margin + Math.round(availableHeight * verticalFactor),
        };
    }

    async function rerenderAll() {
        if (state.items.length === 0) {
            return;
        }

        hideManualDownload();
        const generation = state.previewGeneration + 1;
        state.previewGeneration = generation;

        for (let index = 0; index < state.items.length; index += 1) {
            if (generation !== state.previewGeneration) {
                return;
            }

            renderPreview(state.items[index]);
            if ((index + 1) % PREVIEW_BATCH_SIZE === 0) {
                await nextAnimationFrame();
            }
        }

        updateStatus();
    }

    function scheduleRerender() {
        window.clearTimeout(state.rerenderTimer);
        state.rerenderTimer = window.setTimeout(rerenderAll, 120);
    }

    function nextAnimationFrame() {
        return new Promise((resolve) => window.requestAnimationFrame(resolve));
    }

    async function rotateItem(item, amount) {
        item.rotation = (item.rotation + amount + 360) % 360;
        hideManualDownload();
        try {
            renderPreview(item);
        } catch (error) {
            handleDownloadError(error);
        }
        updateStatus();
    }

    function canvasToBlob(canvas, type, quality) {
        if (typeof canvas.convertToBlob === 'function') {
            return canvas.convertToBlob({ type, quality });
        }

        return new Promise((resolve, reject) => {
            canvas.toBlob((blob) => {
                if (!blob) {
                    reject(new Error('Cannot export image'));
                    return;
                }
                resolve(blob);
            }, type, quality);
        });
    }

    function getOutputType() {
        return elements.formatSelect.value;
    }

    function getOutputQuality() {
        return Number(elements.qualityInput.value);
    }

    function getBackgroundColor() {
        return elements.backgroundColorInput.value || DEFAULT_SETTINGS.backgroundColor;
    }

    function getAspectRatio() {
        const selected = elements.aspectInputs.find((input) => input.checked);
        return selected && ASPECT_RATIOS[selected.value] ? selected.value : DEFAULT_SETTINGS.aspectRatio;
    }

    function normalizeHexColor(value) {
        const normalized = String(value || '').trim();
        const shortMatch = normalized.match(/^#?([\da-f]{3})$/i);
        if (shortMatch) {
            return `#${shortMatch[1].split('').map((character) => character.repeat(2)).join('')}`.toLowerCase();
        }

        const fullMatch = normalized.match(/^#?([\da-f]{6})$/i);
        return fullMatch ? `#${fullMatch[1]}`.toLowerCase() : null;
    }

    function setBackgroundColor(color) {
        const normalized = normalizeHexColor(color) || DEFAULT_SETTINGS.backgroundColor;
        elements.backgroundColorInput.value = normalized;
        elements.backgroundColorHexInput.value = normalized.toUpperCase();
        elements.backgroundColorHexInput.classList.remove('is-invalid');
        updateSelectedSwatch();
    }

    function getPadding() {
        const padding = Number.parseInt(elements.paddingInput.value, 10);
        return Number.isFinite(padding) ? Math.max(0, Math.min(500, padding)) : 0;
    }

    function getWatermarkOpacity() {
        return getBoundedNumber(elements.watermarkOpacityInput, DEFAULT_SETTINGS.watermarkOpacity, 0.1, 1);
    }

    function getWatermarkSize() {
        return getBoundedNumber(elements.watermarkSizeInput, DEFAULT_SETTINGS.watermarkSize, 5, 45);
    }

    function getWatermarkMargin() {
        return Math.round(getBoundedNumber(elements.watermarkMarginInput, DEFAULT_SETTINGS.watermarkMargin, 0, 300));
    }

    function getWatermarkPosition() {
        const selected = elements.watermarkPositionInputs.find((input) => input.checked);
        return selected ? selected.value : DEFAULT_SETTINGS.watermarkPosition;
    }

    function getBoundedNumber(input, fallback, min, max) {
        if (!input) {
            return fallback;
        }

        const value = Number(input.value);
        if (!Number.isFinite(value)) {
            return fallback;
        }

        return Math.max(min, Math.min(max, value));
    }

    function getAlignment() {
        const selected = elements.alignmentInputs.find((input) => input.checked);
        return selected ? selected.value : DEFAULT_SETTINGS.alignment;
    }

    function buildOutputName(originalName, mimeType) {
        const baseName = originalName.replace(/\.[^.]+$/, '') || 'image';
        const safeBaseName = sanitizeFileNamePart(baseName) || 'image';
        const prefix = sanitizeFileNamePart(elements.filePrefixInput.value);
        const suffix = sanitizeFileNamePart(elements.fileSuffixInput.value);
        const safeName = `${prefix}${safeBaseName}${suffix}`
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '')
            .slice(0, 120) || 'image';

        return `${safeName}.${EXTENSIONS[mimeType]}`;
    }

    function sanitizeFileNamePart(value) {
        return value
            .normalize('NFKD')
            .replace(/[^\p{L}\p{N}._-]+/gu, '-')
            .replace(/-+/g, '-')
            .replace(/^\.+|\.+$/g, '')
            .slice(0, 60);
    }

    async function downloadOne(item) {
        try {
            const outputType = getOutputType();
            const fileName = buildOutputName(item.file.name, outputType);
            const saveHandle = await requestSaveHandle(fileName, outputType, EXTENSIONS[outputType]);

            if (saveHandle === false) {
                return;
            }

            const blob = await createExportBlob(item);
            await saveBlob(blob, fileName, saveHandle, false);
        } catch (error) {
            handleDownloadError(error);
        }
    }

    async function downloadAll() {
        if (state.items.length === 0) {
            return;
        }

        const zipFileName = `square-white-frame-${timestamp()}.zip`;
        const saveHandle = await requestSaveHandle(zipFileName, 'application/zip', 'zip');

        if (saveHandle === false) {
            return;
        }

        hideManualDownload();
        setBusy(true);
        try {
            const nameCounts = new Map();
            let completedExports = 0;
            const exportedItems = await mapWithConcurrency(
                state.items,
                IMAGE_EXPORT_CONCURRENCY,
                async (item) => {
                    const blob = await createExportBlob(item);
                    completedExports += 1;
                    elements.summaryText.textContent = `กำลังส่งออก ${completedExports}/${state.items.length} รูป`;
                    return { item, blob };
                }
            );
            const files = [];

            for (const exported of exportedItems) {
                const item = exported.item;
                const currentFileName = buildOutputName(item.file.name, getOutputType());
                const uniqueName = uniqueFileName(currentFileName, nameCounts);
                files.push({
                    name: uniqueName,
                    data: new Uint8Array(await exported.blob.arrayBuffer()),
                });
            }

            const zipBlob = createZip(files);
            await saveBlob(zipBlob, zipFileName, saveHandle, true);
        } catch (error) {
            handleDownloadError(error);
        } finally {
            setBusy(false);
            updateStatus();
        }
    }

    async function downloadAllImages() {
        if (state.items.length === 0) {
            return;
        }

        const directoryHandle = await requestDirectoryHandle();
        if (directoryHandle === false) {
            return;
        }

        hideManualDownload();
        setBusy(true);

        try {
            const exportedFiles = await exportImageFiles((completedExports) => {
                elements.summaryText.textContent = `กำลังส่งออกรูปแยก ${completedExports}/${state.items.length} รูป`;
            });

            if (directoryHandle) {
                for (const file of exportedFiles) {
                    await saveBlobToDirectory(directoryHandle, file.name, file.blob);
                }

                state.noticeText = `บันทึกรูปแยก ${exportedFiles.length} ไฟล์ลงโฟลเดอร์ที่เลือกแล้ว`;
                elements.detailText.textContent = state.noticeText;
                return;
            }

            for (const file of exportedFiles) {
                triggerDownload(file.blob, file.name, false);
                await wait(120);
            }

            state.noticeText = `เริ่มดาวน์โหลดรูปแยก ${exportedFiles.length} ไฟล์แล้ว`;
            elements.detailText.textContent = state.noticeText;
        } catch (error) {
            handleDownloadError(error);
        } finally {
            setBusy(false);
            updateStatus();
        }
    }

    async function exportImageFiles(onProgress) {
        const nameCounts = new Map();
        let completedExports = 0;
        const exportedItems = await mapWithConcurrency(
            state.items,
            IMAGE_EXPORT_CONCURRENCY,
            async (item) => {
                const blob = await createExportBlob(item);
                completedExports += 1;
                if (typeof onProgress === 'function') {
                    onProgress(completedExports);
                }
                return { item, blob };
            }
        );

        return exportedItems.map((exported) => {
            const currentFileName = buildOutputName(exported.item.file.name, getOutputType());
            return {
                name: uniqueFileName(currentFileName, nameCounts),
                blob: exported.blob,
            };
        });
    }

    function uniqueFileName(fileName, counts) {
        const count = counts.get(fileName) || 0;
        counts.set(fileName, count + 1);

        if (count === 0) {
            return fileName;
        }

        return fileName.replace(/(\.[^.]+)$/, `-${count + 1}$1`);
    }

    async function requestSaveHandle(fileName, mimeType, extension) {
        if (typeof window.showSaveFilePicker !== 'function') {
            return null;
        }

        try {
            return await window.showSaveFilePicker({
                suggestedName: fileName,
                types: [
                    {
                        description: extension.toUpperCase(),
                        accept: {
                            [mimeType]: [`.${extension}`],
                        },
                    },
                ],
            });
        } catch (error) {
            if (error && error.name === 'AbortError') {
                return false;
            }

            throw error;
        }
    }

    async function requestDirectoryHandle() {
        if (typeof window.showDirectoryPicker !== 'function') {
            return null;
        }

        try {
            return await window.showDirectoryPicker({
                id: 'square-frame-exports',
                mode: 'readwrite',
                startIn: 'downloads',
            });
        } catch (error) {
            if (error && error.name === 'AbortError') {
                return false;
            }

            throw error;
        }
    }

    async function saveBlobToDirectory(directoryHandle, fileName, blob) {
        const fileHandle = await directoryHandle.getFileHandle(fileName, { create: true });
        const writable = await fileHandle.createWritable();
        await writable.write(blob);
        await writable.close();
    }

    async function saveBlob(blob, fileName, saveHandle, keepManualLink) {
        if (saveHandle) {
            const writable = await saveHandle.createWritable();
            await writable.write(blob);
            await writable.close();
            state.noticeText = `บันทึกไฟล์ ${fileName} ลงเครื่องแล้ว`;
            elements.detailText.textContent = state.noticeText;
            return;
        }

        if (keepManualLink) {
            const serverSaved = await saveBlobToLocalServer(blob, fileName);
            if (serverSaved) {
                return;
            }
        }

        triggerDownload(blob, fileName, keepManualLink);
    }

    async function saveBlobToLocalServer(blob, fileName) {
        if (!isLocalHost()) {
            return false;
        }

        try {
            const headers = {
                'Content-Type': 'application/zip',
                'X-File-Name': encodeURIComponent(fileName),
            };
            const csrfToken = getCsrfToken();
            if (csrfToken) {
                headers['X-CSRF-Token'] = csrfToken;
            }

            const response = await fetch('api/save-export.php', {
                method: 'POST',
                headers,
                body: blob,
                credentials: 'same-origin',
            });

            if (!response.ok) {
                return false;
            }

            const payload = await response.json();
            if (!payload || payload.ok !== true || !payload.url) {
                return false;
            }

            showServerSaved(payload.url, payload.file_path || '', fileName);
            return true;
        } catch (error) {
            console.warn(error);
            return false;
        }
    }

    function isLocalHost() {
        return ['127.0.0.1', 'localhost', '::1'].includes(window.location.hostname);
    }

    function getCsrfToken() {
        return document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '';
    }

    function triggerDownload(blob, fileName, keepManualLink) {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        link.remove();

        if (keepManualLink) {
            showManualDownload(url, fileName);
            return;
        }

        window.setTimeout(() => URL.revokeObjectURL(url), 30000);
    }

    function wait(milliseconds) {
        return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
    }

    function showManualDownload(url, fileName) {
        if (state.manualDownloadUrl) {
            URL.revokeObjectURL(state.manualDownloadUrl);
        }

        state.manualDownloadUrl = url;
        state.noticeText = 'ถ้าไฟล์ยังไม่เริ่มดาวน์โหลด ให้กดปุ่มบันทึก ZIP ด้านขวา';
        elements.manualDownloadLink.href = url;
        elements.manualDownloadLink.download = fileName;
        elements.manualDownloadLink.textContent = `กดบันทึก ZIP: ${fileName}`;
        elements.manualDownloadLink.hidden = false;
        elements.detailText.textContent = state.noticeText;
    }

    function showServerSaved(url, filePath, fileName) {
        state.noticeText = filePath
            ? `บันทึก ZIP ลงเครื่องแล้ว: ${filePath}`
            : `บันทึก ZIP แล้ว: ${fileName}`;
        elements.manualDownloadLink.href = url;
        elements.manualDownloadLink.download = fileName;
        elements.manualDownloadLink.textContent = 'เปิดไฟล์ ZIP ที่บันทึกไว้';
        elements.manualDownloadLink.hidden = false;
        elements.detailText.textContent = state.noticeText;
    }

    function hideManualDownload() {
        if (state.manualDownloadUrl) {
            URL.revokeObjectURL(state.manualDownloadUrl);
            state.manualDownloadUrl = '';
        }

        state.noticeText = '';
        elements.manualDownloadLink.hidden = true;
        elements.manualDownloadLink.removeAttribute('href');
    }

    function refreshFileNames() {
        hideManualDownload();
        state.items.forEach((item) => {
            item.lastFileName = buildOutputName(item.file.name, getOutputType());
        });
        updateStatus();
    }

    function updateSelectedSwatch() {
        const color = getBackgroundColor().toLowerCase();
        elements.colorSwatches.forEach((button) => {
            button.classList.toggle('is-selected', button.dataset.color.toLowerCase() === color);
        });
    }

    function updateWatermarkOutputs() {
        if (!elements.watermarkOpacityOutput) {
            return;
        }

        elements.watermarkOpacityOutput.textContent = `${Math.round(getWatermarkOpacity() * 100)}%`;
        elements.watermarkSizeOutput.textContent = `${Math.round(getWatermarkSize())}%`;
        elements.watermarkMarginOutput.textContent = `${getWatermarkMargin()} px`;
    }

    function updateQualityState() {
        const isLosslessPng = getOutputType() === 'image/png';
        elements.qualityInput.disabled = isLosslessPng;
        elements.qualityInput.closest('.control').classList.toggle('is-disabled', isLosslessPng);
    }

    function sortItems() {
        const sortMode = elements.sortSelect.value;
        const comparators = {
            added: (a, b) => a.id - b.id,
            'name-asc': (a, b) => a.file.name.localeCompare(b.file.name, 'th'),
            'name-desc': (a, b) => b.file.name.localeCompare(a.file.name, 'th'),
            'size-desc': (a, b) => (b.width * b.height) - (a.width * a.height),
            'size-asc': (a, b) => (a.width * a.height) - (b.width * b.height),
        };

        state.items.sort(comparators[sortMode] || comparators.added);
        state.items.forEach((item) => elements.gallery.appendChild(item.element));
    }

    async function resetSettings() {
        setBackgroundColor(DEFAULT_SETTINGS.backgroundColor);
        elements.paddingInput.value = String(DEFAULT_SETTINGS.padding);
        elements.paddingOutput.textContent = `${DEFAULT_SETTINGS.padding} px`;
        elements.aspectInputs.forEach((input) => {
            input.checked = input.value === DEFAULT_SETTINGS.aspectRatio;
        });
        if (elements.watermarkOpacityInput) {
            elements.watermarkOpacityInput.value = String(DEFAULT_SETTINGS.watermarkOpacity);
            elements.watermarkSizeInput.value = String(DEFAULT_SETTINGS.watermarkSize);
            elements.watermarkMarginInput.value = String(DEFAULT_SETTINGS.watermarkMargin);
            elements.watermarkPositionInputs.forEach((input) => {
                input.checked = input.value === DEFAULT_SETTINGS.watermarkPosition;
            });
            updateWatermarkOutputs();
            releaseWatermark();
            updateWatermarkUi();
        }
        elements.filePrefixInput.value = DEFAULT_SETTINGS.prefix;
        elements.fileSuffixInput.value = DEFAULT_SETTINGS.suffix;
        elements.sortSelect.value = DEFAULT_SETTINGS.sort;
        elements.alignmentInputs.forEach((input) => {
            input.checked = input.value === DEFAULT_SETTINGS.alignment;
        });
        sortItems();
        await rerenderAll();
    }

    function handleDownloadError(error) {
        console.error(error);
        alert('ไม่สามารถบันทึกไฟล์ได้ กรุณาลองใหม่อีกครั้ง');
    }

    function removeItem(id) {
        const index = state.items.findIndex((item) => item.id === id);
        if (index === -1) {
            return;
        }

        const [item] = state.items.splice(index, 1);
        state.fileKeys.delete(item.fileKey);
        releaseImage(item.image);
        item.element.remove();
        hideManualDownload();
        updateStatus();
    }

    function clearAll() {
        state.previewGeneration += 1;
        state.items.forEach((item) => releaseImage(item.image));
        state.items.splice(0, state.items.length);
        state.fileKeys.clear();
        elements.gallery.textContent = '';
        hideManualDownload();
        updateStatus();
    }

    function releaseImage(image) {
        if (image && typeof image.close === 'function') {
            image.close();
        }
    }

    function updateStatus() {
        const count = state.items.length;
        elements.clearAllButton.disabled = count === 0;
        elements.downloadAllButton.disabled = count === 0;
        elements.downloadImagesButton.disabled = count === 0;

        if (count === 0) {
            hideManualDownload();
            elements.summaryText.textContent = 'ยังไม่มีรูปที่นำเข้า';
            elements.detailText.textContent = 'เลือกสัดส่วนผลลัพธ์ได้ 1:1, 4:5, 9:16 หรือ 16:9 โดยคงพิกเซลภาพเดิม';
            return;
        }

        const totalPixels = state.items.reduce((sum, item) => sum + (item.outputWidth * item.outputHeight), 0);
        elements.summaryText.textContent = `พร้อมส่งออก ${count} รูป`;
        elements.detailText.textContent = state.noticeText || `รวมพื้นที่ผลลัพธ์ ${totalPixels.toLocaleString('th-TH')} พิกเซล`;
    }

    function setBusy(isBusy) {
        elements.downloadAllButton.disabled = isBusy || state.items.length === 0;
        elements.downloadImagesButton.disabled = isBusy || state.items.length === 0;
        elements.clearAllButton.disabled = isBusy || state.items.length === 0;
        elements.chooseFilesButton.disabled = isBusy;
        elements.formatSelect.disabled = isBusy;
        elements.qualityInput.disabled = isBusy || getOutputType() === 'image/png';
        document.querySelectorAll('.settings-panel input, .settings-panel select, .settings-panel button').forEach((control) => {
            control.disabled = isBusy;
        });
        document.querySelectorAll('.image-card button').forEach((button) => {
            button.disabled = isBusy;
        });
        elements.summaryText.textContent = isBusy ? 'กำลังประมวลผลรูป' : elements.summaryText.textContent;
    }

    function timestamp() {
        const now = new Date();
        const pad = (value) => String(value).padStart(2, '0');
        return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
    }

    function createZip(files) {
        const localParts = [];
        const centralParts = [];
        let offset = 0;

        files.forEach((file) => {
            const nameBytes = encodeUtf8(file.name);
            const data = file.data;
            const crc = crc32(data);
            const localHeader = concatBytes(
                uint32(0x04034b50),
                uint16(20),
                uint16(0x0800),
                uint16(0),
                uint16(0),
                uint16(0),
                uint32(crc),
                uint32(data.length),
                uint32(data.length),
                uint16(nameBytes.length),
                uint16(0),
                nameBytes
            );

            localParts.push(localHeader, data);

            const centralHeader = concatBytes(
                uint32(0x02014b50),
                uint16(20),
                uint16(20),
                uint16(0x0800),
                uint16(0),
                uint16(0),
                uint16(0),
                uint32(crc),
                uint32(data.length),
                uint32(data.length),
                uint16(nameBytes.length),
                uint16(0),
                uint16(0),
                uint16(0),
                uint16(0),
                uint32(0),
                uint32(offset),
                nameBytes
            );

            centralParts.push(centralHeader);
            offset += localHeader.length + data.length;
        });

        const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
        const centralOffset = offset;
        const endRecord = concatBytes(
            uint32(0x06054b50),
            uint16(0),
            uint16(0),
            uint16(files.length),
            uint16(files.length),
            uint32(centralSize),
            uint32(centralOffset),
            uint16(0)
        );

        return new Blob([...localParts, ...centralParts, endRecord], { type: 'application/zip' });
    }

    function buildCrcTable() {
        const table = new Uint32Array(256);
        for (let i = 0; i < 256; i += 1) {
            let value = i;
            for (let bit = 0; bit < 8; bit += 1) {
                value = (value & 1) ? (0xedb88320 ^ (value >>> 1)) : (value >>> 1);
            }
            table[i] = value >>> 0;
        }
        return table;
    }

    function crc32(bytes) {
        let crc = 0xffffffff;
        for (let i = 0; i < bytes.length; i += 1) {
            crc = crcTable[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
        }
        return (crc ^ 0xffffffff) >>> 0;
    }

    function uint16(value) {
        const bytes = new Uint8Array(2);
        const view = new DataView(bytes.buffer);
        view.setUint16(0, value, true);
        return bytes;
    }

    function uint32(value) {
        const bytes = new Uint8Array(4);
        const view = new DataView(bytes.buffer);
        view.setUint32(0, value >>> 0, true);
        return bytes;
    }

    function encodeUtf8(value) {
        return new TextEncoder().encode(value);
    }

    function concatBytes(...arrays) {
        const length = arrays.reduce((sum, array) => sum + array.length, 0);
        const output = new Uint8Array(length);
        let offset = 0;
        arrays.forEach((array) => {
            output.set(array, offset);
            offset += array.length;
        });
        return output;
    }

    updateSelectedSwatch();
    updateWatermarkOutputs();
    updateWatermarkUi();
    updateQualityState();
    updateStatus();
})();
