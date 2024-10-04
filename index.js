pdfjsLib.GlobalWorkerOptions.workerSrc = './import/pdf.worker.min.js';
const pdfFileInput = document.getElementById('pdf-file-input');
const pdfFileLabel = document.getElementById('pdf-file-label');
const excelFileInput = document.getElementById('excel-file-input');
const excelFileLabel = document.getElementById('excel-file-label');
const checkResultButton = document.getElementById('check-result-button');
const cropSelect = document.getElementById('crop-select');
const resultContainer = document.getElementById('result-container');
const downloadPDFButton = document.getElementById('download-pdf-button');
const toggleAllButton = document.getElementById('toggle-all-button');
const clearResultsButton = document.getElementById('clear-results-button');
let excelData = null;
let scannedResults = [];
let areCroppedImagesVisible = false; 

BarcodeReader.Init();
BarcodeReader.SetImageCallback(function (result) {
    console.dir(result);
    if (!result.length) {
        scannedResults.push("");
        if (QRnotfoundtoDelete != 1) {
            const resultDelete = document.getElementById(`result-entry-${scannedResults.length}`);
            if (resultDelete) {
                resultDelete.style.display = 'none'; 
            }
        }
        return;
    }

    var barcode = result[0];
    scannedResults.push(barcode.Value);
    console.log("scannedResults : ", scannedResults);
    const resultText = document.getElementById(`result-text-${scannedResults.length}`);
    if (resultText) {
        resultText.innerText = `QR Code: ${barcode.Value}`;
    }
});

pdfFileInput.addEventListener('change', function (evt) {
    const file = evt.target.files[0]; 

    if (file) {
        resultContainer.innerHTML = ''; 
        pdfFileInput.disabled = true;
        pdfFileLabel.classList.add('disabled');
        excelFileInput.disabled = false;
        excelFileLabel.classList.remove('disabled');
        processPDF(file);
    }
});

excelFileInput.addEventListener('change', function (evt) {
    const file = evt.target.files[0];

    if (file && file.name.match(/\.(xls|xlsx)$/)) {
        const fileReader = new FileReader();
        fileReader.onload = function (e) {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const firstSheet = workbook.Sheets[workbook.SheetNames[0]];

            // Convert all data to text
            excelData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 }).map(row => row.map(cell => cell ? cell.toString() : ''));

            console.log(excelData);

            // Display Excel file name in the result container, but check if it's already added
            let excelResultEntry = document.querySelector('.result-entry.excel-entry');
            if (!excelResultEntry) {
                excelResultEntry = document.createElement('div');
                excelResultEntry.className = 'result-entry excel-entry';
                excelResultEntry.innerHTML = `<h2>ไฟล์ Excel: ${file.name}</h2>`;
                resultContainer.prepend(excelResultEntry);
            } else {
                // Update existing entry if the user re-uploads an Excel file
                excelResultEntry.innerHTML = `<h2>ไฟล์ Excel: ${file.name}</h2>`;
            }

            // Enable the "Check Result" button after Excel is uploaded
            excelFileInput.disabled = true;
            excelFileLabel.classList.add('disabled');
            checkResultButton.disabled = false;

            Swal.fire({
                icon: 'success',
                title: 'อัปโหลดสำเร็จ!',
                text: `ไฟล์ ${file.name} ถูกอัปโหลดเรียบร้อยแล้ว.`,
            });
        };
        fileReader.readAsArrayBuffer(file);
    } else {
        Swal.fire({
            icon: 'error',
            title: 'ผิดพลาด!',
            text: 'โปรดเลือกไฟล์ Excel (.xls, .xlsx) เท่านั้น.',
        });
    }
});

function processPDF(file) {
    Swal.fire({
        title: `กำลังอัปโหลดไฟล์: ${file.name}`,
        text: 'โปรดรอสักครู่...',
        allowOutsideClick: false,
        didOpen: () => {
            Swal.showLoading();
        }
    });

    const fileReader = new FileReader();
    fileReader.onload = function () {
        const typedArray = new Uint8Array(this.result);
        pdfjsLib.getDocument(typedArray).promise.then(async pdf => {
            const totalPages = pdf.numPages;

            // Loop through all pages in the PDF with a 1-second delay between each page
            for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
                await renderPageWithDelay(pdf, pageNum, file.name, totalPages);
            }
            Swal.fire({
                icon: 'success',
                title: 'อัปโหลดเสร็จสิ้น!',
                text: `${file.name} ได้รับการประมวลผลทั้งหมดแล้ว.`,
                confirmButtonText: 'ตกลง'
            });
        });
    };
    fileReader.readAsArrayBuffer(file);
}

// Render the PDF page on canvas with a 1-second delay
function renderPageWithDelay(pdfDoc, pageNum, fileName, totalPages) {
    return new Promise(resolve => {
        setTimeout(() => {
            renderPage(pdfDoc, pageNum, fileName);
            Swal.update({
                title: `กำลังประมวลผลหน้า: ${pageNum}/${totalPages}`,
                text: `โปรดรอการประมวลผลหน้าที่ ${pageNum} ของไฟล์ ${fileName}...`,
                showConfirmButton: false
            });
            Swal.showLoading()

            resolve(); // Resolve the promise after rendering
        }, 1000);  // 1 second delay
    });
}

// Render the PDF page on canvas
function renderPage(pdfDoc, pageNum, fileName) {
    pdfDoc.getPage(pageNum).then(page => {
        const highResScale = 5.0;  // Higher resolution for original image
        const lowResScale = 2.0;    // Lower resolution for cropping
        const highResViewport = page.getViewport({ scale: highResScale });
        const lowResViewport = page.getViewport({ scale: lowResScale });

        // Create canvas for high resolution
        const highResCanvas = document.createElement('canvas');
        const highResContext = highResCanvas.getContext('2d', { willReadFrequently: true });
        highResCanvas.width = highResViewport.width;
        highResCanvas.height = highResViewport.height;

        // Create canvas for low resolution
        const lowResCanvas = document.createElement('canvas');
        const lowResContext = lowResCanvas.getContext('2d', { willReadFrequently: true });
        lowResCanvas.width = lowResViewport.width;
        lowResCanvas.height = lowResViewport.height;

        // Render the page on high resolution canvas
        const highResRenderContext = {
            canvasContext: highResContext,
            viewport: highResViewport
        };

        page.render(highResRenderContext).promise.then(() => {
            // Save the original image at high resolution
            const originalDataUrl = highResCanvas.toDataURL('image/jpeg');
            const originalImg = document.createElement('img');
            originalImg.src = originalDataUrl;
            originalImg.style.display = 'none';

            // Add the original image to the result entry
            const resultEntry = document.createElement('div');
            resultEntry.className = `result-entry`;
            resultEntry.id = `result-entry-${pageNum}`;
            resultEntry.innerHTML = `
                <h2>File: ${fileName}, Page: ${pageNum}</h2>
                <img src="" alt="Cropped Image" class="cropped-image"/>
                <img id="original-image-${pageNum}" src="${originalDataUrl}" alt="Original Image" style="display:none;"/>
                <div class="result-text" id="result-text-${pageNum}">ไม่พบ...</div>
            `;
            resultContainer.appendChild(resultEntry);

            // Render the page on low resolution canvas for cropping
            const lowResRenderContext = {
                canvasContext: lowResContext,
                viewport: lowResViewport
            };

            page.render(lowResRenderContext).promise.then(() => {
                // Save the cropped image from low resolution canvas
                cropAndScan(lowResCanvas);  // Pass low-res canvas to cropAndScan
            });
        });
    });
}

// Crop the Canvas based on selected option and use the rest for scanning
function cropAndScan(canvas) {
    const context = canvas.getContext('2d', { willReadFrequently: true });
    const croppedCanvas = document.createElement('canvas');
    const croppedContext = croppedCanvas.getContext('2d', { willReadFrequently: true });
    const selectedOption = cropSelect.value;

    let cropTopPercentage, cropBottomPercentage, cropLeftPercentage, cropRightPercentage;

    if (selectedOption === "shopee") {
        cropTopPercentage = parseFloat(shopeeQRlocation.top) / 100;
        cropBottomPercentage = parseFloat(shopeeQRlocation.bottom) / 100;
        cropLeftPercentage = parseFloat(shopeeQRlocation.left) / 100;
        cropRightPercentage = parseFloat(shopeeQRlocation.right) / 100;

        const cropTopHeight = canvas.height * cropTopPercentage;
        const cropBottomHeight = canvas.height * cropBottomPercentage;
        const cropLeftWidth = canvas.width * cropLeftPercentage;
        const cropRightWidth = canvas.width * cropRightPercentage;
        const cropTop = cropTopHeight;
        const cropLeft = cropLeftWidth;
        const cropWidthAdjusted = canvas.width - cropLeftWidth - cropRightWidth;
        const cropHeightAdjusted = canvas.height - cropTopHeight - cropBottomHeight;
        
        croppedCanvas.width = cropWidthAdjusted;
        croppedCanvas.height = cropHeightAdjusted;

        croppedContext.drawImage(canvas, cropLeft, cropTop, cropWidthAdjusted, cropHeightAdjusted, 0, 0, cropWidthAdjusted, cropHeightAdjusted);
    } else if (selectedOption === "lazada") {
        cropTopPercentage = parseFloat(lazadaQRlocation.top) / 100;
        cropBottomPercentage = parseFloat(lazadaQRlocation.bottom) / 100;
        cropLeftPercentage = parseFloat(lazadaQRlocation.left) / 100;
        cropRightPercentage = parseFloat(lazadaQRlocation.right) / 100;

        const cropTopHeight = canvas.height * cropTopPercentage;
        const cropBottomHeight = canvas.height * cropBottomPercentage;
        const cropLeftWidth = canvas.width * cropLeftPercentage;
        const cropRightWidth = canvas.width * cropRightPercentage;
        const cropTop = cropTopHeight;
        const cropLeft = cropLeftWidth;
        const cropWidthAdjusted = canvas.width - cropLeftWidth - cropRightWidth;
        const cropHeightAdjusted = canvas.height - cropTopHeight - cropBottomHeight;
        
        croppedCanvas.width = cropWidthAdjusted;
        croppedCanvas.height = cropHeightAdjusted;
        
        croppedContext.drawImage(canvas, cropLeft, cropTop, cropWidthAdjusted, cropHeightAdjusted, 0, 0, cropWidthAdjusted, cropHeightAdjusted);
    }

    // Show the cropped image
    const croppedDataUrl = croppedCanvas.toDataURL('image/jpeg');
    const resultEntry = document.querySelector('.result-entry:last-child');
    const croppedImage = resultEntry.querySelector('.cropped-image');
    croppedImage.src = croppedDataUrl;

    // Once the image is loaded, scan for QR code
    croppedImage.onload = function () {
        BarcodeReader.DecodeImage(croppedImage);
    };
}

// Draw text on canvas and return Data URL
function drawTextOnCanvas(image, text) {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.width = image.width;
    canvas.height = image.height;

    context.drawImage(image, 0, 0);

    // Calculate font size proportional to the image size
    const fontSize = canvas.width * 0.05;  // For example, 5% of the image width
    context.font = `${fontSize}px Arial`;
    context.fillStyle = 'red';

    // Calculate text width and position
    const textWidth = context.measureText(text).width;
    const x = (canvas.width / 2) - (textWidth / 2);

    // Set Y position to 10% from the bottom
    const y = canvas.height * 0.9;  // 10% from the bottom

    // Adjust font size if text is too wide
    if (textWidth > canvas.width) {
        const adjustedFontSize = fontSize * (canvas.width / textWidth);
        context.font = `${adjustedFontSize}px Arial`;
    }

    // Redefine text width and position after font size adjustment
    const finalTextWidth = context.measureText(text).width;
    const finalX = (canvas.width / 2) - (finalTextWidth / 2);
    const finalY = canvas.height * 0.9;  // 10% from the bottom

    context.fillText(text, finalX, finalY);

    return canvas.toDataURL('image/jpeg');
}

// Add click event to the check result button
checkResultButton.addEventListener('click', function () {
    if (!checkResultButton.disabled && scannedResults.length > 0) {
        checkResultButton.disabled = true
        Swal.fire({
            icon: 'info',
            title: 'กำลังตรวจสอบ...',
            text: 'โปรดรอขณะที่ผลลัพธ์ถูกตรวจสอบ.',
            allowEscapeKey: false,
            allowOutsideClick: false,
            onBeforeOpen: () => {
                Swal.showLoading();
            }
        });

        scannedResults.forEach((qrValue, index) => {
            setTimeout(() => {
                checkExcelData(qrValue, index + 1);
                if (index === scannedResults.length - 1) {
                    downloadPDFButton.disabled = false;
                    Swal.fire({
                        icon: 'success',
                        title: 'เสร็จสิ้น!',
                        text: 'การตรวจสอบผลลัพธ์เสร็จสิ้นแล้ว.',
                    });

                    isChecking = false;
                }
            }, index * 100); // Delay for each item
        });
    }
});

function checkExcelData(qrValue, index) {
    if (!excelData) {
        // alert('Please upload an Excel file first.');
        return;
    }
    for (let i = 0; i < excelData.length; i++) {
        if (excelData[i][2] === qrValue) {  // Assuming column C is the third column (index 2)
            const correspondingValue = excelData[i][0];  // Assuming column A is the first column (index 0)
            const originalImg = document.getElementById(`original-image-${index}`);
            const imgWithText = drawTextOnCanvas(originalImg, `${correspondingValue}`);
            document.querySelector(`#result-text-${index}`).previousElementSibling.src = imgWithText;  // Update the cropped image with text
            document.getElementById(`result-text-${index}`).innerText = `QR Code: ${qrValue}\nCorresponding value from column A: ${correspondingValue}`;
            return;
        }
    }
    document.getElementById(`result-text-${index}`).innerText = `QR Code: ${qrValue}\nNo matching value found in column C.`;
}

// Toggle visibility of all cropped images
toggleAllButton.addEventListener('click', function () {
    const croppedImages = document.querySelectorAll('.cropped-image');
    areCroppedImagesVisible = !areCroppedImagesVisible; // Toggle visibility state
    croppedImages.forEach(image => {
        image.style.display = areCroppedImagesVisible ? 'block' : 'none';
    });
});
downloadPDFButton.addEventListener('click', async function () {
    // Disable the button
    downloadPDFButton.disabled = true;

    // Create a new jsPDF instance for the combined PDF
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF();

    const originalImages = document.querySelectorAll('.result-entry img[alt="Original Image"]');

    // Loop through each image and add to PDF
    for (let index = 0; index < originalImages.length; index++) {
        const img = originalImages[index];

        // Get image properties
        const imgProps = pdf.getImageProperties(img.src);
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

        // Add image directly using the src URL
        pdf.addImage(img.src, 'JPEG', 0, 0, pdfWidth, pdfHeight);

        // Add a new page if it's not the last image
        if (index < originalImages.length - 1) {
            pdf.addPage();
        }
    }

    // Save the combined PDF
    pdf.save('PDFText.pdf');

    // Show success notification after download
    Swal.fire({
        icon: 'success',
        title: 'ดาวน์โหลดเสร็จสิ้น!',
        text: 'ไฟล์ PDF รวมเสร็จสิ้นแล้ว.'
    });

    // Enable the button again after download
    downloadPDFButton.disabled = false;
});

// Add event listener to the clear button
clearResultsButton.addEventListener('click', function () {
    // // Clear the result container
    location.reload();
});