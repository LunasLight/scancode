let amounts = []; 
let totalImages = 0;  

document.getElementById('slipUpload').addEventListener('change', async function () {
    const files = document.getElementById('slipUpload').files;
    if (files.length > 0) {
        const swalInstance = Swal.fire({
            title: 'กำลังประมวลผล...',
            text: 'โปรดรอซักครู่',
            allowEscapeKey: false,
            allowOutsideClick: false,
            showConfirmButton: false,
            didOpen: () => {
                Swal.showLoading();
            }
        });

        amounts = [];
        totalImages = files.length;
        const upscaledImagesDiv = document.getElementById('upscaledImagesDiv');
        upscaledImagesDiv.innerHTML = '';
        const amountList = document.getElementById('amountList');
        amountList.innerHTML = '';

        document.getElementById('totalimg').textContent = `สลิป: ${totalImages} รูป`;

        let processedCount = 0;
        let lastValidDate = null;
        let lastValidAmount = 0;

        for (let index = 0; index < totalImages; index++) {
            const file = files[index];
            const reader = new FileReader();

            reader.onload = async (e) => {
                let scaleFactor = 1.3; 
                const maxScaleFactor = 2.3; 
                let amount = 0;
                let date = null;
                let note = '-';

                let previousNote = null; 

                while (scaleFactor <= maxScaleFactor) {
                    const result = await processImage(e.target.result, scaleFactor);

                    if (result.amount > 0) {
                        amount = result.amount;
                        lastValidAmount = amount;
                    }

                    if (result.date && result.date !== 'ไม่พบวันที่') {
                        date = result.date;
                        lastValidDate = date; 
                    }

                    if (result.note && result.note !== '-') {
                        note = result.note;
                    }

                    // ถ้าเจอครบ amount, date, note ที่ไม่ใช่ "-" หยุดอัพสเกลและแสดงผล
                    if (amount > 0 && date && note !== '-') {
                        break; 
                    }

                    scaleFactor += 0.1;
                }

                // ถ้าไม่มี amount หรือ date ให้ใช้ข้อมูลล่าสุด
                if (amount === 0) {
                    amount = lastValidAmount;
                }
                if (!date) {
                    date = lastValidDate;
                }

                // เก็บผลลัพธ์
                amounts[index] = { amount, date, note };

                processedCount++;

                // อัปเดต Swal Content
                await Swal.update({
                    title: 'กำลังประมวลผล...',
                    text: `กำลังประมวลผลรูปภาพ: ${processedCount} จาก ${totalImages} (ขออภัยในความล่าช้า อาจต้องใช้เวลาสักครู่)`,
                    icon: 'info',
                });

                updateAmountList(amounts);
                updateExportButton();

                // เช็คว่า processedCount ครบ totalImages หรือไม่
                if (processedCount === totalImages) {
                    // ปิด Swal ด้วยการแสดงผลการประมวลผลที่เสร็จสิ้น
                    await Swal.fire({
                        title: 'เสร็จสิ้น!',
                        text: `ประมวลผลเรียบร้อยแล้ว: ${totalImages} รูป`,
                        icon: 'success',
                        confirmButtonText: 'ตกลง',
                    });
                }
            };

            reader.readAsDataURL(file);
        }
    } else {
        Swal.fire({
            title: 'ข้อผิดพลาด!',
            text: 'กรุณาอัพโหลดสลิปเงิน',
            icon: 'error',
            confirmButtonText: 'ตกลง',
        });
    }
});

async function applyGaussianBlur(ctx, width, height) {
    const imageDataObj = ctx.getImageData(0, 0, width, height);
    const data = imageDataObj.data;
    const kernel = [
        1 / 16, 1 / 8, 1 / 16,
        1 / 8, 1 / 4, 1 / 8,
        1 / 16, 1 / 8, 1 / 16
    ];

    const side = 3;
    const halfSide = 1;
    const outputData = new Uint8ClampedArray(data.length);

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            let r = 0, g = 0, b = 0;

            for (let cy = 0; cy < side; cy++) {
                for (let cx = 0; cx < side; cx++) {
                    const scy = y + cy - halfSide;
                    const scx = x + cx - halfSide;
                    if (scy >= 0 && scy < height && scx >= 0 && scx < width) {
                        const srcOffset = (scy * width + scx) * 4;
                        const wt = kernel[cy * side + cx];
                        r += data[srcOffset] * wt;
                        g += data[srcOffset + 1] * wt;
                        b += data[srcOffset + 2] * wt;
                    }
                }
            }

            const dstOffset = (y * width + x) * 4;
            outputData[dstOffset] = r;
            outputData[dstOffset + 1] = g;
            outputData[dstOffset + 2] = b;
            outputData[dstOffset + 3] = 255; // Alpha channel
        }
    }

    imageDataObj.data.set(outputData);
    ctx.putImageData(imageDataObj, 0, 0);
}

async function enhanceImage(ctx, width, height) {
    const imageDataObj = ctx.getImageData(0, 0, width, height);
    const data = imageDataObj.data;
    const kernel = [
        0, -1, 0,
        -1, 5, -1,
        0, -1, 0
    ];

    const side = 3;
    const halfSide = 1;
    const outputData = new Uint8ClampedArray(data.length);

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            let r = 0, g = 0, b = 0;

            for (let cy = 0; cy < side; cy++) {
                for (let cx = 0; cx < side; cx++) {
                    const scy = y + cy - halfSide;
                    const scx = x + cx - halfSide;
                    if (scy >= 0 && scy < height && scx >= 0 && scx < width) {
                        const srcOffset = (scy * width + scx) * 4;
                        const wt = kernel[cy * side + cx];
                        r += data[srcOffset] * wt;
                        g += data[srcOffset + 1] * wt;
                        b += data[srcOffset + 2] * wt;
                    }
                }
            }

            const dstOffset = (y * width + x) * 4;
            outputData[dstOffset] = r;
            outputData[dstOffset + 1] = g;
            outputData[dstOffset + 2] = b;
            outputData[dstOffset + 3] = 255; // Alpha channel
        }
    }

    imageDataObj.data.set(outputData);
    ctx.putImageData(imageDataObj, 0, 0);
}
async function processImage(imageData, scale) {
    const img = new Image();
    img.src = imageData;

    return new Promise((resolve) => {
        img.onload = async function () {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');

            canvas.width = img.width * scale;
            canvas.height = img.height * scale;
            ctx.scale(scale, scale);
            ctx.drawImage(img, 0, 0, img.width, img.height);

            await enhanceImage(ctx, canvas.width, canvas.height);
            await applyGaussianBlur(ctx, canvas.width, canvas.height);

            const imageDataObj = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const data = imageDataObj.data;

            // Convert image to binary
            for (let i = 0; i < data.length; i += 4) {
                const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
                const threshold = 150; // Adjust the threshold according to the requirement
                const binaryColor = avg >= threshold ? 255 : 0;
                data[i] = data[i + 1] = data[i + 2] = binaryColor;
            }

            ctx.putImageData(imageDataObj, 0, 0);

            const enhancedImageData = canvas.toDataURL();
            const upscaledImg = document.createElement('img');
            upscaledImg.src = enhancedImageData;
            upscaledImg.style.display = 'block';
            upscaledImg.style.width = '200px';
            upscaledImg.style.height = 'auto';
            document.getElementById('upscaledImagesDiv').appendChild(upscaledImg);

            const noteResult = await Tesseract.recognize(enhancedImageData, 'eng+tha', {
                tessedit_char_whitelist: '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZกขคฆงจฉชซฌญฎฏฐฑฒณดตถทธนบปผพฟภมยรลวศษสหฬอฮฯ',
                tessedit_pageseg_mode: Tesseract.PSM.SINGLE_BLOCK
            });
            const noteText = noteResult.data.text;
            const amountDateResult = await Tesseract.recognize(enhancedImageData, 'tha', {
                tessedit_char_whitelist: '0123456789/ปี วันที่',
                tessedit_pageseg_mode: Tesseract.PSM.SINGLE_BLOCK
            });
            const amountDateText = amountDateResult.data.text;

            const note = extractNote(noteText);
            const amount = extractAmount(amountDateText);
            const date = extractDate(amountDateText);

            // console.log("note:", note);
            // console.log("date:", date);
            // console.log("amount:", amount);

            // Remove the displayed slip image after processing
            upscaledImg.remove();

            resolve({ amount, date, note });
        };

        img.onerror = function () {
            // console.error("Error loading image");
            resolve({ amount: 0, date: null, note: null });
        };
    });
}

function updateAmountList(amounts) {
    const amountList = document.getElementById('amountList');
    amountList.innerHTML = '';
    amounts.forEach((entry, index) => {
        const listItem = document.createElement('li');
        listItem.textContent = `รูปที่ ${index + 1}: ${entry.amount}, วันที่: ${entry.date}, บันทึก: ${entry.note}`;
        amountList.appendChild(listItem);
    });
}

function updateExportButton() {
    const amountList = document.getElementById('amountList');
    if (amountList.children.length === totalImages) {
        document.getElementById('exportExcel').style.display = 'block';
    } else {
        document.getElementById('exportExcel').style.display = 'none';
    }
}

function extractDate(text) {
    function cleanLine(line) {
        let cleaned = line.replace(/\s+/g, '')
            .replace(/[^0-9ก-ฮะ-ูเ-๋็่้๊๋ฯ๐-๙:.]|ุ/g, '');
        cleaned = cleaned.replace(/(ม\.?ค|ก\.?พ|มี\.?ค|เม\.?ย|พ\.?ค|มิ\.?ย|ก\.?ค|ส\.?ค|ก\.?ย|ต\.?ค|พ\.?ย|ธ\.?ค)[ะ-ูเ-๋]*/g, '$1');
        return cleaned;
    }

    function formatMonth(month) {
        const monthMap = {
            'มค': 'ม.ค.', 'กพ': 'ก.พ.', 'มีค': 'มี.ค.', 'เมย': 'เม.ย.',
            'พค': 'พ.ค.', 'มิย': 'มิ.ย.', 'กค': 'ก.ค.', 'สค': 'ส.ค.',
            'กย': 'ก.ย.', 'ตค': 'ต.ค.', 'พย': 'พ.ย.', 'ธค': 'ธ.ค.'
        };
        return monthMap[month] || month;
    }

    function formatYear(year) {
        if (year >= 3000) {
            return year.toString().substring(0, 2); // แสดงแค่ 2 หลักแรก
        }
        return (year % 100).toString().padStart(2, '0');
    }

    function formatDate(match) {
        const day = match[1];
        let month = match[2];
        const year = match[3];
        month = formatMonth(month);
        const formattedYear = formatYear(parseInt(year, 10)); // แปลงปีเป็น int
        return `${day} ${month} ${formattedYear}`;
    }

    const dateRegex = /(\d{1,2})(มค|กพ|มีค|เมย|พค|มิย|กค|สค|กย|ตค|พย|ธค|ม\.ค\.|ก\.พ\.|มี\.ค\.|เม\.ย\.|พ\.ค\.|มิ\.ย\.|ก\.ค\.|ส\.ค\.|ก\.ย\.|ต\.ค\.|พ\.ย\.|ธ\.ค\.)(\d{4})/;

    const lines = text.split('\n');

    for (let i = 0; i < lines.length; i++) {
        const cleanedLine = cleanLine(lines[i]);
        const match = cleanedLine.match(dateRegex);
        if (match) {
            return formatDate(match);
        }
    }

    return 'ไม่พบวันที่';
}

function extractNote(text) {
    const cleanedText = text
        .split('\n')
        .map(cleanLine)
        .filter(line => line !== null)
        .join('\n');
    const lines = cleanedText.split('\n');

    function cleanLine(line) {
        if (line.trim() === '') {
            return null;
        }
        return line.replace(/\s+/g, '');
    }

    for (let i = 0; i < lines.length; i++) {
        const currentLine = lines[i];

        // Check for "บันทึกช่วยจํา"
        const match1 = /บันทึกช่วยจํา\s*(.*)/i.exec(currentLine);
        if (match1) {
            // Remove "ช่วยจำ" from the extracted part
            const note = match1[1] ? match1[1].trim() : '-';
            return note.replace(/ชวยจํา/g, '').trim() || '-';
        }

        // Check for other cases
        if (/บันทึกช่วยจํา|ปันทึกช่วยจํา/i.test(currentLine)) {
            const nextLine = lines[i + 1];
            if (nextLine) {
                // Remove "ช่วยจำ" from the found line
                return nextLine.replace(/ชวยจํา/g, '').trim() || '-';
            }
        }

        const match2 = /บันทึก\s*(.*)/i.exec(currentLine);
        if (match2) {
            // Remove "ช่วยจำ" from the extracted part
            const note = match2[1] ? match2[1].trim() : '-';
            return note.replace(/ชวยจํา/g, '').trim() || '-';
        }
    }

    return '-';
}

function extractAmount(text) {
    const lines = text.split('\n');
    function cleanAmount(amount) {
        amount = amount.replace(/\s+/g, '').replace(/[^\d.]/g, '');
        const parts = amount.split('.');

        if (parts.length > 2) {
            let cleanedAmount = parts.join('');
            if (cleanedAmount.length > 2) {
                cleanedAmount = cleanedAmount.slice(0, -2) + '.' + cleanedAmount.slice(-2);
            }
            return parseFloat(cleanedAmount).toFixed(2);
        } else if (parts.length === 2 && parts[1].length === 2) {
            return parseFloat(amount).toFixed(2);
        }

        return parseFloat(amount).toFixed(2);
    }
    for (let i = 0; i < lines.length; i++) {
        const currentLine = lines[i];

        // KrungThai , kasikorn , krungsri
        const amountRegex = /([\d\s,.]+)\s*(?:บ\s*า\s*ท)/i;
        const match = currentLine.match(amountRegex);

        if (match) {
            const extractedAmount = cleanAmount(match[1]);
            if (!isNaN(extractedAmount)) {
                return extractedAmount;
            }
        }
        // SCB 
        const logRegex = /จ\s*ํ?\s*า?\s*น?\s*ว?\s*น?\s*เ\s*ง\s*ิ\s*น\s*([\d\s,.]+)/i;
        const logMatch = currentLine.match(logRegex);

        if (logMatch) {
            const extractedAmount = cleanAmount(logMatch[1]);
            if (!isNaN(extractedAmount)) {
                return extractedAmount;
            }
        }

        // Bangkok , GSB
        if (/จ\s*ํ?\s*า?\s*น?\s*ว?\s*น?\s*เ\s*ง\s*ิ\s*น/i.test(currentLine)) {
            const nextLine = lines[i + 1];
            const nextLineMatch = nextLine.match(/([\d\s,.]+)/);

            if (nextLineMatch) {
                const extractedAmount = cleanAmount(nextLineMatch[1]);
                if (!isNaN(extractedAmount)) {
                    return extractedAmount;
                }
            }
        }

        // LINE BK
        if (/B\d,\d{3}\.\d{2}/.test(currentLine)) {
            const logBRegex = /B(\d,\d{3}\.\d{2})/;
            const matchB = currentLine.match(logBRegex);
            if (matchB) {
                const extractedAmount = cleanAmount(matchB[1]);
                if (!isNaN(extractedAmount)) {
                    return extractedAmount;
                }
            }
        }
    }

    return null; 
}

document.getElementById('exportExcel').addEventListener('click', function () {
    exportToExcel(amounts);
});

function parseDateString(dateString) {
    const months = {
        'ม.ค.': 0,
        'ก.พ.': 1,
        'มี.ค.': 2,
        'เม.ย.': 3,
        'พ.ค.': 4,
        'มิ.ย.': 5,
        'ก.ค.': 6,
        'ส.ค.': 7,
        'ก.ย.': 8,
        'ต.ค.': 9,
        'พ.ย.': 10,
        'ธ.ค.': 11
    };

    const parts = dateString.split(' ');
    const day = parseInt(parts[0], 10);
    const month = months[parts[1]];
    const year = parseInt(parts[2], 10) + 2000; // เพิ่ม 2000 เพื่อให้เป็นปีที่ถูกต้อง

    return new Date(year, month, day);
}

function exportToExcel(amounts) {
    Swal.fire({
        title: 'กำลังส่งออก...',
        text: 'กรุณารอสักครู่...',
        onBeforeOpen: () => {
            Swal.showLoading();
        }
    });
    amounts.sort((a, b) => parseDateString(a.date) - parseDateString(b.date));
    const dataToExport = amounts.map((entry) => [entry.date, entry.note, entry.amount]);
    const ws = XLSX.utils.aoa_to_sheet([['วันที่ทำรายการ', 'บันทึกช่วยจำ', 'จำนวนเงิน(บาท)'], ...dataToExport]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
    XLSX.writeFile(wb, 'ExcelSlip.xlsx');
    Swal.fire({
        title: 'เสร็จสิ้น!',
        text: 'ส่งออกข้อมูลสำเร็จแล้ว!',
        icon: 'success',
        confirmButtonText: 'ตกลง'
    });
}