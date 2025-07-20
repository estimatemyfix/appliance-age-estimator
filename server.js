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

app.post('/analyze-appliance', upload.array('photos', 5), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No photos uploaded' });
    }

    // TEMPORARY: Skip payment verification for testing - REMOVE THIS LATER
    const TESTING_MODE = true; // Set to false to enable payment verification
    
    if (TESTING_MODE) {
      console.log('TESTING MODE: Skipping payment verification');
    }

    // Get custom question from URL parameter (more reliable than multipart body)
    console.log('Request query parameters:', req.query); // Debug log
    console.log('Request body fields:', req.body); // Debug log
    
    let customQuestion = '';
    
    // Try URL parameter first (most reliable)
    if (req.query.custom_question) {
      customQuestion = decodeURIComponent(req.query.custom_question);
      console.log('Found custom question in URL:', customQuestion); // Debug log
    } else {
      // Fallback to body (less reliable with multipart)
      customQuestion = req.body.custom_question || '';
      console.log('Found custom question in body:', customQuestion); // Debug log
    }
    
    console.log('Final custom question:', customQuestion ? `"${customQuestion}"` : 'None'); // Debug log
    console.log('=== FULL PROMPT BEING SENT TO AI ===');
    console.log(prompt);
    console.log('=== END PROMPT ===');
    
    // Process all uploaded files
    const imageContents = [];
    for (let i = 0; i < req.files.length; i++) {
      const file = req.files[i];
      
      // Convert image to base64
      const imageBuffer = await fs.readFile(file.path);
      const base64Image = imageBuffer.toString('base64');
      
      imageContents.push({
        type: "image_url",
        image_url: {
          url: `data:${file.mimetype};base64,${base64Image}`,
          detail: "high"
        }
      });
    }

    // Create consumer-friendly prompt for multiple appliances and custom questions
    let prompt = `Please analyze this appliance image and provide detailed information about:

1. Appliance identification (type, brand, model if visible)
2. Age estimation based on design features 
3. Warranty status assessment
4. Common problems for this appliance type and age
5. Top 5 replacement parts with real part numbers and costs
6. Repair video suggestions

Please format your response with the following sections:

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

## ⚠️ COMMON PROBLEMS
1. **[Most common problem]** - [Brief description of symptoms]
2. **[Second problem]** - [Brief description of symptoms]  
3. **[Third problem]** - [Brief description of symptoms]
4. **[Fourth problem]** - [Brief description of symptoms]
5. **[Fifth problem]** - [Brief description of symptoms]

## 🔧 TOP 5 REPLACEMENT PARTS & PURCHASE LINKS
- **[Part 1 name]**: OEM# [real part number] - **Part Cost: $XX-$XX**
  - 🛒 **Amazon:** https://www.amazon.com/s?k=[part_number]+[appliance_type]
  - 🛒 **RepairClinic:** https://www.repairclinic.com/SearchResults?q=[part_number]

- **[Part 2 name]**: OEM# [real part number] - **Part Cost: $XX-$XX**
  - 🛒 **Amazon:** https://www.amazon.com/s?k=[part_number]+[appliance_type]
  - 🛒 **RepairClinic:** https://www.repairclinic.com/SearchResults?q=[part_number]

- **[Part 3 name]**: OEM# [real part number] - **Part Cost: $XX-$XX**
  - 🛒 **Amazon:** https://www.amazon.com/s?k=[part_number]+[appliance_type]
  - 🛒 **RepairClinic:** https://www.repairclinic.com/SearchResults?q=[part_number]

- **[Part 4 name]**: OEM# [real part number] - **Part Cost: $XX-$XX**
  - 🛒 **Amazon:** https://www.amazon.com/s?k=[part_number]+[appliance_type]
  - 🛒 **RepairClinic:** https://www.repairclinic.com/SearchResults?q=[part_number]

- **[Part 5 name]**: OEM# [real part number] - **Part Cost: $XX-$XX**
  - 🛒 **Amazon:** https://www.amazon.com/s?k=[part_number]+[appliance_type]
  - 🛒 **RepairClinic:** https://www.repairclinic.com/SearchResults?q=[part_number]

## 🎥 REPAIR VIDEO RESOURCES
- **[Specific repair task 1]** - YouTube: "[search term like 'dryer heating element replacement']"
- **[Specific repair task 2]** - YouTube: "[search term like 'washing machine water valve fix']"
- **[Specific repair task 3]** - YouTube: "[search term like 'dishwasher door seal replacement']"

## 💡 MAINTENANCE RECOMMENDATIONS
[2-3 specific, actionable maintenance tips to prevent common problems]

## 💰 WHAT'S NEXT?
Based on the age and condition, here are your options:
- **Keep & Maintain:** [If worth maintaining]
- **Repair Needed:** [If repairs might be needed]
- **Consider Replacement:** [If approaching end of life]

Please provide specific part numbers and realistic cost estimates. Include actual YouTube search terms for repair videos.`;

  if (customQuestion) {
    prompt += `

Additionally, please answer this specific question: "${customQuestion}"`;
  }

    // Call OpenAI GPT-4o API (much cheaper with vision capabilities)
    const messageContent = [
      { type: "text", text: prompt },
      ...imageContents
    ];

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "user",
          content: messageContent
        }
      ],
      max_tokens: req.files.length > 1 ? 2500 : 1500, // More tokens for multiple appliances
      temperature: 0.7
    });

    const baseAnalysis = response.choices[0].message.content;
    
    console.log('=== AI RESPONSE RECEIVED ===');
    console.log('Response exists:', !!response);
    console.log('Choices exist:', !!response.choices);
    console.log('First choice exists:', !!response.choices[0]);
    console.log('Message content exists:', !!response.choices[0]?.message?.content);
    console.log('Content length:', baseAnalysis?.length || 0);
    console.log('Base analysis:', baseAnalysis);
    console.log('=== END AI RESPONSE ===');

    // Validate the AI response
    if (!baseAnalysis || baseAnalysis.trim().length === 0) {
      throw new Error('OpenAI API returned empty response');
    }

    // Check if response looks like an error or refusal
    if (baseAnalysis.toLowerCase().includes("i can't assist") || 
        baseAnalysis.toLowerCase().includes("i'm sorry") || 
        baseAnalysis.length < 200) {
      throw new Error(`OpenAI API refused or gave insufficient response: ${baseAnalysis}`);
    }

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

    // Clean up uploaded files
    for (const file of req.files) {
      await fs.remove(file.path);
    }

    res.json({
      success: true,
      analysis: analysis,
      fileCount: req.files.length,
      hasCustomQuestion: !!customQuestion
    });

  } catch (error) {
    console.error('Error analyzing appliance:', error);
    
    // Clean up uploaded files on error
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        try {
          await fs.remove(file.path);
        } catch (cleanupError) {
          console.error('Error cleaning up file:', cleanupError);
        }
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