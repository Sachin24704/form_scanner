const express = require("express");
const path = require("path");
const multer = require("multer");
const Tesseract = require("tesseract.js");
const Jimp = require("jimp");
const fs = require("fs").promises;

const app = express();
const port = 3000;

app.use(express.static(__dirname));
// const storage = multer.memoryStorage();
// const upload = multer({ storage: storage });

app.get("/", (req, res) => {
  const htmlPath = path.join(__dirname, "index.html");

  res.sendFile(htmlPath, (err) => {
    if (err) {
      console.error("Error sending HTML file:", err);
      res.status(500).send("Internal Server Error");
    }
  });
});

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    cb(null, file.originalname);
  },
});

const upload = multer({ storage: storage });

app.post("/scan", upload.single("image"), async (req, res) => {
  try {
    console.log("Request File:", req.file);
    // if (!req.file || !req.file.buffer) {
    //   return res.status(400).json({ error: "Invalid or missing file data" });
    // }

    const imagePath = `uploads/${req.file.originalname}`;

    // Log imagePath for debugging
    console.log("Image Path:", imagePath);

    // Check if imagePath is defined
    if (!imagePath) {
      return res.status(500).json({ error: "Image path is undefined" });
    }

    // Log file size for debugging
    // console.log("File Size:", req.file.buffer.length);

    // fs.writeFileSync(imagePath, req.file.buffer);

    const image = await Jimp.read(imagePath);
    await performOCR(image);
    // Convert to grayscale
    image.greyscale();

    // Scale the image to 1191x2000 pixels
    // image.resize(1191, 2000);

    // Apply unsharp mask filter
    image.convolute([
      [-1, -1, -1],
      [-1, 9, -1],
      [-1, -1, -1],
    ]);
    // Save the new image as a .jpg in the 'output' folder
    // await image.writeAsync(`output/unsharpened-${Date.now()}.jpg`);
    console.log("image-jimp", image);
    // Save the image to a file

    const questionNumberRegion = image.clone().crop(0, 0, 100, 50);
    // await questionNumberRegion.writeAsync("output.jpg");
    const questionNumberText = await performOCR(image);

    const optionBoxes = extractOptionBoxes(image);
    const selectedOptions = await Promise.all(
      optionBoxes.map(async (box) => {
        const boxRegion = image
          .clone()
          .crop(box.x, box.y, box.width, box.height);
        return await performOCR(boxRegion);
      })
    );

    const result = {
      questionNumber: questionNumberText,
      selectedOptions: selectedOptions.map((text, index) => ({
        option: index + 1,
        text: text.trim(),
      })),
    };
    console.log("result", result);

    res.json(result);
  } catch (error) {
    console.error("Error processing image:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

async function performOCR(image) {
  const imageBuffer = await image.getBufferAsync(Jimp.MIME_JPEG);
  return new Promise((resolve, reject) => {
    try {
      Tesseract.recognize(imageBuffer, "eng", {
        logger: (info) => console.log(info),
      })
        .then(({ data: { text } }) => {
          // Split the OCR result into an array of lines
          const linesArray = text.split("\n").map((line) => line.trim());

          // Now 'linesArray' contains each line as a separate element
          console.log(linesArray);

          // Resolve with the array of lines
          resolve(linesArray);
        })
        .catch((error) => {
          console.error("Error in Tesseract:", error);
          reject("Error during OCR");
        });
    } catch (error) {
      console.error("Error in performOCR:", error);
      reject("Error during OCR");
    }
  });
}

function extractOptionBoxes(image) {
  return [
    { x: 200, y: 100, width: 50, height: 50 },
    { x: 300, y: 100, width: 50, height: 50 },
    { x: 400, y: 100, width: 50, height: 50 },
    { x: 500, y: 100, width: 50, height: 50 },
  ];
}
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
