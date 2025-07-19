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

    // Create consumer-friendly prompt for appliance analysis
    const prompt = `You are a professional appliance expert providing a detailed analysis for a homeowner. Analyze this appliance photo and provide information in a clear, consumer-friendly format.

Please structure your response EXACTLY like this format:

## 🔍 APPLIANCE IDENTIFICATION
**Type:** [Specific appliance type]
**Brand:** [Brand if visible, or "Brand not clearly visible"]
**Model:** [Model number if visible, or "Model number not visible"]

## 📅 AGE ESTIMATE
**Estimated Age:** [Age range, e.g., "8-12 years old"]
**Manufacturing Period:** [Time period, e.g., "2012-2016"]
**Confidence Level:** [High/Medium/Low]

## 🔧 KEY INDICATORS
[List 2-3 specific design features or characteristics that helped determine the age]

## ⚖️ WARRANTY STATUS
**Typical Warranty:** [Standard warranty period for this appliance type]
**Current Status:** [Likely in/out of warranty based on age]
**What's Usually Covered:** [Brief overview of typical coverage]

## 🛠️ CONDITION ASSESSMENT
**Overall Condition:** [Appears to be in Good/Fair/Poor condition]
**Potential Issues:** [Any visible concerns or common problems for this age]

## 💡 MAINTENANCE RECOMMENDATIONS
[2-3 specific, actionable maintenance tips for this appliance]

## 💰 WHAT'S NEXT?
Based on the age and condition, here are your options:
- **Keep & Maintain:** [If worth maintaining]
- **Repair Needed:** [If repairs might be needed]
- **Consider Replacement:** [If approaching end of life]

Keep the language simple, friendly, and helpful for a homeowner making decisions about their appliance.`;

    // Call OpenAI GPT-4o API (much cheaper with vision capabilities)
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
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
      max_tokens: 1500,
      temperature: 0.7
    });

    const baseAnalysis = response.choices[0].message.content;

    // Add business links to the analysis
    const businessSection = `

---

## 🏢 PROFESSIONAL SERVICES

### Need a Repair Estimate?
**Get a professional repair estimate at:** [EstimateMyFix.com](https://estimatemyfix.com)
- Professional appliance repair quotes
- Licensed and insured technicians
- Quick and reliable service

### Need Appliance Removal?
**Professional appliance pickup and disposal:** [FreeLocalAppliancePickup.com](https://freelocalappliancepickup.com)
- Free local appliance pickup
- Environmentally responsible disposal
- Same-day service available

---
*Analysis provided by AI-powered appliance assessment technology*`;

    const analysis = baseAnalysis + businessSection;

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