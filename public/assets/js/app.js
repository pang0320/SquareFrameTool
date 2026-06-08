(() => {
    'use strict';

    const MAX_FILE_SIZE_BYTES = 40 * 1024 * 1024;
    const ACCEPTED_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);
    const EXTENSIONS = {
        'image/png': 'png',
        'image/jpeg': 'jpg',
        'image/webp': 'webp',
    };

    const state = {
        items: [],
        nextId: 1,
        manualDownloadUrl: '',
        noticeText: '',
    };

    const elements = {
        dropZone: document.getElementById('dropZone'),
        fileInput: document.getElementById('fileInput'),
        chooseFilesButton: document.getElementById('chooseFilesButton'),
        clearAllButton: document.getElementById('clearAllButton'),
        downloadAllButton: document.getElementById('downloadAllButton'),
        gallery: document.getElementById('gallery'),
        template: document.getElementById('imageCardTemplate'),
        formatSelect: document.getElementById('formatSelect'),
        qualityInput: document.getElementById('qualityInput'),
        qualityOutput: document.getElementById('qualityOutput'),
        summaryText: document.getElementById('summaryText'),
        detailText: document.getElementById('detailText'),
        manualDownloadLink: document.getElementById('manualDownloadLink'),
    };

    const crcTable = buildCrcTable();

    elements.chooseFilesButton.addEventListener('click', () => elements.fileInput.click());
    elements.fileInput.addEventListener('change', async () => {
        await addFiles(elements.fileInput.files);
        elements.fileInput.value = '';
    });
    elements.clearAllButton.addEventListener('click', clearAll);
    elements.downloadAllButton.addEventListener('click', downloadAll);
    elements.formatSelect.addEventListener('change', rerenderAll);
    elements.qualityInput.addEventListener('input', () => {
        elements.qualityOutput.textContent = `${Math.round(Number(elements.qualityInput.value) * 100)}%`;
    });
    elements.qualityInput.addEventListener('change', rerenderAll);

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
            for (const file of validFiles) {
                await addImage(file);
            }
        } finally {
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

    async function addImage(file) {
        const image = await loadImage(file);
        const item = {
            id: state.nextId,
            file,
            image,
            width: image.naturalWidth,
            height: image.naturalHeight,
            outputSize: Math.max(image.naturalWidth, image.naturalHeight),
            element: null,
            canvas: null,
            lastBlob: null,
            lastFileName: '',
        };
        state.nextId += 1;
        state.items.push(item);
        renderCard(item);
        await renderOutput(item);
    }

    function loadImage(file) {
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

    function renderCard(item) {
        const fragment = elements.template.content.cloneNode(true);
        const card = fragment.querySelector('.image-card');
        const canvas = fragment.querySelector('.preview-canvas');
        const name = fragment.querySelector('.image-name');
        const originalSize = fragment.querySelector('.original-size');
        const outputSize = fragment.querySelector('.output-size');
        const downloadButton = fragment.querySelector('.download-one');
        const removeButton = fragment.querySelector('.remove-one');

        name.textContent = item.file.name;
        name.title = item.file.name;
        originalSize.textContent = `${item.width} x ${item.height}px`;
        outputSize.textContent = `${item.outputSize} x ${item.outputSize}px`;
        downloadButton.addEventListener('click', () => downloadOne(item));
        removeButton.addEventListener('click', () => removeItem(item.id));

        item.element = card;
        item.canvas = canvas;
        elements.gallery.appendChild(fragment);
    }

    async function renderOutput(item) {
        const canvas = item.canvas;
        const size = item.outputSize;
        const context = canvas.getContext('2d', { alpha: false });

        canvas.width = size;
        canvas.height = size;
        context.imageSmoothingEnabled = false;
        context.fillStyle = '#ffffff';
        context.fillRect(0, 0, size, size);
        context.drawImage(
            item.image,
            Math.floor((size - item.width) / 2),
            Math.floor((size - item.height) / 2),
            item.width,
            item.height
        );

        item.lastBlob = await canvasToBlob(canvas, getOutputType(), getOutputQuality());
        item.lastFileName = buildOutputName(item.file.name, getOutputType());
    }

    async function rerenderAll() {
        if (state.items.length === 0) {
            return;
        }

        hideManualDownload();
        setBusy(true);
        try {
            for (const item of state.items) {
                await renderOutput(item);
            }
        } finally {
            setBusy(false);
            updateStatus();
        }
    }

    function canvasToBlob(canvas, type, quality) {
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

    function buildOutputName(originalName, mimeType) {
        const baseName = originalName.replace(/\.[^.]+$/, '') || 'image';
        const safeName = baseName
            .normalize('NFKD')
            .replace(/[^\w.-]+/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '')
            .slice(0, 90) || 'image';

        return `${safeName}-1x1-white.${EXTENSIONS[mimeType]}`;
    }

    async function downloadOne(item) {
        try {
            const outputType = getOutputType();
            const fileName = buildOutputName(item.file.name, outputType);
            const saveHandle = await requestSaveHandle(fileName, outputType, EXTENSIONS[outputType]);

            if (saveHandle === false) {
                return;
            }

            if (!item.lastBlob) {
                await renderOutput(item);
            }

            await saveBlob(item.lastBlob, fileName, saveHandle, false);
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
            const files = [];
            const nameCounts = new Map();

            for (const item of state.items) {
                if (!item.lastBlob) {
                    await renderOutput(item);
                }

                const uniqueName = uniqueFileName(item.lastFileName, nameCounts);
                files.push({
                    name: uniqueName,
                    data: new Uint8Array(await item.lastBlob.arrayBuffer()),
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
        item.element.remove();
        hideManualDownload();
        updateStatus();
    }

    function clearAll() {
        state.items.splice(0, state.items.length);
        elements.gallery.textContent = '';
        hideManualDownload();
        updateStatus();
    }

    function updateStatus() {
        const count = state.items.length;
        elements.clearAllButton.disabled = count === 0;
        elements.downloadAllButton.disabled = count === 0;

        if (count === 0) {
            hideManualDownload();
            elements.summaryText.textContent = 'ยังไม่มีรูปที่นำเข้า';
            elements.detailText.textContent = 'ผลลัพธ์จะเป็นสี่เหลี่ยมจัตุรัส ขนาดเท่าด้านที่ยาวที่สุดของแต่ละรูป';
            return;
        }

        const totalPixels = state.items.reduce((sum, item) => sum + item.outputSize * item.outputSize, 0);
        elements.summaryText.textContent = `พร้อมส่งออก ${count} รูป`;
        elements.detailText.textContent = state.noticeText || `รวมพื้นที่ผลลัพธ์ ${totalPixels.toLocaleString('th-TH')} พิกเซล`;
    }

    function setBusy(isBusy) {
        elements.downloadAllButton.disabled = isBusy || state.items.length === 0;
        elements.clearAllButton.disabled = isBusy || state.items.length === 0;
        elements.chooseFilesButton.disabled = isBusy;
        elements.formatSelect.disabled = isBusy;
        elements.qualityInput.disabled = isBusy;
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

    updateStatus();
})();
