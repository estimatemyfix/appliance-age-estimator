const express = require('express');
const multer = require('multer');
const OpenAI = require('openai');
const cors = require('cors');
const path = require('path');
const fs = require('fs-extra');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = 'uploads';
    fs.ensureDirSync(uploadDir);
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'), false);
    }
  }
});

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.post('/analyze-appliance', upload.single('photo'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No photo uploaded' });
    }

    // Convert image to base64
    const imageBuffer = await fs.readFile(req.file.path);
    const base64Image = imageBuffer.toString('base64');
    const mimeType = req.file.mimetype;

    // Create detailed prompt for appliance analysis
    const prompt = `Analyze this appliance photo and provide detailed information about:

1. **Type of Appliance**: What specific appliance is this?
2. **Brand/Manufacturer**: If visible, what brand is it?
3. **Age Estimation**: Based on design, style, features, and any visible model numbers or design elements, estimate the approximate age or age range of this appliance.
4. **Key Features**: What features or design elements help determine the age?
5. **Warranty Information**: Provide general warranty information for this type of appliance (typical warranty periods, what's usually covered).
6. **Maintenance Tips**: Brief advice on maintaining this appliance.

Please be as specific as possible with the age estimation and explain your reasoning. If you can see any model numbers, serial numbers, or manufacturing dates, please mention them.

Format your response in a structured, easy-to-read way.`;

    // Call OpenAI GPT-4 Vision API
    const response = await openai.chat.completions.create({
      model: "gpt-4-vision-preview",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            {
              type: "image_url",
              image_url: {
                url: `data:${mimeType};base64,${base64Image}`,
                detail: "high"
              }
            }
          ]
        }
      ],
      max_tokens: 1000,
      temperature: 0.7
    });

    const analysis = response.choices[0].message.content;

    // Clean up uploaded file
    await fs.remove(req.file.path);

    res.json({
      success: true,
      analysis: analysis,
      filename: req.file.originalname
    });

  } catch (error) {
    console.error('Error analyzing appliance:', error);
    
    // Clean up uploaded file on error
    if (req.file && req.file.path) {
      try {
        await fs.remove(req.file.path);
      } catch (cleanupError) {
        console.error('Error cleaning up file:', cleanupError);
      }
    }

    res.status(500).json({ 
      error: 'Failed to analyze appliance', 
      details: error.message 
    });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Error handling middleware
app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File size too large. Maximum size is 10MB.' });
    }
  }
  res.status(500).json({ error: 'Something went wrong!' });
});

app.listen(port, () => {
  console.log(`Appliance Age Estimator server running on http://localhost:${port}`);
  console.log('Make sure you have set your OPENAI_API_KEY in the .env file');
}); 